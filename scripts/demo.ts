// Demo data (demo.db) — UI/analytics dekhne ke liye. Chalao: DB_FILE=demo.db pnpm tsx scripts/demo.ts
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "@/db";
import { seed } from "@/db/seed";
import { addDays, today } from "@/lib/analytics";
import { addRound, addSet, createWorkout } from "@/lib/workouts";
import type { Label } from "@/lib/catalog";

migrate(db, { migrationsFolder: "./drizzle" });
seed(db);
const id = (n: string) => (db.$client.prepare("select id from exercises where name = ?").get(n) as { id: number }).id;

// [exercise, start kg, +kg per week]
const PLAN: Record<string, [string, number, number][]> = {
  PUSH: [["incline bench press", 50, 1.25], ["machine press", 30, 2.5], ["side lateral raises", 8, 0.25], ["v-bar pushdowns", 25, 1.25]],
  PULL: [["lat pulldown", 50, 1.25], ["seated rows", 45, 1.25], ["dumbbell curls", 12, 0.5]],
  LEG_DAY: [["squats", 70, 2.5], ["leg press", 120, 5], ["hamstring curls", 35, 1.25]],
  CHEST_DAY: [["flat bench press", 60, 1.25], ["dumbbell flyes", 14, 0.5], ["skull crushers", 25, 1.25]],
};
// Superset wale din: do exercises alternate
const SUPERSET: Partial<Record<Label, [string, string]>> = { PUSH: ["side lateral raises", "v-bar pushdowns"] };
const WEEK: (Label | null)[] = ["PUSH", "PULL", "LEG_DAY", null, "CHEST_DAY", "PULL", null];
const start = addDays(today(), -70);
for (let d = 0; d <= 70; d++) {
  const date = addDays(start, d);
  const label = WEEK[d % 7];
  if (!label || Math.random() < 0.12) continue; // kabhi miss bhi
  const w = createWorkout(label, date);
  const ss = SUPERSET[label];
  for (const [name, kg0, step] of PLAN[label]) {
    if (ss?.includes(name)) continue; // superset me alag se
    const kg = kg0 + step * Math.floor(d / 7);
    for (let s = 0; s < 3; s++) addSet(w.id, id(name), kg, 10 - s - Math.floor(Math.random() * 2));
    if (Math.random() < 0.3) addSet(w.id, id(name), Math.round(kg * 0.8 * 2) / 2, 8, { drop: true }); // kabhi drop bhi
  }
  if (ss) {
    const [a, b] = ss.map((n) => PLAN[label].find((p) => p[0] === n)!);
    for (let r = 0; r < 3; r++)
      addRound(w.id, [a, b].map(([n, k0, st]) => ({ exerciseId: id(n), weightKg: k0 + st * Math.floor(d / 7), reps: 12 - r })));
  }
}
console.log("demo ok");
