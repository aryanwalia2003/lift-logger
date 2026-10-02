import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso", // local file: URL aur Turso dono chalte hain
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:lift.db", authToken: process.env.DATABASE_AUTH_TOKEN },
});
