// server/routes/wedding-calendar-events.ts
//
// Wedding Planning Calendar Events API (Neon/Postgres)

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

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];

  const pgMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s/);
  if (pgMatch) return pgMatch[1];

  const embedded = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (embedded) return embedded[1];

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

function normalizeInputDate(value: unknown): string | null {
  const ymd = normalizeDateToYMD(value);
  if (!ymd) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
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

    const rows = result?.rows ?? result ?? [];
    const events = rows.map((row: any) => ({
      ...row,
      eventDate: normalizeDateToYMD(row.eventDate),
    }));

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

    const { eventDate, eventTime, title, type, notes, reminder } = req.body ?? {};

    const eventDateYMD = normalizeInputDate(eventDate);
    if (!eventDateYMD) {
      return res.status(400).json({ ok: false, error: "Invalid event date" });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, error: "Title is required" });
    }
    if (!type || !String(type).trim()) {
      return res.status(400).json({ ok: false, error: "Type is required" });
    }

    // Optional time (HH:MM). Leave empty for all-day style tasks.
    if (eventTime != null && String(eventTime).trim() !== "") {
      const t = String(eventTime).trim();
      if (!/^\d{2}:\d{2}$/.test(t)) {
        return res.status(400).json({ ok: false, error: "Invalid event time" });
      }
    }

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
        ${eventTime != null && String(eventTime).trim() !== "" ? String(eventTime).trim() : null},
        ${String(title).trim()},
        ${String(type).trim()},
        ${notes ? String(notes).trim() : null},
        ${typeof reminder === "boolean" ? reminder : false}
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
    if (!row) {
      return res.status(500).json({ ok: false, error: "Failed to save event" });
    }

    return res.json({
      ok: true,
      event: {
        ...row,
        eventDate: normalizeDateToYMD(row.eventDate),
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
    if (!Number.isFinite(eventId)) {
      return res.status(400).json({ ok: false, error: "Invalid event id" });
    }

    const result: any = await db.execute(sql`
      DELETE FROM wedding_calendar_events
      WHERE id = ${eventId} AND user_id = ${userId}
      RETURNING id
    `);

    const deleted = result?.rows?.[0] ?? result?.[0];
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Event not found" });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[Wedding Planning] delete calendar event error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
});

export default router;
