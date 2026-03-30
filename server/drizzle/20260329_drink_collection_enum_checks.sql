UPDATE drink_collections
SET access_type = CASE
  WHEN COALESCE(is_premium, false) THEN 'premium_purchase'
  ELSE 'public'
END
WHERE access_type IS NULL
   OR access_type NOT IN ('public', 'premium_purchase', 'membership_only');

UPDATE drink_collection_promotions
SET discount_type = lower(trim(discount_type))
WHERE discount_type IS NOT NULL
  AND discount_type <> lower(trim(discount_type));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drink_collections_access_type_check'
      AND conrelid = 'drink_collections'::regclass
  ) THEN
    ALTER TABLE drink_collections
      ADD CONSTRAINT drink_collections_access_type_check
      CHECK (access_type IN ('public', 'premium_purchase', 'membership_only')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drink_collection_promotions_discount_type_check'
      AND conrelid = 'drink_collection_promotions'::regclass
  ) THEN
    ALTER TABLE drink_collection_promotions
      ADD CONSTRAINT drink_collection_promotions_discount_type_check
      CHECK (discount_type IN ('percent', 'fixed')) NOT VALID;
  END IF;
END $$;
