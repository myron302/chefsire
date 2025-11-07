-- Create Direct Messages (DM) tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- DM threads table
CREATE TABLE IF NOT EXISTS dm_threads (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group   BOOLEAN NOT NULL DEFAULT false,
  title      TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DM participants table
CREATE TABLE IF NOT EXISTS dm_participants (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             VARCHAR NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id               VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL DEFAULT 'member',
  last_read_message_id  VARCHAR NULL,
  last_read_at          TIMESTAMPTZ NULL,
  notifications_muted   BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(thread_id, user_id)
);

-- DM messages table
CREATE TABLE IF NOT EXISTS dm_messages (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   VARCHAR NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS dm_threads_is_group_idx ON dm_threads (is_group);
CREATE INDEX IF NOT EXISTS dm_participants_thread_idx ON dm_participants (thread_id);
CREATE INDEX IF NOT EXISTS dm_participants_user_idx ON dm_participants (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS dm_participants_thread_user_uniq ON dm_participants (thread_id, user_id);
CREATE INDEX IF NOT EXISTS dm_messages_thread_idx ON dm_messages (thread_id);
CREATE INDEX IF NOT EXISTS dm_messages_thread_created_idx ON dm_messages (thread_id, created_at);
