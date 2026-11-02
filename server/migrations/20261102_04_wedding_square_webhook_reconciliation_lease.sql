-- Fair bounded claim metadata; no acknowledgement or financial evidence change.
ALTER TABLE wedding_square_webhook_events
  ADD COLUMN IF NOT EXISTS last_reconciliation_attempt_at timestamptz;
