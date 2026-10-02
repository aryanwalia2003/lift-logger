// Poora data backups/lift-<time>.json me. Chalao: pnpm backup
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "@/db";
import { dump } from "@/lib/backup";

dump(db).then((d) => {
  mkdirSync("backups", { recursive: true });
  const file = `backups/lift-${d.at.replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(d));
  console.log(`${file} — ${d.workouts.length} workouts, ${d.sets.length} sets`);
});
