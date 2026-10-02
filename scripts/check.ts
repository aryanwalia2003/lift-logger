// Smoke check: migration (legacy data), server sync, offline store + 2-device sync, analytics, backup/restore
import "fake-indexeddb/auto";
import assert from "node:assert";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { LiftDB } from "@/lib/local-db";

const dir = mkdtempSync(join(tmpdir(), "lift-check-"));
process.env.DATABASE_URL = `file:${join(dir, "server.db")}`; // libsql :memory: me batch alag connection leta hai

const sqlFiles = () => readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort();
const statements = (f: string) => readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

async function legacyMigration() {
  const c = createClient({ url: `file:${join(dir, "legacy.db")}` });
  const files = sqlFiles();
  for (const f of files.slice(0, 3)) for (const s of statements(f)) await c.execute(s); // purana schema (int ids)
  await c.execute("insert into body_parts(name) values ('chest')");
  await c.execute("insert into exercises(name, body_part_id) values ('x', 1)");
  await c.execute("insert into workouts(date,label) values ('2026-10-01','PUSH'),('2026-10-02','PULL')");
  await c.execute("insert into sets(workout_id,exercise_id,set_no,weight_kg,reps,parent_set_id,superset_id,note) values (1,1,1,60,8,null,null,null),(1,1,1,45,10,1,null,'drop'),(2,1,1,50,9,null,7,null)");
  for (const s of statements(files[3])) await c.execute(s); // nayi migration, asli SQL
  const rows = (q: string) => c.execute(q).then((r) => r.rows);
  assert.deepEqual((await rows("select id from workouts order by rev")).map((r) => r.id), ["-lw00000001", "-lw00000002"]);
  const s = await rows("select id, workout_id, parent_set_id, superset_id, note, rev from sets order by rev");
  assert.deepEqual(s.map((r) => [r.id, r.workout_id, r.parent_set_id, r.superset_id, r.note]), [
    ["-ls00000001", "-lw00000001", null, null, null], ["-ls00000002", "-lw00000001", "-ls00000001", null, "drop"], ["-ls00000003", "-lw00000002", null, "-lss00000007", null],
  ]);
  assert.equal(Number((await rows("select rev from sync_state"))[0].rev), 5); // max rev
  assert.equal((await rows("pragma foreign_key_check")).length, 0);
  c.close();
}

(async () => {
  await legacyMigration();

  const { db, client } = await import("@/db");
  await migrate(db, { migrationsFolder: "./drizzle" });
  const { seed } = await import("@/db/seed");
  await seed(db);
  await seed(db); // dobara — duplicate nahi hona chahiye
  const { EXERCISE_ROWS, PART_ROWS } = await import("@/lib/catalog");
  assert.equal(EXERCISE_ROWS.length, 44);
  assert.deepEqual((await client.execute("select id, name from exercises order by id")).rows.map((r) => [Number(r.id), r.name]), EXERCISE_ROWS.map((e) => [e.id, e.name]));
  assert.deepEqual((await client.execute("select id, name, parent_id from body_parts order by id")).rows.map((r) => [Number(r.id), r.name, r.parent_id === null ? null : Number(r.parent_id)]), PART_ROWS.map((p) => [p.id, p.name, p.parentId]));
  const ex = (name: string) => EXERCISE_ROWS.find((e) => e.name === name)!.id;

  // ---- server: validation, LWW, tombstones, FK refs, pagination ----
  const { applySync, SyncError } = await import("@/lib/sync-server");
  const W = (id: string, over = {}) => ({ id, date: "2026-10-01", label: "PUSH", notes: null, updatedAt: 1000, deletedAt: null, ...over });
  const S = (id: string, workoutId: string, over = {}) => ({ id, workoutId, exerciseId: ex("squats"), setNo: 1, weightKg: 100, reps: 5, parentSetId: null, supersetId: null, note: null, updatedAt: 1000, deletedAt: null, ...over });
  const push = (workouts: unknown[], sets: unknown[], since = 0) => applySync(db, { since, workouts, sets });
  const rejects = async (w: unknown[], s: unknown[], msg: RegExp) => assert.rejects(push(w, s), (e) => e instanceof SyncError && msg.test(e.message));

  await rejects([W("a", { label: "NOPE" })], [], /label/);
  await rejects([W("bad id!")], [], /id/);
  await rejects([W("a")], [S("s", "a", { reps: 0 })], /reps/);
  await rejects([W("a")], [S("s", "a", { exerciseId: 9999 })], /exercise/);
  await rejects([W("a")], [S("s", "a", { weightKg: -1 })], /weight/);
  await rejects([], [S("s", "nope")], /Unknown workout/);
  await rejects([W("a")], [S("s", "a", { parentSetId: "ghost" })], /Unknown parent/);
  await rejects([W("a", { notes: "x".repeat(501) })], [], /notes/);
  await assert.rejects(applySync(db, { since: 0, workouts: [], sets: Array.from({ length: 501 }, (_, i) => S(`m${i}`, "a")) }), SyncError);
  assert.equal((await push([], [])).rev, 0); // kuch accept nahi hua

  const r = await push([W("w1")], [S("s1", "w1"), S("s2", "w1", { parentSetId: "s1", setNo: 1, weightKg: 80 })]);
  assert.equal(r.workouts.length, 1);
  assert.equal(r.sets.length, 2);
  assert.equal(r.rev, 3); // 3 rows, har ek ko unique rev
  const head = r.rev;
  // LWW: purana update ignore, naya accept, equal accept (idempotent resend)
  await push([], [S("s1", "w1", { weightKg: 50, updatedAt: 500 })]);
  assert.equal((await push([], [], 0)).sets.find((s) => s.id === "s1")!.weightKg, 100);
  await push([], [S("s1", "w1", { weightKg: 110, updatedAt: 2000 })]);
  assert.equal((await push([], [], head)).sets.find((s) => s.id === "s1")!.weightKg, 110); // naya rev > head
  assert.equal((await push([], [S("s1", "w1", { weightKg: 110, updatedAt: 2000 })])).rev > head, true);
  // tombstone sync hota hai
  await push([], [S("s2", "w1", { parentSetId: "s1", deletedAt: 3000, updatedAt: 3000 })]);
  assert.equal((await push([], [], 0)).sets.find((s) => s.id === "s2")!.deletedAt, 3000);
  // cursor: sirf naye rows; since > head => poora dobara
  const cur = (await push([], [], 0)).cursor;
  assert.equal((await push([], [], cur)).sets.length, 0);
  assert.equal((await push([], [], cur + 1000)).sets.length, 2);
  // pagination: 2500 sets, PAGE=2000 → more
  const many = Array.from({ length: 2500 }, (_, i) => S(`p${String(i).padStart(4, "0")}`, "w1", { setNo: 1 }));
  for (let i = 0; i < many.length; i += 500) await push([], many.slice(i, i + 500));
  const p1 = await push([], [], 0);
  assert.equal(p1.more, true);
  assert.equal(p1.sets.length + p1.workouts.length, 2000);
  const p2 = await push([], [], p1.cursor);
  assert.equal(p2.more, false);
  assert.equal(p1.sets.length + p1.workouts.length + p2.sets.length + p2.workouts.length, 1 + 2 + 2500); // koi row miss/duplicate nahi
  await client.execute("delete from sets"); await client.execute("delete from workouts"); await client.execute("update sync_state set rev = 0");

  // ---- client: 2 devices, local DB + sync ----
  const { makeStore } = await import("@/lib/store");
  const { makeSync } = await import("@/lib/sync");
  const analytics = await import("@/lib/analytics");
  let online = true;
  const transport = async (req: unknown) => {
    if (!online) throw new TypeError("fetch failed"); // browser offline jaisa
    return applySync(db, JSON.parse(JSON.stringify(req)));
  };
  const device = (name: string) => {
    const local = new LiftDB(name);
    const eng = makeSync(local, transport as never);
    return { local, eng, store: makeStore(local, () => {}) };
  };
  const A = device("A"), B = device("B");
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const tick = (ms = 1000) => (clock += ms);

  // A offline: poora dataset
  online = false;
  const sa = A.store;
  const inc = ex("incline bench press"), lat = ex("side lateral raises"), push2 = ex("v-bar pushdowns"), squats = ex("squats");
  tick();
  const wk = await sa.createWorkout("CHEST_DAY", "2026-10-01");
  await sa.addSet(wk.id, inc, 60, 8);
  await sa.addSet(wk.id, inc, 60, 6);
  await sa.addSet(wk.id, squats, 100, 5); // leg day label ke bina bhi chalega
  assert.equal((await sa.lastSet(inc))!.reps, 6);
  const wk2 = await sa.createWorkout("PUSH", "2026-10-08");
  await sa.addSet(wk2.id, inc, 62.5, 8); // e1RM badha → PR
  const today = await sa.createWorkout("PUSH");
  await sa.addSet(today.id, inc, 50, 10);
  const old = await sa.createWorkout("LEG_DAY", "2020-01-01");
  await sa.addSet(old.id, squats, 40, 5);

  // drop set + superset
  const dropW = await sa.createWorkout("PUSH", "2026-09-15");
  const main = await sa.addSet(dropW.id, inc, 60, 8);
  const drop = await sa.addSet(dropW.id, inc, 45, 10, { drop: true });
  assert.equal(drop.parentSetId, main.id);
  assert.equal(drop.setNo, main.setNo);
  await assert.rejects(sa.addSet(dropW.id, lat, 10, 10, { drop: true }), /main set/); // main set ke bina drop nahi
  const rd = await sa.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: push2, weightKg: 25, reps: 12 }]);
  assert.equal(rd[0].supersetId, rd[1].supersetId);
  await assert.rejects(sa.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: lat, weightKg: 8, reps: 12 }]));
  const before = (await sa.workoutSets(dropW.id)).length;
  await assert.rejects(sa.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: push2, weightKg: 25, reps: 0 }]));
  assert.equal((await sa.workoutSets(dropW.id)).length, before); // bad round se kuch insert nahi hua

  // edit + notes + delete rules
  tick();
  const upd = await sa.updateSet(main.id, 62.5, 7, "  felt heavy  ");
  assert.deepEqual([upd.weightKg, upd.reps, upd.note], [62.5, 7, "felt heavy"]); // note trim hua
  assert.equal((await sa.updateSet(main.id, 62.5, 7, "   ")).note, null); // khali note = null
  await assert.rejects(sa.updateSet(main.id, 62.5, 0, "")); // bad reps
  await assert.rejects(sa.updateSet(main.id, 62.5, 7, "x".repeat(501))); // note lamba
  await assert.rejects(sa.updateSet("nope", 50, 5, "")); // set nahi mila
  await sa.updateSet(main.id, 60, 8, "felt heavy"); // wapas 60×8
  await sa.setWorkoutNotes(dropW.id, " slept badly ");
  assert.equal((await sa.getWorkout(dropW.id))!.notes, "slept badly");
  await assert.rejects(sa.setWorkoutNotes("nope", "x"));
  const extra = await sa.addSet(dropW.id, ex("machine press"), 30, 10);
  await sa.addSet(dropW.id, ex("machine press"), 30, 10);
  await sa.deleteSet(extra.id);
  assert.equal((await sa.addSet(dropW.id, ex("machine press"), 30, 10)).setNo, 3); // delete ke baad duplicate setNo nahi
  const gone = await sa.addSet(dropW.id, ex("smith machine press"), 30, 10);
  const goneDrop = await sa.addSet(dropW.id, ex("smith machine press"), 20, 10, { drop: true });
  await sa.deleteSet(gone.id);
  assert.equal((await sa.workoutSets(dropW.id)).some((s) => s.id === gone.id || s.id === goneDrop.id), false); // drops saath gaye

  assert.ok((await A.eng.pending()) > 0);
  await A.eng.sync();
  assert.equal(A.eng.getStatus().error, "Offline"); // offline: queue me hi, data safe
  assert.ok((await A.eng.pending()) > 0);

  // analytics local rows se
  const rows = await sa.loadRows();
  const mine = rows.filter((x) => x.exerciseId === inc);
  assert.deepEqual(analytics.exerciseSessions(mine).map((s) => s.pr), [false, false, false, true]);
  assert.equal(analytics.exerciseSessions(mine)[0].volume, 930); // 60×8 + drop 45×10 volume me
  assert.equal(analytics.prs(rows).length, 2); // incline + squats (2020 se zyada)
  assert.equal(analytics.byLabel(rows).find((l) => l.label === "CHEST_DAY")!.count, 1);
  assert.equal(analytics.byPart(rows).find((p) => p.name === "chest")!.sets, 5); // drop alag set nahi
  const sm = analytics.summary(rows, "all");
  assert.equal(sm.drops, 1);
  assert.equal(sm.rounds, 1);
  assert.equal(analytics.supersetPairs(rows)[0].pair, "side lateral raises + v-bar pushdowns");
  assert.equal(analytics.weekStart("2026-10-01"), "2026-09-28");
  const thisWeek = rows.filter((x) => analytics.weekStart(x.date) === analytics.weekStart(analytics.today())).length;
  assert.equal(analytics.weekly(rows, 3).at(-1)!.sets, thisWeek);
  assert.equal(analytics.inRange(rows, "30").length, rows.length - 1); // 2020 wala bahar

  // online aao: A push, B pull — same data
  online = true;
  await A.eng.sync();
  assert.equal(A.eng.getStatus().error, null);
  assert.equal(await A.eng.pending(), 0);
  await B.eng.sync();
  assert.deepEqual(await B.store.loadRows(), rows); // sab kuch (order, notes, drops, supersets) same
  assert.equal((await B.store.getWorkout(dropW.id))!.notes, "slept badly");
  assert.equal((await B.store.getWorkout(dropW.id))!.deletedAt, null);

  // conflict: dono ek hi set edit karein, jiska updatedAt naya wo jeete (sync order se farak nahi)
  tick();
  await A.store.updateSet(main.id, 61, 8, "A edit");
  tick();
  await B.store.updateSet(main.id, 65, 8, "B edit"); // baad me
  await B.eng.sync(); // B pehle sync
  await A.eng.sync(); // A ka purana edit server pe haara
  await B.eng.sync();
  const win = async (d: typeof A) => (await d.store.workoutSets(dropW.id)).find((s) => s.id === main.id)!;
  assert.deepEqual([(await win(A)).weightKg, (await win(A)).note], [65, "B edit"]);
  assert.deepEqual([(await win(B)).weightKg, (await win(B)).note], [65, "B edit"]);

  // delete sync: B delete kare, A ko tombstone mile
  tick();
  await B.store.deleteSet(main.id); // main + uska drop
  await B.eng.sync();
  await A.eng.sync();
  assert.equal((await A.store.workoutSets(dropW.id)).some((s) => s.id === main.id || s.id === drop.id), false);
  // edit-vs-delete: delete naya ho to delete jeete
  tick();
  const keep = await A.store.addSet(wk.id, inc, 70, 5);
  await A.eng.sync(); await B.eng.sync();
  tick();
  await A.store.updateSet(keep.id, 71, 5, "");
  tick();
  await B.store.deleteSet(keep.id);
  await B.eng.sync(); await A.eng.sync();
  assert.equal((await A.store.workoutSets(wk.id)).some((s) => s.id === keep.id), false);

  // sync ke beech edit: dirty bacha rehna chahiye
  tick();
  const mid = await A.store.addSet(wk.id, inc, 80, 3);
  let editedDuringPush = false;
  const slow = makeSync(A.local, (async (req: unknown) => {
    const res = await transport(req);
    if (!editedDuringPush) {
      editedDuringPush = true;
      tick();
      await A.store.updateSet(mid.id, 82, 3, "edited mid-sync"); // response aane se pehle local edit
    }
    return res;
  }) as never);
  await slow.sync();
  assert.equal(await slow.pending() >= 1, true); // naya edit abhi dirty
  const cleanSync = makeSync(A.local, transport as never);
  await cleanSync.sync();
  await B.eng.sync();
  assert.deepEqual([(await B.store.workoutSets(wk.id)).find((s) => s.id === mid.id)!.weightKg], [82]);

  // auth error: 401 → status.auth
  const { AuthError } = await import("@/lib/sync");
  const authed = makeSync(A.local, (async () => { throw new AuthError("Signed out"); }) as never);
  await authed.sync();
  assert.equal(authed.getStatus().auth, true);

  Date.now = realNow;

  // ---- backup → nayi khali server DB me restore ----
  const { dump, restore } = await import("@/lib/backup");
  const schema = await import("@/db/schema");
  const c2 = createClient({ url: `file:${join(dir, "restore.db")}` });
  const db2 = drizzle(c2, { schema });
  await migrate(db2, { migrationsFolder: "./drizzle" });
  const d = await dump(db);
  await restore(db2, d);
  assert.deepEqual({ ...(await dump(db2)), at: "" }, { ...d, at: "" });
  assert.equal(Number((await c2.execute("select rev from sync_state")).rows[0].rev) >= Math.max(...d.sets.map((x) => x.rev)), true); // counter peeche nahi
  await assert.rejects(restore(db2, d)); // bhari DB pe restore nahi
  c2.close();

  client.close();
  rmSync(dir, { recursive: true });
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
