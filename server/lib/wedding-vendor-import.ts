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
 * - Idempotent: upserts on source_id, and each data release is imported once (wedding_vendor_imports marker).
 * - Never overwrites a claimed listing (user_id set) and never changes a listing's status on update, so listings
 *   hidden by reports or by an admin stay hidden.
 * - Unclaimed listings that disappear from a newer release (closed businesses) are retired.
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

  // Claim this release; another process (or an earlier boot) that already claimed it wins.
  const claim: any = await db.execute(sql`
    INSERT INTO wedding_vendor_imports (source, release) VALUES (${source}, ${release})
    ON CONFLICT DO NOTHING RETURNING release
  `);
  if (!(claim?.rows ?? claim ?? []).length) return { imported: false, rows: 0, retired: 0 };

  try {
    const rows = payload.listings.map(toListingRow).filter((r) => r.sourceId && r.businessName && r.businessName.length >= 2);
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = chunk.map(
        (r) => sql`(${source}, ${r.sourceId}, ${release}, ${r.businessName}, ${r.category}, ${r.website}, ${r.email}, ${r.phone},
                    ${r.street}, ${r.city}, ${r.state}, ${r.postcode}, ${r.lat}, ${r.lng}, 'basic', 'published', false)`,
      );
      await db.execute(sql`
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

    const retired: any = await db.execute(sql`
      UPDATE wedding_vendor_listings
      SET status = 'retired', updated_at = NOW()
      WHERE source = ${source} AND user_id IS NULL AND status = 'published'
        AND source_release IS DISTINCT FROM ${release}
      RETURNING id
    `);
    const retiredCount = (retired?.rows ?? retired ?? []).length;

    await db.execute(sql`
      UPDATE wedding_vendor_imports SET row_count = ${rows.length}, finished_at = NOW()
      WHERE source = ${source} AND release = ${release}
    `);
    return { imported: true, rows: rows.length, retired: retiredCount };
  } catch (err) {
    // Release the marker so the next boot retries.
    await db.execute(sql`DELETE FROM wedding_vendor_imports WHERE source = ${source} AND release = ${release}`).catch(() => {});
    throw err;
  }
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
