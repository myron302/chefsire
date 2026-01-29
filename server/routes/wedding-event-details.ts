// server/routes/wedding-event-details.ts
// API endpoints for saving/loading wedding event details across devices

import { Router } from 'express';
import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { weddingEventDetails } from '../../shared/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get wedding event details for the logged-in user
router.get('/wedding/event-details', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

    const [details] = await db
      .select()
      .from(weddingEventDetails)
      .where(eq(weddingEventDetails.userId, userId))
      .limit(1);

    if (!details) {
      return res.json({ ok: true, details: null });
    }

    res.json({
      ok: true,
      details: {
        partner1Name: details.partner1Name,
        partner2Name: details.partner2Name,
        ceremonyDate: details.ceremonyDate,
        ceremonyTime: details.ceremonyTime,
        ceremonyLocation: details.ceremonyLocation,
        receptionDate: details.receptionDate,
        receptionTime: details.receptionTime,
        receptionLocation: details.receptionLocation,
        useSameLocation: details.useSameLocation,
        customMessage: details.customMessage,
        selectedTemplate: details.selectedTemplate,
      },
    });
  } catch (error) {
    console.error('Failed to fetch wedding event details:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch wedding event details' });
  }
});

// Save/update wedding event details for the logged-in user
router.post('/wedding/event-details', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' });
    }

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

    await db
      .insert(weddingEventDetails)
      .values({
        userId,
        partner1Name: partner1Name || null,
        partner2Name: partner2Name || null,
        ceremonyDate: ceremonyDate || null,
        ceremonyTime: ceremonyTime || null,
        ceremonyLocation: ceremonyLocation || null,
        receptionDate: receptionDate || null,
        receptionTime: receptionTime || null,
        receptionLocation: receptionLocation || null,
        useSameLocation: useSameLocation || false,
        customMessage: customMessage || null,
        selectedTemplate: selectedTemplate || 'elegant',
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: weddingEventDetails.userId,
        set: {
          partner1Name: partner1Name || null,
          partner2Name: partner2Name || null,
          ceremonyDate: ceremonyDate || null,
          ceremonyTime: ceremonyTime || null,
          ceremonyLocation: ceremonyLocation || null,
          receptionDate: receptionDate || null,
          receptionTime: receptionTime || null,
          receptionLocation: receptionLocation || null,
          useSameLocation: useSameLocation || false,
          customMessage: customMessage || null,
          selectedTemplate: selectedTemplate || 'elegant',
          updatedAt: sql`now()`,
        },
      });

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to save wedding event details:', error);
    res.status(500).json({ ok: false, error: 'Failed to save wedding event details' });
  }
});

export default router;
