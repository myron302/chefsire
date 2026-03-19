ALTER TABLE drink_collections
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'public';

UPDATE drink_collections
SET access_type = CASE
  WHEN COALESCE(is_premium, false) THEN 'premium_purchase'
  ELSE 'public'
END
WHERE access_type IS NULL
   OR access_type NOT IN ('public', 'premium_purchase', 'membership_only');

ALTER TABLE drink_collections
  ALTER COLUMN access_type SET DEFAULT 'public';
