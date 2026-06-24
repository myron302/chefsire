CREATE TABLE IF NOT EXISTS meal_planner_analytics_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  creator_id varchar REFERENCES users(id),
  actor_user_id varchar REFERENCES users(id),
  meal_plan_id varchar REFERENCES meal_plan_blueprints(id),
  shared_week_token text,
  metadata jsonb DEFAULT '{}'::jsonb,
  session_key text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_planner_events_creator_type_created ON meal_planner_analytics_events(creator_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_planner_events_plan_type ON meal_planner_analytics_events(meal_plan_id, event_type);
CREATE INDEX IF NOT EXISTS idx_meal_planner_events_shared_week_type ON meal_planner_analytics_events(shared_week_token, event_type);
