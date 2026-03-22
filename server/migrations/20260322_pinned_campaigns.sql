ALTER TABLE creator_campaigns
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS creator_campaigns_single_pinned_idx
ON creator_campaigns (creator_user_id)
WHERE is_pinned = true;
