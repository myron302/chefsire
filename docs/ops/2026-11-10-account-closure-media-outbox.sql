-- Draft-only Part 3b media cleanup ledger. DO NOT APPLY TO PRODUCTION
-- without the owner's explicit schema approval and a retained-data policy.
-- Metadata is written in the SAME transaction as irreversible member closure.
-- No worker is implemented/authorized by this schema. Candidate records are
-- not permission to delete objects: reference checks are still mandatory.

CREATE TABLE IF NOT EXISTS account_closure_media_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_provider varchar(8) NOT NULL,
  object_key text NOT NULL,
  source_kind text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  queued_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_failure_code varchar(80),
  CONSTRAINT account_closure_media_provider_ck CHECK (storage_provider IN ('local','r2')),
  CONSTRAINT account_closure_media_status_ck CHECK (status IN ('pending','held','retry','complete')),
  CONSTRAINT account_closure_media_attempt_count_ck CHECK (attempt_count >= 0),
  CONSTRAINT account_closure_media_key_ck CHECK (length(object_key) BETWEEN 1 AND 1024),
  CONSTRAINT account_closure_media_source_ck CHECK (source_kind IN ('dm','post','avatar','recipe','store','product','other')),
  CONSTRAINT account_closure_media_member_key_uq UNIQUE (member_id, storage_provider, object_key)
);
CREATE INDEX IF NOT EXISTS account_closure_media_pending_idx
  ON account_closure_media_cleanup (queued_at, id) WHERE status IN ('pending','retry');
