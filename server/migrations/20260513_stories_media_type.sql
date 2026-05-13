ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

ALTER TABLE stories
  DROP CONSTRAINT IF EXISTS stories_media_type_check;

ALTER TABLE stories
  ADD CONSTRAINT stories_media_type_check CHECK (media_type IN ('image', 'video'));
