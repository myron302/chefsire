// server/routes/wedding-calendar-events.ts
//
// Wedding Planning Calendar Events API (Neon/Postgres)
// Routes are mounted under /api/wedding (typically), so these become:
//  GET    /api/wedding/calendar-events
//  POST   /api/wedding/calendar-events
//  DELETE /api/wedding/calendar-events/:id

import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();

/** Extracts YYYY-MM-DD from many formats (including embedded in a longer string). */
function normalizeDateToYMD(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return null;
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO datetime -> take date
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  // Postgres timestamp string -> take date
  const pgMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s/);
  if (pgMatch) return pgMatch[1];

  // Embedded YYYY-MM-DD inside a longer string
  const embedded = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (embedded) return embedded[1];

  // Last resort: Date parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

function normalizeInputDate(value: unknown): string | null {
  const ymd = normalizeDateToYMD(value);
  if (!ymd) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** Accepts only "HH:MM" 24h time. Returns normalized "HH:MM" or null. */
function normalizeTimeHHMM(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Accept "HH:MM"
  if (!/^\d{2}:\d{2}$/.test(s)) return null;

  const [hhRaw, mmRaw] = s.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;

  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * GET /api/wedding/calendar-events
 */
router.get("/calendar-events", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const result: any = await db.execute(sql`
      SELECT
        id,
        event_date AS "eventDate",
        event_time AS "eventTime",
        title,
        type,
        notes,
        reminder,
        created_at AS "createdAt"
      FROM wedding_calendar_events
      WHERE user_id = ${userId}
      ORDER BY event_date ASC, created_at ASC
    `);

    const rows = (result?.rows ?? result ?? []) as any[];

    const events = rows
      .map((row) => ({
        id: Number(row.id),
        eventDate: normalizeDateToYMD(row.eventDate),
        eventTime: row.eventTime ? String(row.eventTime).slice(0, 5) : "",
        title: row.title ?? "",
        type: row.type ?? "",
        notes: row.notes ?? "",
        reminder: Boolean(row.reminder),
        createdAt: row.createdAt ?? null,
      }))
      .filter((e) => !!e.eventDate); // must have date

    return res.json({ ok: true, events });
  } catch (err: any) {
    console.error("[Wedding Planning] fetch calendar events error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * POST /api/wedding/calendar-events
 */
router.post("/calendar-events", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const body = req.body ?? {};
    const eventDateYMD = normalizeInputDate(body.eventDate);
    const eventTimeHHMM = normalizeTimeHHMM(body.eventTime);

    const title = String(body.title ?? "").trim();
    const type = String(body.type ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const reminder = typeof body.reminder === "boolean" ? body.reminder : false;

    if (!eventDateYMD) return res.status(400).json({ ok: false, error: "Invalid event date" });
    if (!title) return res.status(400).json({ ok: false, error: "Title is required" });
    if (!type) return res.status(400).json({ ok: false, error: "Type is required" });

    const insertResult: any = await db.execute(sql`
      INSERT INTO wedding_calendar_events (
        user_id,
        event_date,
        event_time,
        title,
        type,
        notes,
        reminder
      ) VALUES (
        ${userId},
        ${eventDateYMD}::date,
        ${eventTimeHHMM ? eventTimeHHMM : null},
        ${title},
        ${type},
        ${notes ? notes : null},
        ${reminder}
      )
      RETURNING
        id,
        event_date AS "eventDate",
        event_time AS "eventTime",
        title,
        type,
        notes,
        reminder,
        created_at AS "createdAt"
    `);

    const row = insertResult?.rows?.[0] ?? insertResult?.[0];
    if (!row) return res.status(500).json({ ok: false, error: "Failed to save event" });

    return res.json({
      ok: true,
      event: {
        id: Number(row.id),
        eventDate: normalizeDateToYMD(row.eventDate),
        eventTime: row.eventTime ? String(row.eventTime).slice(0, 5) : "",
        title: row.title ?? "",
        type: row.type ?? "",
        notes: row.notes ?? "",
        reminder: Boolean(row.reminder),
        createdAt: row.createdAt ?? null,
      },
    });
  } catch (err: any) {
    console.error("[Wedding Planning] save calendar event error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

/**
 * DELETE /api/wedding/calendar-events/:id
 */
router.delete("/calendar-events/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: "Not authenticated" });

    const eventId = Number(req.params.id);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid event id" });
    }

    const result: any = await db.execute(sql`
      DELETE FROM wedding_calendar_events
      WHERE id = ${eventId} AND user_id = ${userId}
      RETURNING id
    `);

    const deleted = result?.rows?.[0] ?? result?.[0];
    if (!deleted) return res.status(404).json({ ok: false, error: "Event not found" });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Wedding Planning] delete calendar event error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
