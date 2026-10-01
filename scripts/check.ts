// Smoke check: DB + analytics chal rahe hain?
import assert from "node:assert";
process.env.DB_FILE = ":memory:";
(async () => {
const { sqlite } = await import("@/db");
const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
const { db } = await import("@/db");
migrate(db, { migrationsFolder: "./drizzle" });
// server actions "use server" tsx me bhi import ho jaate hain
const { startWorkout, logSet } = await import("@/lib/actions");
const { exerciseProgress, dayHistory } = await import("@/lib/analytics");

const w = startWorkout("2026-10-01", "CHEST");
logSet(w.id, "INCLINE_BENCH_PRESS", 60, 8);
logSet(w.id, "INCLINE_BENCH_PRESS", 60, 6);
assert.throws(() => logSet(w.id, "SQUAT", 100, 5)); // galat din
assert.equal(exerciseProgress("INCLINE_BENCH_PRESS")[0].volume, 840);
assert.equal(dayHistory("CHEST")[0].sets, 2);
sqlite.close();
console.log("ok");
})();
