CREATE TABLE IF NOT EXISTS catering_portfolio_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image text NOT NULL,
  title varchar(120) NOT NULL,
  description text,
  category varchar(40) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT catering_portfolio_category_check CHECK (category IN ('Weddings','Corporate','Private Events','Holiday Events','BBQ','Fine Dining','Desserts','Appetizers','Buffets','Signature Dishes','Other')),
  CONSTRAINT catering_portfolio_sort_order_check CHECK (sort_order >= 0)
);
CREATE INDEX IF NOT EXISTS catering_portfolio_provider_order_idx ON catering_portfolio_items(provider_id, sort_order, created_at);
