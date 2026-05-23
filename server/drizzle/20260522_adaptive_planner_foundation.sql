CREATE TABLE IF NOT EXISTS adaptive_planner_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  week_key text NOT NULL,
  snapshot_version integer NOT NULL DEFAULT 1,
  objective_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  adherence_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  sustainability_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adaptive_planner_snapshots_user_week_idx ON adaptive_planner_snapshots(user_id, week_key);

CREATE TABLE IF NOT EXISTS adaptive_planner_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  profile_version text NOT NULL DEFAULT 'v1',
  planner_mode text NOT NULL DEFAULT 'balanced',
  adaptation_cadence text NOT NULL DEFAULT 'weekly',
  current_goal_focus text,
  profile_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adaptive_planner_profiles_user_idx ON adaptive_planner_profiles(user_id);

CREATE TABLE IF NOT EXISTS nutrition_personality_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  personality_version integer NOT NULL DEFAULT 1,
  consistency_score integer NOT NULL DEFAULT 0,
  novelty_seeking_score integer NOT NULL DEFAULT 0,
  routine_affinity_score integer NOT NULL DEFAULT 0,
  preference_tags text[] NOT NULL DEFAULT '{}'::text[],
  profile_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nutrition_personality_profiles_user_idx ON nutrition_personality_profiles(user_id);

CREATE TABLE IF NOT EXISTS planner_relationship_learning (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  relationship_version integer NOT NULL DEFAULT 1,
  source_dimension text NOT NULL,
  target_dimension text NOT NULL,
  confidence_score integer NOT NULL DEFAULT 0,
  relationship_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_relationship_learning_user_dimension_idx ON planner_relationship_learning(user_id, source_dimension, target_dimension);

CREATE TABLE IF NOT EXISTS planner_objective_history (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  objective_version integer NOT NULL DEFAULT 1,
  objective_key text NOT NULL,
  objective_status text NOT NULL DEFAULT 'active',
  objective_score integer NOT NULL DEFAULT 0,
  summary_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_objective_history_user_objective_idx ON planner_objective_history(user_id, objective_key);
