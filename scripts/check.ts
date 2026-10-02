// Smoke check: DB + seed + log + analytics
import assert from "node:assert";
process.env.DB_FILE = ":memory:";
(async () => {
  const { db, sqlite } = await import("@/db");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  migrate(db, { migrationsFolder: "./drizzle" });
  const { seed } = await import("@/db/seed");
  seed(db);
  seed(db); // dobara — duplicate nahi hona chahiye
  const w = await import("@/lib/workouts");
  const a = await import("@/lib/analytics");

  const ex = (n: string) => db.$client.prepare("select id from exercises where name = ?").get(n) as { id: number };
  assert.equal((db.$client.prepare("select count(*) n from exercises").get() as { n: number }).n, 44);

  // chest day par bhi shoulders/legs milte hain, label sirf order badalta hai
  const { suggested, others } = w.orderedBodyParts("CHEST_DAY");
  assert.deepEqual(suggested.map((p) => p.name), ["chest", "shoulders", "tricep"]);
  assert.ok(others.some((p) => p.name === "legs"));
  const shoulders = suggested[1];
  assert.deepEqual([...new Set(w.exercisesOf(shoulders.id).map((e) => e.part))], ["front delt", "side delt"]);

  const wk = w.createWorkout("CHEST_DAY", "2026-10-01");
  const inc = ex("incline bench press").id;
  w.addSet(wk.id, inc, 60, 8);
  w.addSet(wk.id, inc, 60, 6);
  w.addSet(wk.id, ex("squats").id, 100, 5); // leg day label ke bina bhi chalega
  assert.equal(w.lastSet(inc)!.reps, 6);
  const wk2 = w.createWorkout("PUSH", "2026-10-08");
  w.addSet(wk2.id, inc, 62.5, 8); // e1RM badha → PR
  const today = w.createWorkout("PUSH");
  w.addSet(today.id, inc, 50, 10);
  const old = w.createWorkout("LEG_DAY", "2020-01-01");
  w.addSet(old.id, ex("squats").id, 40, 5);

  // drop set + superset
  const lat = ex("side lateral raises").id;
  const dropW = w.createWorkout("PUSH", "2026-09-15");
  w.addSet(dropW.id, inc, 60, 8);
  w.addSet(dropW.id, inc, 45, 10, { drop: true });
  assert.throws(() => w.addSet(dropW.id, lat, 10, 10, { drop: true })); // main set ke bina drop nahi
  const rd = w.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: ex("v-bar pushdowns").id, weightKg: 25, reps: 12 }]);
  assert.equal(rd[0].supersetId, rd[1].supersetId);
  assert.throws(() => w.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: lat, weightKg: 8, reps: 12 }]));
  const before = w.workoutSets(dropW.id).length;
  assert.throws(() => w.addRound(dropW.id, [{ exerciseId: lat, weightKg: 8, reps: 12 }, { exerciseId: ex("v-bar pushdowns").id, weightKg: 25, reps: 0 }]));
  assert.equal(w.workoutSets(dropW.id).length, before); // bad round se kuch insert nahi hua

  const rows = a.loadRows();
  const mine = rows.filter((r) => r.exerciseId === inc);
  assert.deepEqual(a.exerciseSessions(mine).map((s) => s.pr), [false, false, false, true]);
  assert.equal(a.exerciseSessions(mine)[0].volume, 930); // 60×8 + drop 45×10 volume me
  assert.equal(a.prs(rows).length, 2); // incline + squats (2020 se zyada)
  assert.equal(a.byLabel(rows).find((l) => l.label === "CHEST_DAY")!.count, 1);
  assert.equal(a.byPart(rows).find((p) => p.name === "chest")!.sets, 5); // drop alag set nahi;
  const sm = a.summary(rows, "all");
  assert.equal(sm.drops, 1);
  assert.equal(sm.rounds, 1);
  assert.equal(a.supersetPairs(rows)[0].pair, "side lateral raises + v-bar pushdowns");
  assert.equal(a.weekStart("2026-10-01"), "2026-09-28");
  const thisWeek = rows.filter((r) => a.weekStart(r.date) === a.weekStart(a.today())).length;
  assert.equal(a.weekly(rows, 3).at(-1)!.sets, thisWeek);
  assert.equal(a.inRange(rows, "30").length, rows.length - 1); // 2020 wala bahar
  sqlite.close();
  console.log("ok");
})();
