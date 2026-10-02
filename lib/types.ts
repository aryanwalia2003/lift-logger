import type { Label } from "./catalog";

// Sync ke dono taraf ke row shapes (client + server)
export type WorkoutRow = { id: string; date: string; label: Label; notes: string | null; updatedAt: number; deletedAt: number | null };
export type SetRow = {
  id: string; workoutId: string; exerciseId: number; setNo: number; weightKg: number; reps: number;
  parentSetId: string | null; supersetId: string | null; note: string | null; updatedAt: number; deletedAt: number | null;
};
export type SyncRequest = { since: number; workouts: WorkoutRow[]; sets: SetRow[] };
export type SyncResponse = { rev: number; cursor: number; more: boolean; workouts: WorkoutRow[]; sets: SetRow[] };
