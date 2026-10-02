import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bodyParts, exercises, sets, workouts } from "@/db/schema";
import { LABELS, LABEL_KEYS, type Label } from "./catalog";

export function createWorkout(label: Label, date = new Date().toLocaleDateString("en-CA")) {
  if (!LABEL_KEYS.includes(label)) throw new Error("bad label");
  return db.insert(workouts).values({ date, label }).returning().get();
}

const check = (weightKg: number, reps: number) => {
  if (!(weightKg >= 0) || !Number.isInteger(reps) || reps < 1) throw new Error("bad weight/reps");
};

// Drop set = us exercise ke latest main set se attach; setNo parent wala hi
export function addSet(workoutId: number, exerciseId: number, weightKg: number, reps: number, o: { drop?: boolean; supersetId?: number } = {}) {
  check(weightKg, reps);
  const main = and(eq(sets.workoutId, workoutId), eq(sets.exerciseId, exerciseId), isNull(sets.parentSetId));
  let parent: { id: number; setNo: number } | undefined;
  if (o.drop) {
    parent = db.select().from(sets).where(main).orderBy(desc(sets.id)).limit(1).get();
    if (!parent) throw new Error("drop se pehle main set log karo");
  }
  const setNo = parent?.setNo ?? (db.select({ n: sql<number>`count(*)` }).from(sets).where(main).get()?.n ?? 0) + 1;
  return db.insert(sets).values({ workoutId, exerciseId, setNo, weightKg, reps, parentSetId: parent?.id, supersetId: o.supersetId }).returning().get();
}

// Superset round: dono exercises ek saath, same supersetId
export function addRound(workoutId: number, items: { exerciseId: number; weightKg: number; reps: number }[]) {
  if (items.length < 2 || new Set(items.map((i) => i.exerciseId)).size !== items.length) throw new Error("superset ke liye alag exercises chahiye");
  items.forEach((i) => check(i.weightKg, i.reps)); // insert se pehle validate
  const supersetId = (db.select({ m: sql<number>`coalesce(max(${sets.supersetId}), 0)` }).from(sets).get()?.m ?? 0) + 1;
  return db.transaction(() => items.map((i) => addSet(workoutId, i.exerciseId, i.weightKg, i.reps, { supersetId })));
}

// Main set delete ho to uske drops bhi jaate hain
export const deleteSet = (id: number) => db.delete(sets).where(or(eq(sets.id, id), eq(sets.parentSetId, id))).run();

export const getWorkout = (id: number) => db.select().from(workouts).where(eq(workouts.id, id)).get();

export const recentWorkouts = () => db.select().from(workouts).orderBy(desc(workouts.id)).limit(7).all();

// Top-level body parts: label ke parts pehle, baaki baad me
export function orderedBodyParts(label: Label) {
  const top = db.select().from(bodyParts).where(sql`${bodyParts.parentId} is null`).all();
  const first = LABELS[label].parts as readonly string[];
  const rank = (n: string) => (first.includes(n) ? first.indexOf(n) : 99);
  const sorted = top.sort((a, b) => rank(a.name) - rank(b.name));
  return { suggested: sorted.filter((p) => rank(p.name) < 99), others: sorted.filter((p) => rank(p.name) === 99) };
}

// Body part (aur uske children) ki exercises, sub-part ke naam ke saath
export function exercisesOf(bodyPartId: number) {
  const ids = [bodyPartId, ...db.select({ id: bodyParts.id }).from(bodyParts).where(eq(bodyParts.parentId, bodyPartId)).all().map((r) => r.id)];
  return db
    .select({ id: exercises.id, name: exercises.name, part: bodyParts.name })
    .from(exercises)
    .innerJoin(bodyParts, eq(exercises.bodyPartId, bodyParts.id))
    .where(inArray(exercises.bodyPartId, ids))
    .orderBy(bodyParts.id, exercises.id)
    .all();
}

export const getExercise = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get();

// Is exercise ka sabse recent main set (prefill ke liye, drop nahi)
export const lastSet = (exerciseId: number) =>
  db.select().from(sets).where(and(eq(sets.exerciseId, exerciseId), isNull(sets.parentSetId))).orderBy(desc(sets.id)).limit(1).get();

export const workoutSets = (workoutId: number) =>
  db
    .select({ id: sets.id, exerciseId: sets.exerciseId, exercise: exercises.name, setNo: sets.setNo, weightKg: sets.weightKg, reps: sets.reps, parentSetId: sets.parentSetId, supersetId: sets.supersetId })
    .from(sets)
    .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
    .where(eq(sets.workoutId, workoutId))
    .orderBy(sets.id)
    .all();

// Drop mode ka prefill: is workout me exercise ka latest set (drop ya main)
export const latestInWorkout = (workoutId: number, exerciseId: number) =>
  db.select().from(sets).where(and(eq(sets.workoutId, workoutId), eq(sets.exerciseId, exerciseId))).orderBy(desc(sets.id)).limit(1).get();
