import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DAY_TYPES, EXERCISE_LIST } from "@/lib/exercises";

// Ek din ek workout
export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  day: text("day", { enum: DAY_TYPES }).notNull(),
  notes: text("notes"),
});

export const sets = sqliteTable("sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exercise: text("exercise", { enum: EXERCISE_LIST }).notNull(),
  setNo: integer("set_no").notNull(),
  weightKg: real("weight_kg").notNull(),
  reps: integer("reps").notNull(),
});
