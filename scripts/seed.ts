import { db } from "@/db";
import { seed } from "@/db/seed";

seed(db);
console.log("seeded");
