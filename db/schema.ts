import { index, integer, real, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
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

// Workouts/sets: id client banata hai (offline), updatedAt = last-write-wins, deletedAt = tombstone,
// rev = server ka sync cursor (har write pe unique, badhta hua)
export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  label: text("label", { enum: LABEL_KEYS }).notNull(),
  notes: text("notes"),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
  rev: integer("rev").notNull().default(0),
}, (t) => [index("workouts_rev").on(t.rev)]);

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id").notNull().references(() => workouts.id),
  exerciseId: integer("exercise_id").notNull().references(() => exercises.id),
  setNo: integer("set_no").notNull(),
  weightKg: real("weight_kg").notNull(),
  reps: integer("reps").notNull(),
  // Drop set: parent main set ka id (drop = parent ke baad bina rest ke kam weight)
  parentSetId: text("parent_set_id").references((): AnySQLiteColumn => sets.id),
  // Superset: ek round ke dono sets ka same id
  supersetId: text("superset_id"),
  note: text("note"), // optional, edit se hi set hota hai
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
  rev: integer("rev").notNull().default(0),
}, (t) => [index("sets_rev").on(t.rev), index("sets_exercise").on(t.exerciseId)]);

// Single row (id=1): global rev counter
export const syncState = sqliteTable("sync_state", {
  id: integer("id").primaryKey(),
  rev: integer("rev").notNull(),
});
