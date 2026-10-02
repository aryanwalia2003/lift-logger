import Dexie, { type EntityTable } from "dexie";
import type { SetRow, WorkoutRow } from "./types";

// Device ka local replica. dirty=1 → server pe abhi push nahi hua
export type LWorkout = WorkoutRow & { dirty: 0 | 1 };
export type LSet = SetRow & { dirty: 0 | 1 };
export type LMeta = { key: string; value: unknown };

export class LiftDB extends Dexie {
  workouts!: EntityTable<LWorkout, "id">;
  sets!: EntityTable<LSet, "id">;
  meta!: EntityTable<LMeta, "key">;

  constructor(name = "lift-log", options?: ConstructorParameters<typeof Dexie>[1]) {
    super(name, options);
    this.version(1).stores({
      workouts: "id, date, dirty",
      sets: "id, workoutId, exerciseId, dirty",
      meta: "key",
    });
  }
}
