// server/routes/wedding-event-details.ts
//
// This route handles saving and retrieving wedding event details (e.g. partner names,
// ceremony and reception dates/locations, custom messages, and email template) for
// the authenticated user. Separating this logic from wedding-rsvp keeps RSVP
// operations focused on sending invitations and handling responses.

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { weddingEventDetails } from "../../shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Normalize any date-ish value into YYYY-MM-DD for HTML <input type="date">.
// Defensive: if an existing DB row contains an invalid Date (or the driver
// returns an unexpected type), we return null rather than throwing
// "Invalid time value".
function normalizeDateToYMD(value: unknown): string | null {
  if (!value) return null;

  // Drizzle often returns Date for timestamp/date columns
  if (value instanceof Date) {
    try {
      return value.toISOString().split("T")[0];
    } catch {
      return null;
    }
  }

  // Some drivers return strings for timestamp/date columns
  if (typeof value === "string") {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    // Common Postgres string formats that are NOT strict ISO and may not
    // parse reliably with `new Date(...)`, e.g.
    //   "2026-01-31 00:00:00"
    //   "2026-01-31 00:00:00+00"
    // In these cases, the first 10 chars are still the YYYY-MM-DD we need.
    if (/^\d{4}-\d{2}-\d{2}\s/.test(value)) {
      return value.slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}\+/.test(value)) {
      return value.slice(0, 10);
    }

    // ISO-like string
    if (value.includes("T")) {
      const [ymd] = value.split("T");
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    }

    // Fallback parse
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      try {
        return parsed.toISOString().split("T")[0];
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * GET /api/wedding/event-details
 * Retrieve the saved event details for the authenticated user.
 *
 * Response: { ok: boolean; details?: object; error?: string }
 */
router.get("/event-details", requireAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    // Fetch the first (and only) event details record for this user
    const [details] = await db
      .select()
      .from(weddingEventDetails)
      .where(eq(weddingEventDetails.userId, req.user.id))
      .limit(1);

    // Normalize date fields to YYYY-MM-DD strings. Without this transformation,
    // Date objects are serialized to ISO strings with time information
    // (e.g. "2026-02-29T00:00:00.000Z"), which breaks HTML date inputs
    // on the client. Convert to plain date strings so the frontend can
    // display and edit them reliably.
    let normalized: any = null;
    if (details) {
      normalized = { ...details };
      normalized.ceremonyDate = normalizeDateToYMD((details as any).ceremonyDate);
      normalized.receptionDate = normalizeDateToYMD((details as any).receptionDate);
    }

    return res.json({ ok: true, details: normalized });
  } catch (error) {
    console.error("fetch-event-details error:", error);
    return res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

/**
 * POST /api/wedding/event-details
 * Save or update wedding event details for the authenticated user. If a record
 * already exists, it will be updated; otherwise a new record will be inserted.
 *
 * Body: {
 *   partner1Name?: string;
 *   partner2Name?: string;
 *   ceremonyDate?: string; // ISO date (YYYY-MM-DD)
 *   ceremonyTime?: string; // HH:MM
 *   ceremonyLocation?: string;
 *   receptionDate?: string;
 *   receptionTime?: string;
 *   receptionLocation?: string;
 *   useSameLocation?: boolean;
 *   customMessage?: string;
 *   selectedTemplate?: string;
 * }
 *
 * Response: { ok: boolean; error?: string }
 */
router.post("/event-details", requireAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const userId = req.user.id;
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
    } = req.body as {
      partner1Name?: string;
      partner2Name?: string;
      ceremonyDate?: string | null;
      ceremonyTime?: string | null;
      ceremonyLocation?: string | null;
      receptionDate?: string | null;
      receptionTime?: string | null;
      receptionLocation?: string | null;
      useSameLocation?: boolean | null;
      customMessage?: string | null;
      selectedTemplate?: string | null;
    };

    // Convert date strings (YYYY-MM-DD) to Date objects when provided. Drizzle's
    // timestamp columns expect either a Date instance or a value with
    // a toISOString() method. Passing a plain string will cause Drizzle to
    // attempt to call toISOString on it and throw an error. We convert
    // valid date strings into Date objects; empty or invalid values become null.
    let ceremonyDateValue: Date | null = null;
    if (ceremonyDate) {
      const parsed = new Date(ceremonyDate);
      if (!isNaN(parsed.getTime())) {
        ceremonyDateValue = parsed;
      }
    }

    let receptionDateValue: Date | null = null;
    if (receptionDate) {
      const parsed = new Date(receptionDate);
      if (!isNaN(parsed.getTime())) {
        receptionDateValue = parsed;
      }
    }

    // Prepare the values object. Undefined properties will be stored as null.
    const values = {
      userId,
      partner1Name: partner1Name || null,
      partner2Name: partner2Name || null,
      ceremonyDate: ceremonyDateValue,
      ceremonyTime: ceremonyTime || null,
      ceremonyLocation: ceremonyLocation || null,
      receptionDate: receptionDateValue,
      receptionTime: receptionTime || null,
      receptionLocation: receptionLocation || null,
      useSameLocation: typeof useSameLocation === "boolean" ? useSameLocation : null,
      customMessage: customMessage || null,
      selectedTemplate: selectedTemplate || null,
    };

    // Check if a details record already exists for this user
    const [existing] = await db
      .select()
      .from(weddingEventDetails)
      .where(eq(weddingEventDetails.userId, userId))
      .limit(1);

    if (existing) {
      // Update the existing record
      await db
        .update(weddingEventDetails)
        .set(values)
        .where(eq(weddingEventDetails.userId, userId));
    } else {
      // Insert a new record
      await db.insert(weddingEventDetails).values(values);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("save-event-details error:", error);
    return res.status(500).json({ ok: false, error: (error as Error).message });
  }
});

export default router;
