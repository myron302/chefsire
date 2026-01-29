// server/routes/wedding-event-details.ts
// API endpoints for saving/loading wedding event details across devices

import { Router } from 'express';
import { pool } from '../lib/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Get wedding event details for the logged-in user
router.get('/wedding/event-details', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT
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
        selected_template
      FROM wedding_event_details
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.json({ ok: true, details: null });
    }

    const row = result.rows[0];
    res.json({
      ok: true,
      details: {
        partner1Name: row.partner1_name,
        partner2Name: row.partner2_name,
        ceremonyDate: row.ceremony_date,
        ceremonyTime: row.ceremony_time,
        ceremonyLocation: row.ceremony_location,
        receptionDate: row.reception_date,
        receptionTime: row.reception_time,
        receptionLocation: row.reception_location,
        useSameLocation: row.use_same_location,
        customMessage: row.custom_message,
        selectedTemplate: row.selected_template,
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

    await pool.query(
      `INSERT INTO wedding_event_details (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
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
        updated_at = now()`,
      [
        userId,
        partner1Name || null,
        partner2Name || null,
        ceremonyDate || null,
        ceremonyTime || null,
        ceremonyLocation || null,
        receptionDate || null,
        receptionTime || null,
        receptionLocation || null,
        useSameLocation || false,
        customMessage || null,
        selectedTemplate || 'elegant',
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to save wedding event details:', error);
    res.status(500).json({ ok: false, error: 'Failed to save wedding event details' });
  }
});

export default router;
