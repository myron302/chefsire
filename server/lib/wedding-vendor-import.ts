import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Imports wedding vendors from open business data (server/data/wedding-vendors-ct.json, produced by
 * .github/workflows/vendor-data-preview.yml from Overture Maps Places, which is openly licensed) as UNCLAIMED
 * published listings.
 *
 * - Atomic: one transaction per release. Idempotent: upserts on source_id, each release is imported once
 *   (wedding_vendor_imports marker), and a release older than one already imported is ignored.
 * - Never overwrites a claimed listing (user_id set) and never changes a listing's status on update, so listings
 *   hidden by reports or by an admin stay hidden.
 * - Unclaimed listings that disappear from a newer release (closed businesses) are retired, unless the new file
 *   is much smaller than the last one or the retirement would be unusually large (then nothing is retired).
 * - Set WEDDING_VENDOR_IMPORT=off to disable.
 */

export type OpenVendorRecord = {
  source_id: string;
  business_name: string;
  category?: string;
  website?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
};

/** Retirement guards: skip retiring when the new file is under 80% of the last one, or would retire over 10%. */
export const MIN_RELATIVE_SIZE_FOR_RETIREMENT = 0.8;
export const MAX_RETIRE_FRACTION = 0.1;
const MAX_RETIRE_ABSOLUTE_FLOOR = 5;

export type OpenVendorPayload = { source: string; release: string; listings: OpenVendorRecord[] };

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

/** Business websites in the data sometimes lack a scheme ("www.example.com"); store them as https URLs. */
export function normalizeWebsite(raw: unknown): string | null {
  const v = clip(raw, 500);
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString().slice(0, 512);
  } catch {
    return null;
  }
}

export function normalizeEmail(raw: unknown): string | null {
  const v = clip(raw, 255);
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.toLowerCase() : null;
}

export function toListingRow(rec: OpenVendorRecord) {
  return {
    sourceId: clip(rec.source_id, 64),
    businessName: clip(rec.business_name, 255),
    category: clip(rec.category, 128),
    website: normalizeWebsite(rec.website),
    email: normalizeEmail(rec.email),
    phone: clip(rec.phone, 64),
    street: clip(rec.street, 255),
    city: clip(rec.city, 128),
    state: clip(rec.state, 64),
    postcode: clip(rec.postcode, 16),
    lat: typeof rec.lat === "number" && Number.isFinite(rec.lat) ? rec.lat : null,
    lng: typeof rec.lng === "number" && Number.isFinite(rec.lng) ? rec.lng : null,
  };
}

const DATA_FILE = "wedding-vendors-ct.json";

/** WEDDING_VENDOR_DATA_PATH, else server/data under the working directory, else next to the bundle (server/dist/../data). */
export function defaultDataPath(): string {
  if (process.env.WEDDING_VENDOR_DATA_PATH) return process.env.WEDDING_VENDOR_DATA_PATH;
  const candidates = [path.join(process.cwd(), "server/data", DATA_FILE)];
  try {
    candidates.push(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data", DATA_FILE));
  } catch {
    // import.meta.url unavailable: rely on the working directory.
  }
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export function readOpenVendorPayload(file = defaultDataPath()): OpenVendorPayload | null {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!parsed || typeof parsed.release !== "string" || !Array.isArray(parsed.listings)) return null;
  return parsed as OpenVendorPayload;
}

/** Runs the import for one payload. Assumes wedding_vendor_listings (with the source columns) exists. */
export async function importOpenVendors(payload: OpenVendorPayload): Promise<{ imported: boolean; rows: number; retired: number }> {
  const source = clip(payload.source, 32) || "overture";
  const release = clip(payload.release, 32);
  if (!release) return { imported: false, rows: 0, retired: 0 };

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_vendor_imports (
      source VARCHAR(32) NOT NULL,
      release VARCHAR(32) NOT NULL,
      row_count INTEGER,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMP,
      PRIMARY KEY (source, release)
    )
  `);

  const rows = payload.listings.map(toListingRow).filter((r) => r.sourceId && r.businessName && r.businessName.length >= 2);
  if (rows.length === 0) return { imported: false, rows: 0, retired: 0 };

  // All-or-nothing: the ordering check, the marker, every upsert and the retirement commit together.
  return db.transaction(async (tx: typeof db) => {
    // One import per source at a time, across releases and app instances: the lock is held on this transaction's
    // connection until commit, so the "is this release newer?" check below can't race another import.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"wedding_vendor_import:" + source}))`);

    // Never go backwards: a release older than (or equal to) one already imported is ignored. Overture release
    // names ("2026-10-21.0") sort chronologically as strings.
    const latest: any = await tx.execute(sql`
      SELECT release, row_count AS "rowCount" FROM wedding_vendor_imports
      WHERE source = ${source} AND finished_at IS NOT NULL
      ORDER BY release DESC LIMIT 1
    `);
    const previous = (latest?.rows ?? latest ?? [])[0] as { release: string; rowCount: number | null } | undefined;
    if (previous && previous.release >= release) return { imported: false, rows: 0, retired: 0 };

    // A much smaller file than last time looks like a broken extract, not thousands of closures: import it, but
    // retire nothing. Retirement is also capped per run.
    const previousCount = Number(previous?.rowCount ?? 0);
    const retireAllowed = !previousCount || rows.length >= previousCount * MIN_RELATIVE_SIZE_FOR_RETIREMENT;

    const claimed: any = await tx.execute(sql`
      INSERT INTO wedding_vendor_imports (source, release) VALUES (${source}, ${release})
      ON CONFLICT DO NOTHING RETURNING release
    `);
    if (!(claimed?.rows ?? claimed ?? []).length) return { imported: false, rows: 0, retired: 0 };

    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = chunk.map(
        (r) => sql`(${source}, ${r.sourceId}, ${release}, ${r.businessName}, ${r.category}, ${r.website}, ${r.email}, ${r.phone},
                    ${r.street}, ${r.city}, ${r.state}, ${r.postcode}, ${r.lat}, ${r.lng}, 'basic', 'published', false)`,
      );
      await tx.execute(sql`
        INSERT INTO wedding_vendor_listings (
          source, source_id, source_release, business_name, category, website, email, phone,
          street, city, state, postcode, lat, lng, plan, status, agree
        )
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO UPDATE SET
          source_release = EXCLUDED.source_release,
          business_name = EXCLUDED.business_name,
          category = EXCLUDED.category,
          website = EXCLUDED.website,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          street = EXCLUDED.street,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          postcode = EXCLUDED.postcode,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          updated_at = NOW()
        WHERE wedding_vendor_listings.user_id IS NULL
      `);
    }

    let retiredCount = 0;
    if (retireAllowed) {
      const candidates: any = await tx.execute(sql`
        SELECT count(*)::int AS n,
               (SELECT count(*)::int FROM wedding_vendor_listings WHERE source = ${source} AND user_id IS NULL AND status = 'published') AS total
        FROM wedding_vendor_listings
        WHERE source = ${source} AND user_id IS NULL AND status = 'published'
          AND source_release IS DISTINCT FROM ${release}
      `);
      const { n, total } = (candidates?.rows ?? candidates ?? [])[0] ?? { n: 0, total: 0 };
      if (n > 0 && n <= Math.max(MAX_RETIRE_ABSOLUTE_FLOOR, Math.floor(total * MAX_RETIRE_FRACTION))) {
        const retired: any = await tx.execute(sql`
          UPDATE wedding_vendor_listings
          SET status = 'retired', updated_at = NOW()
          WHERE source = ${source} AND user_id IS NULL AND status = 'published'
            AND source_release IS DISTINCT FROM ${release}
          RETURNING id
        `);
        retiredCount = (retired?.rows ?? retired ?? []).length;
      } else if (n > 0) {
        console.warn(`[Wedding Vendor Import] ${source} ${release}: ${n} of ${total} listings would be retired; over the safety cap, retiring none`);
      }
    } else {
      console.warn(`[Wedding Vendor Import] ${source} ${release}: ${rows.length} rows vs ${previousCount} last release; retiring none`);
    }

    await tx.execute(sql`
      UPDATE wedding_vendor_imports SET row_count = ${rows.length}, finished_at = NOW()
      WHERE source = ${source} AND release = ${release}
    `);
    return { imported: true, rows: rows.length, retired: retiredCount };
  });
}

let scheduled = false;

/** Fire-and-forget import of the bundled data file, at most once per process. Never throws. */
export function scheduleOpenVendorImport(): void {
  if (scheduled || process.env.WEDDING_VENDOR_IMPORT === "off") return;
  scheduled = true;
  setImmediate(async () => {
    try {
      const payload = readOpenVendorPayload();
      if (!payload) return;
      const result = await importOpenVendors(payload);
      if (result.imported) {
        console.log(`[Wedding Vendor Import] ${payload.source} ${payload.release}: ${result.rows} listings upserted, ${result.retired} retired`);
      }
    } catch (err) {
      console.error("[Wedding Vendor Import] failed:", err);
    }
  });
}
