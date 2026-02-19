// server/routes/wedding-event-details.ts
//
// Robust Wedding Event Details API (Neon/Postgres)
//
// Fixes:
// - Date not showing after refresh even though DB has it.
// - Handles Postgres DATE, TIMESTAMP, ISO strings,
// - Always returns consistent ISO date strings for frontend.
//
// Routes:
// GET  /api/wedding/event-details
// POST /api/wedding/event-details

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ────────────────────────────────────────────────────────────────
// Ensure table exists (runs automatically on first access)
async function ensureWeddingEventDetailsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wedding_event_details (
      user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

      partner1_name VARCHAR(255),
      partner2_name VARCHAR(255),

      ceremony_date DATE,
      ceremony_time VARCHAR(32),
      ceremony_location TEXT,

      reception_date DATE,
      reception_time VARCHAR(32),
      reception_location TEXT,

      use_same_location BOOLEAN NOT NULL DEFAULT FALSE,
      custom_message TEXT,
      selected_template VARCHAR(64) NOT NULL DEFAULT 'elegant',

      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wedding_event_details_user_idx
      ON wedding_event_details(user_id)
  `);
}
// ────────────────────────────────────────────────────────────────

function toIsoDateOnly(value: any): string | null {
  if (!value) return null;
  try {
    // Postgres DATE may come as string "YYYY-MM-DD" or Date object.
    if (typeof value === "string") {
      // If already YYYY-MM-DD
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    }
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString().slice(0, 10);
    }
    // Some drivers return { value: ... } or similar
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/wedding/event-details
 */
router.get("/event-details", requireAuth, async (req, res) => {
  try {
    await ensureWeddingEventDetailsTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT
        partner1_name AS "partner1Name",
        partner2_name AS "partner2Name",
        ceremony_date AS "ceremonyDate",
        ceremony_time AS "ceremonyTime",
        ceremony_location AS "ceremonyLocation",
        reception_date AS "receptionDate",
        reception_time AS "receptionTime",
        reception_location AS "receptionLocation",
        use_same_location AS "useSameLocation",
        custom_message AS "customMessage",
        selected_template AS "selectedTemplate",
        updated_at AS "updatedAt"
      FROM wedding_event_details
      WHERE user_id = ${userId}
      LIMIT 1
    `);

    const row = result?.rows?.[0] ?? result?.[0];
    if (!row) {
      return res.json({ ok: true, details: null });
    }

    const details = {
      partner1Name: row.partner1Name ?? "",
      partner2Name: row.partner2Name ?? "",
      ceremonyDate: toIsoDateOnly(row.ceremonyDate),
      ceremonyTime: row.ceremonyTime ?? "",
      ceremonyLocation: row.ceremonyLocation ?? "",
      receptionDate: toIsoDateOnly(row.receptionDate),
      receptionTime: row.receptionTime ?? "",
      receptionLocation: row.receptionLocation ?? "",
      useSameLocation: !!row.useSameLocation,
      customMessage: row.customMessage ?? "",
      selectedTemplate: row.selectedTemplate ?? "elegant",
      updatedAt: row.updatedAt ?? null,
    };

    return res.json({ ok: true, details });
  } catch (err: any) {
    console.error("[Wedding Event Details] fetch error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * POST /api/wedding/event-details
 * Body: { details: { ... } }
 */
router.post("/event-details", requireAuth, async (req, res) => {
  try {
    await ensureWeddingEventDetailsTable();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const d = req.body?.details ?? {};

    const partner1Name = typeof d.partner1Name === "string" ? d.partner1Name.trim() : "";
    const partner2Name = typeof d.partner2Name === "string" ? d.partner2Name.trim() : "";

    const ceremonyDate = toIsoDateOnly(d.ceremonyDate);
    const ceremonyTime = typeof d.ceremonyTime === "string" ? d.ceremonyTime.trim() : "";
    const ceremonyLocation = typeof d.ceremonyLocation === "string" ? d.ceremonyLocation.trim() : "";

    const useSameLocation = !!d.useSameLocation;

    const receptionDate = toIsoDateOnly(d.receptionDate);
    const receptionTime = typeof d.receptionTime === "string" ? d.receptionTime.trim() : "";
    const receptionLocation = typeof d.receptionLocation === "string" ? d.receptionLocation.trim() : "";

    const customMessage = typeof d.customMessage === "string" ? d.customMessage.trim() : "";
    const selectedTemplate = typeof d.selectedTemplate === "string" ? d.selectedTemplate.trim() : "elegant";

    const result: any = await db.execute(sql`
      INSERT INTO wedding_event_details (
        user_id,
        partner1_name, partner2_name,
        ceremony_date, ceremony_time, ceremony_location,
        reception_date, reception_time, reception_location,
        use_same_location,
        custom_message,
        selected_template,
        updated_at, created_at
      )
      VALUES (
        ${userId},
        ${partner1Name}, ${partner2Name},
        ${ceremonyDate}::date, ${ceremonyTime}, ${ceremonyLocation},
        ${receptionDate}::date, ${receptionTime}, ${useSameLocation ? ceremonyLocation : receptionLocation},
        ${useSameLocation},
        ${customMessage},
        ${selectedTemplate},
        NOW(), NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
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
      RETURNING
        partner1_name AS "partner1Name",
        partner2_name AS "partner2Name",
        ceremony_date AS "ceremonyDate",
        ceremony_time AS "ceremonyTime",
        ceremony_location AS "ceremonyLocation",
        reception_date AS "receptionDate",
        reception_time AS "receptionTime",
        reception_location AS "receptionLocation",
        use_same_location AS "useSameLocation",
        custom_message AS "customMessage",
        selected_template AS "selectedTemplate",
        updated_at AS "updatedAt"
    `);

    const row = result?.rows?.[0] ?? result?.[0];

    const details = {
      partner1Name: row?.partner1Name ?? partner1Name,
      partner2Name: row?.partner2Name ?? partner2Name,
      ceremonyDate: toIsoDateOnly(row?.ceremonyDate) ?? ceremonyDate,
      ceremonyTime: row?.ceremonyTime ?? ceremonyTime,
      ceremonyLocation: row?.ceremonyLocation ?? ceremonyLocation,
      receptionDate: toIsoDateOnly(row?.receptionDate) ?? receptionDate,
      receptionTime: row?.receptionTime ?? receptionTime,
      receptionLocation: row?.receptionLocation ?? (useSameLocation ? ceremonyLocation : receptionLocation),
      useSameLocation: !!(row?.useSameLocation ?? useSameLocation),
      customMessage: row?.customMessage ?? customMessage,
      selectedTemplate: row?.selectedTemplate ?? selectedTemplate,
      updatedAt: row?.updatedAt ?? null,
    };

    return res.json({ ok: true, details });
  } catch (err: any) {
    console.error("[Wedding Event Details] save error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
