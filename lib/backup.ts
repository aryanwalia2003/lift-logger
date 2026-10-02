import { eq, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { db as Db } from "@/db";
import { bodyParts, exercises, sets, syncState, workouts } from "@/db/schema";

type DB = typeof Db;

// Poora data JSON me (ids ke saath, taaki relations same rahein)
export async function dump(db: DB) {
  return {
    version: 1,
    at: new Date().toISOString(),
    bodyParts: await db.select().from(bodyParts).orderBy(bodyParts.id),
    exercises: await db.select().from(exercises).orderBy(exercises.id),
    workouts: await db.select().from(workouts).orderBy(workouts.id),
    sets: await db.select().from(sets).orderBy(sets.id), // parent drop set pehle (chhota id)
  };
}
export type Dump = Awaited<ReturnType<typeof dump>>;

const insertAll = async <T extends SQLiteTable>(db: DB, table: T, rows: T["$inferInsert"][]) => {
  for (let i = 0; i < rows.length; i += 100) await db.insert(table).values(rows.slice(i, i + 100));
};

// Sirf migrated + khali DB me (seed mat chalao — ids dump se aayenge)
export async function restore(db: DB, d: Dump) {
  for (const t of [bodyParts, exercises, workouts, sets]) {
    if (((await db.select({ n: sql<number>`count(*)` }).from(t).get())?.n ?? 0) > 0) throw new Error("Target database is not empty");
  }
  await insertAll(db, bodyParts, d.bodyParts);
  await insertAll(db, exercises, d.exercises);
  await insertAll(db, workouts, d.workouts);
  await insertAll(db, sets, d.sets);
  // Sync counter kabhi rows ke rev se peeche na ho, warna clients naye rows miss karenge
  const maxRev = Math.max(0, ...d.workouts.map((r) => r.rev), ...d.sets.map((r) => r.rev));
  await db.update(syncState).set({ rev: sql`max(${syncState.rev}, ${maxRev})` }).where(eq(syncState.id, 1));
}
