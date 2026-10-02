import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local: file:lift.db — Vercel pe Turso URL + token env se
export const client = createClient({
  url: process.env.DATABASE_URL ?? "file:lift.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
export const db = drizzle(client, { schema });
