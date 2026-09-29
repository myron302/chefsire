-- P2-01: meal-plan purchases historically had no payment-provider boundary.
-- Preserve every row, but stop treating unverifiable history as captured.
ALTER TABLE meal_plan_purchases
  ALTER COLUMN payment_status SET DEFAULT 'unverified';

UPDATE meal_plan_purchases
SET payment_status = 'legacy_unverified'
WHERE payment_status = 'completed';
