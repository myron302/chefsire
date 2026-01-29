-- Migration: Create wedding event details table
-- Created: 2026-01-29
-- Purpose: Store wedding planning details (partner names, venues, dates) for sync across devices

CREATE TABLE IF NOT EXISTS wedding_event_details (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user who is planning the wedding
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Partner names
  partner1_name VARCHAR(255),
  partner2_name VARCHAR(255),

  -- Ceremony details
  ceremony_date DATE,
  ceremony_time TIME,
  ceremony_location TEXT,

  -- Reception details
  reception_date DATE,
  reception_time TIME,
  reception_location TEXT,
  use_same_location BOOLEAN DEFAULT false,

  -- Wedding message and template
  custom_message TEXT,
  selected_template VARCHAR(50) DEFAULT 'elegant',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  -- Ensure one wedding event per user
  UNIQUE(user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS wed_user_idx ON wedding_event_details(user_id);
