CREATE TABLE IF NOT EXISTS creator_collaborations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collaborator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collaboration_type text NOT NULL,
  target_id varchar(200) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_collaborations_owner_collaborator_target_idx UNIQUE (
    owner_creator_user_id,
    collaborator_user_id,
    collaboration_type,
    target_id
  )
);

CREATE INDEX IF NOT EXISTS creator_collaborations_owner_idx
  ON creator_collaborations(owner_creator_user_id);

CREATE INDEX IF NOT EXISTS creator_collaborations_collaborator_idx
  ON creator_collaborations(collaborator_user_id);

CREATE INDEX IF NOT EXISTS creator_collaborations_status_idx
  ON creator_collaborations(status);

CREATE UNIQUE INDEX IF NOT EXISTS creator_collaborations_target_idx
  ON creator_collaborations(collaboration_type, target_id);
