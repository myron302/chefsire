-- Migration: Create wedding RSVP invitations table
-- Created: 2025-12-11

CREATE TABLE IF NOT EXISTS wedding_rsvp_invitations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user who created the wedding event (couple)
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Guest information
  guest_name VARCHAR(255) NOT NULL,
  guest_email VARCHAR(255) NOT NULL,

  -- RSVP token (hashed using SHA-256)
  token_hash VARCHAR(64) NOT NULL UNIQUE,

  -- RSVP status: 'pending', 'accepted', 'declined'
  rsvp_status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Plus one allowed
  plus_one BOOLEAN DEFAULT false,

  -- Optional: Wedding event details
  event_date TIMESTAMP,
  event_location TEXT,
  event_message TEXT,

  -- Token expiry (30 days by default)
  expires_at TIMESTAMP NOT NULL DEFAULT (now() + interval '30 days'),

  -- When the guest responded
  responded_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS wri_user_idx ON wedding_rsvp_invitations(user_id);
CREATE INDEX IF NOT EXISTS wri_token_hash_idx ON wedding_rsvp_invitations(token_hash);
CREATE INDEX IF NOT EXISTS wri_email_idx ON wedding_rsvp_invitations(guest_email);
