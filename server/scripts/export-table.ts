// server/scripts/export-table.ts
import { Client } from "pg";
import fs from "fs/promises";
import path from "path";

const table = process.argv[2] || "playing_with_neon";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is missing");

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(`Exporting table: ${table}`);

  const res: any = await client.query(`SELECT * FROM "${table}"`);
  const headers: string[] = res.fields.map((f: any) => f.name);
  const rows: any[] = res.rows;

  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const r of rows) {
    const line = headers.map((h) => csvEscape((r as any)[h]));
    lines.push(line.join(","));
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(process.cwd(), "server", "tmp");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${table}-${ts}.csv`);

  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  await client.end();

  console.log(JSON.stringify({ ok: true, file: outPath, rows: rows.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
