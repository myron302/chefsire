// server/scripts/db-ping.ts
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (from .env or env vars).");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: url });
  try {
    const r = await pool.query("select version() as version, 1 as ok");
    console.log(JSON.stringify({ ok: true, result: r.rows[0] }, null, 2));
  } catch (e: any) {
    console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}
main();
