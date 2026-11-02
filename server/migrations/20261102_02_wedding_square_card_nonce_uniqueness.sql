-- An ephemeral Square Web Payments SDK nonce can never be used for two
-- enrollment setup intents, including across different ChefSire owners.
-- The original versioned table migration remains immutable.
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_card_setup_source_digest_idx
  ON wedding_square_card_setup_attempts(square_environment, source_digest);
