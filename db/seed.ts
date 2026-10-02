import { eq } from "drizzle-orm";
import type { db as Db } from "./index";
import { bodyParts, exercises } from "./schema";
import { BODY_PARTS, EXERCISES } from "@/lib/catalog";

// Idempotent — dobara chalane se duplicate nahi banta
export async function seed(db: typeof Db) {
  const id = async (name: string) => (await db.select().from(bodyParts).where(eq(bodyParts.name, name)).get())!.id;
  for (const p of BODY_PARTS.filter((p) => !p.parent)) await db.insert(bodyParts).values({ name: p.name }).onConflictDoNothing();
  for (const p of BODY_PARTS.filter((p) => p.parent)) await db.insert(bodyParts).values({ name: p.name, parentId: await id(p.parent!) }).onConflictDoNothing();
  for (const [part, names] of Object.entries(EXERCISES)) {
    const bodyPartId = await id(part);
    await db.insert(exercises).values(names.map((name) => ({ name, bodyPartId }))).onConflictDoNothing();
  }
}
