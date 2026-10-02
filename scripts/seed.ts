import { db } from "@/db";
import { seed } from "@/db/seed";

seed(db).then(() => console.log("seeded"));
