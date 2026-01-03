-- Migration: Add follow requests and private accounts support
-- Created: 2026-01-03

-- Add is_private column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Create follow_requests table
CREATE TABLE IF NOT EXISTS follow_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS fr_requester_idx ON follow_requests(requester_id);
CREATE INDEX IF NOT EXISTS fr_requested_idx ON follow_requests(requested_id);
CREATE INDEX IF NOT EXISTS fr_status_idx ON follow_requests(status);

-- Add comments for documentation
COMMENT ON COLUMN users.is_private IS 'Whether the user account is private (requires follow requests)';
COMMENT ON TABLE follow_requests IS 'Follow requests for private accounts';
COMMENT ON COLUMN follow_requests.status IS 'Request status: pending, accepted, or rejected';
