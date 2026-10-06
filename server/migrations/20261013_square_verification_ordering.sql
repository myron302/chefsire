-- Phase 2Q Gate 0 repair: deterministic ordering of Square verification writes for ONE credential generation.
--
-- ADDITIVE ONLY: two nullable-free columns with defaults; nothing existing is altered. Older application versions never touch them
-- (they keep their defaults), so a rolling deploy is unaffected.
--
-- credential_generation already stops a stale verification from overwriting a NEW credential. Two verifications of the SAME generation
-- could still race: the older provider observation could be written after a newer one. Each verification therefore takes a ticket
-- (verification_attempt = verification_attempt + 1, a short statement made BEFORE the provider calls, so no row lock is held across the
-- network) and its write is applied only while verification_applied < ticket, then sets verification_applied = ticket. The newest
-- attempt to finish wins and an older one can never overwrite a newer one's facts.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS verification_attempt bigint NOT NULL DEFAULT 0;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS verification_applied bigint NOT NULL DEFAULT 0;
