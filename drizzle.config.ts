// drizzle.config.ts (ESM-safe)
import { defineConfig } from "drizzle-kit";
import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback for Plesk NPM scripts: load /httpdocs/server/.env
dotenv({ path: path.resolve(__dirname, "server/.env") });

let DATABASE_URL = (process.env.DATABASE_URL || "").trim();
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it in Plesk (Node.js → Custom environment variables) " +
    "or create /httpdocs/server/.env with DATABASE_URL=... for scripts."
  );
}

// Ensure Neon SSL is required
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
