// server/routes/wedding-event-details.ts
//
// Robust Wedding Event Details API (Neon/Postgres)
//
// Fixes:
// - Date not showing after refresh even though DB has it.
// - Handles Postgres DATE, TIMESTAMP, ISO strings, and even "mashed" strings
//   that contain a date somewhere inside (extracts YYYY-MM-DD anywhere).
// - Avoids Drizzle timestamp serialization issues by inserting DATE strings
//   and casting to DATE in SQL.
//
// This file uses raw SQL via drizzle-orm `sql` so it does NOT depend on
// a Drizzle table export in shared/schema.ts.

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** Extracts YYYY-MM-DD from many formats (including embedded in a longer string). */
function normalizeDateToYMD(value: unknown): string | null {
  if (!value) return null;

  // Date object
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return null;
    return value.toISOString().slice(0, 10);
  }

  // String-like
  const s = String(value).trim();
  if (!s) return null;

  // Exact YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO with time
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // Postgres timestamp: "YYYY-MM-DD HH:MM:SS" (optionally with tz)
  const pgMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s/);
  if (pgMatch) return pgMatch[1];

  // Embedded date anywhere in the string (handles accidental concatenation)
  const embedded = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (embedded) return embedded[1];

  // Last resort: Date parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

/**
 * Convert YYYY-MM-DD to a safe string for DATE columns.
 * Returns null for invalid inputs.
 */
function normalizeInputDate(value: unknown): string | null {
  const ymd = normalizeDateToYMD(value);
  if (!ymd) return null;
  // Guard: ensure it is really YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/**
 * GET /api/wedding/event-details
 */
router.get("/event-details", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    // NOTE: column names below match the CREATE TABLE we discussed earlier.
    const result: any = await db.execute(sql`
      SELECT
        user_id              AS "userId",
        partner1_name        AS "partner1Name",
        partner2_name        AS "partner2Name",
        ceremony_date        AS "ceremonyDate",
        ceremony_time        AS "ceremonyTime",
        ceremony_location    AS "ceremonyLocation",
        reception_date       AS "receptionDate",
        reception_time       AS "receptionTime",
        reception_location   AS "receptionLocation",
        use_same_location    AS "useSameLocation",
        custom_message       AS "customMessage",
        selected_template    AS "selectedTemplate",
        created_at           AS "createdAt",
        updated_at           AS "updatedAt"
      FROM wedding_event_details
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0] ?? null;
    if (!row) return res.json({ ok: true, details: null });

    // Normalize dates for <input type="date">
    const details = {
      ...row,
      ceremonyDate: normalizeDateToYMD(row.ceremonyDate),
      receptionDate: normalizeDateToYMD(row.receptionDate),
    };

    return res.json({ ok: true, details });
  } catch (err: any) {
    console.error("[Wedding Planning] fetch event details error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * POST /api/wedding/event-details
 */
router.post("/event-details", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const {
      partner1Name,
      partner2Name,
      ceremonyDate,
      ceremonyTime,
      ceremonyLocation,
      receptionDate,
      receptionTime,
      receptionLocation,
      useSameLocation,
      customMessage,
      selectedTemplate,
    } = req.body ?? {};

    // For DATE columns, store YYYY-MM-DD strings and cast to date in SQL.
    const ceremonyDateYMD = normalizeInputDate(ceremonyDate);
    const receptionDateYMD = normalizeInputDate(receptionDate);

    await db.execute(sql`
      INSERT INTO wedding_event_details (
        user_id,
        partner1_name,
        partner2_name,
        ceremony_date,
        ceremony_time,
        ceremony_location,
        reception_date,
        reception_time,
        reception_location,
        use_same_location,
        custom_message,
        selected_template,
        updated_at
      ) VALUES (
        ${userId},
        ${partner1Name ?? null},
        ${partner2Name ?? null},
        ${ceremonyDateYMD}::date,
        ${ceremonyTime ?? null},
        ${ceremonyLocation ?? null},
        ${receptionDateYMD}::date,
        ${receptionTime ?? null},
        ${receptionLocation ?? null},
        ${typeof useSameLocation === "boolean" ? useSameLocation : null},
        ${customMessage ?? null},
        ${selectedTemplate ?? null},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        partner1_name = EXCLUDED.partner1_name,
        partner2_name = EXCLUDED.partner2_name,
        ceremony_date = EXCLUDED.ceremony_date,
        ceremony_time = EXCLUDED.ceremony_time,
        ceremony_location = EXCLUDED.ceremony_location,
        reception_date = EXCLUDED.reception_date,
        reception_time = EXCLUDED.reception_time,
        reception_location = EXCLUDED.reception_location,
        use_same_location = EXCLUDED.use_same_location,
        custom_message = EXCLUDED.custom_message,
        selected_template = EXCLUDED.selected_template,
        updated_at = NOW()
    `);

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Wedding Planning] save event details error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
