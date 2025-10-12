// server/scripts/print-env.ts
import "../lib/load-env";

console.log({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: !!process.env.DATABASE_URL,
});
