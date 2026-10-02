import type { db as Db } from "./index";
import { bodyParts, exercises } from "./schema";
import { EXERCISE_ROWS, PART_ROWS } from "@/lib/catalog";

// Catalog ids code se aate hain (client ke saath same) — idempotent
export async function seed(db: typeof Db) {
  await db.insert(bodyParts).values(PART_ROWS).onConflictDoNothing(); // top-level pehle (FK)
  await db.insert(exercises).values(EXERCISE_ROWS).onConflictDoNothing();
}
