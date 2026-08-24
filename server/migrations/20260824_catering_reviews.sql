CREATE TABLE IF NOT EXISTS catering_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inquiry_id varchar REFERENCES catering_inquiries(id) ON DELETE SET NULL,
  rating integer NOT NULL CONSTRAINT catering_reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  title varchar(120), body text NOT NULL, verified_event boolean NOT NULL DEFAULT false,
  provider_response text, responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_reviews_provider_date_idx ON catering_reviews(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catering_reviews_provider_rating_idx ON catering_reviews(provider_id, rating);
CREATE UNIQUE INDEX IF NOT EXISTS catering_reviews_reviewer_provider_uidx ON catering_reviews(reviewer_id, provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS catering_reviews_inquiry_uidx ON catering_reviews(inquiry_id) WHERE inquiry_id IS NOT NULL;
