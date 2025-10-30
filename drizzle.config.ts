// drizzle.config.ts
import "dotenv/config";             // ⬅️ ensures DATABASE_URL loads when running drizzle-kit
import { defineConfig } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  // Include BOTH schemas (social + DMs)
  schema: ["./shared/schema.ts", "./shared/schema.dm.ts"],  // ⬅️ add dm schema
  // (alt: schema: "./shared/schema*.ts" works too)

  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
