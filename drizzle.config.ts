// drizzle.config.ts (pure ESM, no require)
import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Try environment first
let DATABASE_URL = (process.env.DATABASE_URL ?? "").trim();

// 2) Fallback to /httpdocs/server/.env if scripts don't get env vars
if (!DATABASE_URL) {
  const envPath = path.resolve(__dirname, "server/.env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) {
        DATABASE_URL = m[1].trim();
        break;
      }
    }
  }
}

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it in Plesk (Node.js → Custom environment variables) " +
    "or create /httpdocs/server/.env with DATABASE_URL=... for scripts."
  );
}

// Ensure Neon SSL
if (!/[?&]sslmode=/.test(DATABASE_URL)) {
  DATABASE_URL += (DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";
}

export default defineConfig({
  schema: "./server/db/schema/**/*.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
});
