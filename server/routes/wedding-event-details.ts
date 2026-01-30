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

    return res.json({ ok: true, details: details || null });
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
    } = req.body;

    // Prepare the values object. Undefined properties will be stored as null.
    const values = {
      userId,
      partner1Name: partner1Name || null,
      partner2Name: partner2Name || null,
      ceremonyDate: ceremonyDate || null,
      ceremonyTime: ceremonyTime || null,
      ceremonyLocation: ceremonyLocation || null,
      receptionDate: receptionDate || null,
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
