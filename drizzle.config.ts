import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from server/.env
config({ path: path.resolve(__dirname, "server/.env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not found in environment");
}

export default defineConfig({
  schema: "./server/db/schema/index.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
