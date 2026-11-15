-- Part 3b draft only. DO NOT RUN on production without explicit owner approval,
-- privacy/retention signoff, backup branch, and reviewed transactional closure code.
--
-- Durable candidate cleanup queue, deliberately not an executable deletion queue:
-- no worker is registered until the complete shared-reference inventory exists.
-- A closure transaction may enqueue candidates; this schema does not authorize
-- deleting a byte from local uploads, R2 or backups.
BEGIN;
CREATE TABLE IF NOT EXISTS closure_media_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closed_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_provider varchar(16) NOT NULL
    CHECK (storage_provider IN ('local', 'r2')),
  storage_key text NOT NULL,
  object_class varchar(24) NOT NULL
    CHECK (object_class IN ('ordinary_dm_attachment', 'profile_avatar', 'ordinary_post_media', 'unpurchased_product_media')),
  state varchar(20) NOT NULL DEFAULT 'candidate'
    CHECK (state IN ('candidate', 'retain', 'approved', 'deleted', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code varchar(60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  deleted_at timestamptz,
  UNIQUE (closed_user_id, storage_provider, storage_key, object_class)
);
CREATE INDEX IF NOT EXISTS closure_media_candidates_pending_idx
  ON closure_media_candidates (created_at, id)
  WHERE state = 'candidate';
COMMIT;
