"use server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sets, workouts } from "@/db/schema";
import { DAY_TYPES, EXERCISE_LIST, EXERCISES, type DayType, type Exercise } from "./exercises";

// Aaj ka workout nikalo ya bana do
export function startWorkout(date: string, day: DayType) {
  if (!DAY_TYPES.includes(day)) throw new Error("bad day");
  const hit = db.select().from(workouts).where(sql`${workouts.date} = ${date} and ${workouts.day} = ${day}`).get();
  return hit ?? db.insert(workouts).values({ date, day }).returning().get();
}

export function logSet(workoutId: number, exercise: Exercise, weightKg: number, reps: number) {
  if (!EXERCISE_LIST.includes(exercise)) throw new Error("bad exercise");
  if (!(weightKg >= 0) || !Number.isInteger(reps) || reps < 1) throw new Error("bad weight/reps");
  const w = db.select().from(workouts).where(eq(workouts.id, workoutId)).get();
  if (!w) throw new Error("workout nahi mila");
  if (EXERCISES[exercise] !== w.day) throw new Error(`${exercise} ${w.day} day ka nahi hai`);
  const setNo =
    (db.select({ n: sql<number>`count(*)` }).from(sets)
      .where(sql`${sets.workoutId} = ${workoutId} and ${sets.exercise} = ${exercise}`).get()?.n ?? 0) + 1;
  return db.insert(sets).values({ workoutId, exercise, setNo, weightKg, reps }).returning().get();
}
