import { eq } from "drizzle-orm";
import type { db as Db } from "./index";
import { bodyParts, exercises } from "./schema";
import { BODY_PARTS, EXERCISES } from "@/lib/catalog";

// Idempotent — dobara chalane se duplicate nahi banta
export function seed(db: typeof Db) {
  const id = (name: string) => db.select().from(bodyParts).where(eq(bodyParts.name, name)).get()!.id;
  for (const p of BODY_PARTS.filter((p) => !p.parent)) db.insert(bodyParts).values({ name: p.name }).onConflictDoNothing().run();
  for (const p of BODY_PARTS.filter((p) => p.parent)) db.insert(bodyParts).values({ name: p.name, parentId: id(p.parent!) }).onConflictDoNothing().run();
  for (const [part, names] of Object.entries(EXERCISES))
    for (const name of names) db.insert(exercises).values({ name, bodyPartId: id(part) }).onConflictDoNothing().run();
}
