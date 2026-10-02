import { integer, real, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { LABEL_KEYS } from "@/lib/catalog";

export const bodyParts = sqliteTable("body_parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  parentId: integer("parent_id").references((): AnySQLiteColumn => bodyParts.id), // shoulders → front/side delt
});

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  bodyPartId: integer("body_part_id").notNull().references(() => bodyParts.id),
});

// Ek session — label sirf tag hai, exercises par koi rok nahi
export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD
  label: text("label", { enum: LABEL_KEYS }).notNull(),
  notes: text("notes"),
});

export const sets = sqliteTable("sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
  setNo: integer("set_no").notNull(),
  weightKg: real("weight_kg").notNull(),
  reps: integer("reps").notNull(),
  // Drop set: parent main set ka id (drop = parent ke baad bina rest ke kam weight)
  parentSetId: integer("parent_set_id").references((): AnySQLiteColumn => sets.id),
  // Superset: ek round ke dono sets ka same id
  supersetId: integer("superset_id"),
  note: text("note"), // optional, edit se hi set hota hai
});
