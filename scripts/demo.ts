// Demo data → server DB (demo.db). App kholte hi sync se device me aa jaata hai.
// Chalao: DATABASE_URL=file:demo.db pnpm tsx scripts/demo.ts  (phir DATABASE_URL=file:demo.db pnpm dev)
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db";
import { seed } from "@/db/seed";
import { addDays, today } from "@/lib/analytics";
import { EXERCISE_ROWS, type Label } from "@/lib/catalog";
import { newId } from "@/lib/store";
import { applySync } from "@/lib/sync-server";
import { MAX_PUSH } from "@/lib/sync-limits";
import type { SetRow, WorkoutRow } from "@/lib/types";

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
const ex = (n: string) => EXERCISE_ROWS.find((e) => e.name === n)!.id;

(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);
  const ws: WorkoutRow[] = [], ss: SetRow[] = [];
  const now = Date.now();
  const set = (workoutId: string, exerciseId: number, setNo: number, weightKg: number, reps: number, extra: Partial<SetRow> = {}) =>
    ss.push({ id: newId(), workoutId, exerciseId, setNo, weightKg, reps, parentSetId: null, supersetId: null, note: null, updatedAt: now, deletedAt: null, ...extra });
  const start = addDays(today(), -70);
  for (let d = 0; d <= 70; d++) {
    const label = WEEK[d % 7];
    if (!label || Math.random() < 0.12) continue; // kabhi miss bhi
    const w: WorkoutRow = { id: newId(), date: addDays(start, d), label, notes: null, updatedAt: now, deletedAt: null };
    ws.push(w);
    const pair = SUPERSET[label];
    const kg = (k0: number, step: number) => k0 + step * Math.floor(d / 7);
    for (const [name, k0, step] of PLAN[label]) {
      if (pair?.includes(name)) continue; // superset me alag se
      for (let s = 1; s <= 3; s++) set(w.id, ex(name), s, kg(k0, step), 10 - s - Math.floor(Math.random() * 2));
      if (Math.random() < 0.3) set(w.id, ex(name), 3, Math.round(kg(k0, step) * 0.8 * 2) / 2, 8, { parentSetId: ss.at(-1)!.id }); // kabhi drop bhi
    }
    if (pair) {
      const [a, b] = pair.map((n) => PLAN[label].find((p) => p[0] === n)!);
      for (let r = 1; r <= 3; r++) {
        const supersetId = newId();
        for (const [n, k0, step] of [a, b]) set(w.id, ex(n), r, kg(k0, step), 13 - r, { supersetId });
      }
    }
  }
  const all = [...ws, ...ss];
  for (let i = 0; i < all.length; i += MAX_PUSH) {
    const part = all.slice(i, i + MAX_PUSH);
    await applySync(db, { since: 0, workouts: part.filter((r): r is WorkoutRow => "label" in r), sets: part.filter((r): r is SetRow => "exerciseId" in r) });
  }
  console.log(`demo ok — ${ws.length} workouts, ${ss.length} sets`);
})();
