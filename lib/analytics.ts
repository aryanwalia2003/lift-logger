import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bodyParts, exercises, sets, workouts } from "@/db/schema";
import type { Label } from "./catalog";

// Epley formula se estimated 1RM
const e1rm = sql<number>`max(${sets.weightKg} * (1 + ${sets.reps} / 30.0))`;
const volume = sql<number>`sum(${sets.weightKg} * ${sets.reps})`;

// Label ke sessions: kab kitne sets/volume
export const labelHistory = (label: Label) =>
  db
    .select({ date: workouts.date, sets: sql<number>`count(${sets.id})`, volume })
    .from(workouts)
    .leftJoin(sets, eq(sets.workoutId, workouts.id))
    .where(eq(workouts.label, label))
    .groupBy(workouts.id)
    .orderBy(asc(workouts.date))
    .all();

// Body part (children ke saath) ka volume per date — label se alag
export const bodyPartHistory = (bodyPartId: number) => {
  const ids = [bodyPartId, ...db.select({ id: bodyParts.id }).from(bodyParts).where(eq(bodyParts.parentId, bodyPartId)).all().map((r) => r.id)];
  return db
    .select({ date: workouts.date, sets: sql<number>`count(${sets.id})`, volume })
    .from(sets)
    .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(inArray(exercises.bodyPartId, ids))
    .groupBy(workouts.date)
    .orderBy(asc(workouts.date))
    .all();
};

// Ek exercise ki progression
export const exerciseProgress = (exerciseId: number) =>
  db
    .select({ date: workouts.date, topWeight: sql<number>`max(${sets.weightKg})`, e1rm, volume })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(eq(sets.exerciseId, exerciseId))
    .groupBy(workouts.date)
    .orderBy(asc(workouts.date))
    .all();

// Kaunse din kya kiya
export const schedule = () =>
  db.select({ date: workouts.date, label: workouts.label }).from(workouts).orderBy(asc(workouts.date)).all();
