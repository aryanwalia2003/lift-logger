import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export const sqlite = new Database(process.env.DB_FILE ?? "lift.db");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });
