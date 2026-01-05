-- 20260104_follow_requests_private_accounts.sql
-- Adds private accounts + follow requests

ALTER TABLE IF EXISTS "users"
  ADD COLUMN IF NOT EXISTS "is_private" boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS "follow_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "requester_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "target_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now(),
  "responded_at" timestamp
);

CREATE INDEX IF NOT EXISTS "follow_requests_target_id_idx" ON "follow_requests" ("target_id");
CREATE INDEX IF NOT EXISTS "follow_requests_requester_id_idx" ON "follow_requests" ("requester_id");

-- Only one pending request per pair
CREATE UNIQUE INDEX IF NOT EXISTS "follow_requests_pending_unique_idx"
  ON "follow_requests" ("requester_id", "target_id")
  WHERE status = 'pending';
