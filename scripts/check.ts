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
  assert.equal(a.exerciseProgress(inc)[0].volume, 840);
  assert.equal(a.labelHistory("CHEST_DAY")[0].sets, 3);
  assert.equal(a.bodyPartHistory(suggested[0].id)[0].sets, 2);
  sqlite.close();
  console.log("ok");
})();
