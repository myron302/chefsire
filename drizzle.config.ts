// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  // Where Drizzle will write migration files
  out: "server/drizzle",

  // Tell Drizzle about ALL schema sources (keep your shared schema + add server/db tables)
  schema: [
    "./shared/schema.ts",
    "server/db/*.ts",
    "server/db/competitions.ts",
  ],

  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },

  // Optional helpful flags
  verbose: true,
  strict: true,
});
