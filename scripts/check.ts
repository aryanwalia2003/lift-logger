// Smoke check: DB + seed + log + analytics + backup/restore
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "lift-check-"));
process.env.DATABASE_URL = `file:${join(dir, "a.db")}`; // libsql :memory: me transactions/batch alag connection lete hain

(async () => {
  const { db, client } = await import("@/db");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(db, { migrationsFolder: "./drizzle" });
  const { seed } = await import("@/db/seed");
  await seed(db);
  await seed(db); // dobara — duplicate nahi hona chahiye
  const w = await import("@/lib/workouts");
  const a = await import("@/lib/analytics");

  const ex = async (n: string) => (await w.exerciseByName(n))!.id;
  assert.equal(Number((await client.execute("select count(*) n from exercises")).rows[0].n), 44);

  // chest day par bhi shoulders/legs milte hain, label sirf order badalta hai
  const { suggested, others } = await w.orderedBodyParts("CHEST_DAY");
  assert.deepEqual(suggested.map((p) => p.name), ["chest", "shoulders", "tricep"]);
  assert.ok(others.some((p) => p.name === "legs"));
  assert.deepEqual([...new Set((await w.exercisesOf(suggested[1].id)).map((e) => e.part))], ["front delt", "side delt"]);

  const wk = await w.createWorkout("CHEST_DAY", "2026-10-01");
  const inc = await ex("incline bench press");
  await w.addSet(wk.id, inc, 60, 8);
  await w.addSet(wk.id, inc, 60, 6);
  await w.addSet(wk.id, await ex("squats"), 100, 5); // leg day label ke bina bhi chalega
  assert.equal((await w.lastSet(inc))!.reps, 6);
  const wk2 = await w.createWorkout("PUSH", "2026-10-08");
  await w.addSet(wk2.id, inc, 62.5, 8); // e1RM badha → PR
  const today = await w.createWorkout("PUSH");
  await w.addSet(today.id, inc, 50, 10);
  const old = await w.createWorkout("LEG_DAY", "2020-01-01");
  await w.addSet(old.id, await ex("squats"), 40, 5);

  // drop set + superset
  const lat = await ex("side lateral raises");
  const push = await ex("v-bar pushdowns");
  const dropW = await w.createWorkout("PUSH", "2026-09-15");
  await w.addSet(dropW.id, inc, 60, 8);
  await w.addSet(dropW.id, inc, 45, 10, { drop: true });
  await assert.rejects(w.addSet(dropW.id, lat, 10, 10, { drop: true })); // main set ke bina drop nahi
  const rd = await w.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: push, weightKg: 25, reps: 12 }]);
  assert.equal(rd[0].supersetId, rd[1].supersetId);
  await assert.rejects(w.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: lat, weightKg: 8, reps: 12 }]));
  const before = (await w.workoutSets(dropW.id)).length;
  await assert.rejects(w.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: push, weightKg: 25, reps: 0 }]));
  assert.equal((await w.workoutSets(dropW.id)).length, before); // bad round se kuch insert nahi hua

  const rows = await a.loadRows();
  const mine = rows.filter((r) => r.exerciseId === inc);
  assert.deepEqual(a.exerciseSessions(mine).map((s) => s.pr), [false, false, false, true]);
  assert.equal(a.exerciseSessions(mine)[0].volume, 930); // 60×8 + drop 45×10 volume me
  assert.equal(a.prs(rows).length, 2); // incline + squats (2020 se zyada)
  assert.equal(a.byLabel(rows).find((l) => l.label === "CHEST_DAY")!.count, 1);
  assert.equal(a.byPart(rows).find((p) => p.name === "chest")!.sets, 5); // drop alag set nahi
  const sm = a.summary(rows, "all");
  assert.equal(sm.drops, 1);
  assert.equal(sm.rounds, 1);
  assert.equal(a.supersetPairs(rows)[0].pair, "side lateral raises + v-bar pushdowns");
  assert.equal(a.weekStart("2026-10-01"), "2026-09-28");
  const thisWeek = rows.filter((r) => a.weekStart(r.date) === a.weekStart(a.today())).length;
  assert.equal(a.weekly(rows, 3).at(-1)!.sets, thisWeek);
  assert.equal(a.inRange(rows, "30").length, rows.length - 1); // 2020 wala bahar

  // backup → nayi khali DB me restore → same rows, same analytics
  const { dump, restore } = await import("@/lib/backup");
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/db/schema");
  const c2 = createClient({ url: `file:${join(dir, "b.db")}` });
  const db2 = drizzle(c2, { schema });
  await migrate(db2, { migrationsFolder: "./drizzle" });
  const d = await dump(db);
  await restore(db2, d);
  const d2 = await dump(db2);
  assert.deepEqual({ ...d2, at: "" }, { ...d, at: "" });
  await assert.rejects(restore(db2, d)); // bhari DB pe restore nahi
  c2.close();

  client.close();
  rmSync(dir, { recursive: true });
  console.log("ok");
})();
