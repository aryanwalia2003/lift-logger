import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sets, workouts } from "@/db/schema";
import type { DayType, Exercise } from "./exercises";

// Epley formula se estimated 1RM
const e1rm = sql<number>`max(${sets.weightKg} * (1 + ${sets.reps} / 30.0))`;
const volume = sql<number>`sum(${sets.weightKg} * ${sets.reps})`;

// "Chest day kaisa dikha" — har session ka volume/sets
export const dayHistory = (day: DayType) =>
  db
    .select({
      date: workouts.date,
      sets: sql<number>`count(${sets.id})`,
      volume,
    })
    .from(workouts)
    .leftJoin(sets, eq(sets.workoutId, workouts.id))
    .where(eq(workouts.day, day))
    .groupBy(workouts.id)
    .orderBy(asc(workouts.date))
    .all();

// Ek exercise ki progression: top weight, e1RM, volume per date
export const exerciseProgress = (exercise: Exercise) =>
  db
    .select({
      date: workouts.date,
      topWeight: sql<number>`max(${sets.weightKg})`,
      e1rm,
      volume,
    })
    .from(sets)
    .innerJoin(workouts, eq(sets.workoutId, workouts.id))
    .where(eq(sets.exercise, exercise))
    .groupBy(workouts.date)
    .orderBy(asc(workouts.date))
    .all();

// Kaunse din kya kiya
export const schedule = () =>
  db.select({ date: workouts.date, day: workouts.day }).from(workouts).orderBy(asc(workouts.date)).all();
