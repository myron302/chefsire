// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { 
    url: DATABASE_URL 
  },
});
