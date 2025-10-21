import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema/index.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { 
    url: process.env.DATABASE_URL || ""
  },
});
