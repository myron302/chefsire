-- Additive lookup metadata only. Existing deliveries stay uncorrelated;
-- never infer an object ID from an event ID or mark any delivery processed.
ALTER TABLE wedding_square_webhook_events
  ADD COLUMN IF NOT EXISTS square_object_id text;
