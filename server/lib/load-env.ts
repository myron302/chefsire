// server/lib/load-env.ts
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// If Plesk didn't inject env into NPM scripts, fall back to /httpdocs/server/.env
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, "../.env"); // -> /httpdocs/server/.env
  try {
    require("dotenv").config({ path: envPath });
  } catch {}
}
