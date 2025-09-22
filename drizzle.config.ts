import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "your-database-1-connection-string-here";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts", 
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
