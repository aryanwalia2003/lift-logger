// Backup se restore (khali, migrated DB me). Chalao: pnpm restore backups/lift-....json
import { readFileSync } from "node:fs";
import { db } from "@/db";
import { restore } from "@/lib/backup";

const file = process.argv[2];
if (!file) throw new Error("usage: pnpm restore <file.json>");
restore(db, JSON.parse(readFileSync(file, "utf8"))).then(() => console.log("restored"));
