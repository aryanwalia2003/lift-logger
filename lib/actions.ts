"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addRound, addSet, createWorkout, deleteSet } from "./workouts";
import type { Label } from "./catalog";

export async function startWorkout(fd: FormData) {
  redirect(`/workout/${(await createWorkout(fd.get("label") as Label)).id}`);
}

export async function logSet(fd: FormData) {
  const workoutId = Number(fd.get("workoutId"));
  await addSet(workoutId, Number(fd.get("exerciseId")), Number(fd.get("weight")), Number(fd.get("reps")));
  revalidatePath(`/workout/${workoutId}`);
}

export async function logDrop(fd: FormData) {
  const workoutId = Number(fd.get("workoutId"));
  await addSet(workoutId, Number(fd.get("exerciseId")), Number(fd.get("weight")), Number(fd.get("reps")), { drop: true });
  revalidatePath(`/workout/${workoutId}`);
}

export async function logSuperset(fd: FormData) {
  const workoutId = Number(fd.get("workoutId"));
  await addRound(workoutId, (["a", "b"] as const).map((k) => ({
    exerciseId: Number(fd.get(`exercise_${k}`)), weightKg: Number(fd.get(`weight_${k}`)), reps: Number(fd.get(`reps_${k}`)),
  })));
  revalidatePath(`/workout/${workoutId}`);
}

export async function removeSet(fd: FormData) {
  await deleteSet(Number(fd.get("setId")));
  revalidatePath(`/workout/${Number(fd.get("workoutId"))}`);
}
