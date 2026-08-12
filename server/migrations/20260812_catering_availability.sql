CREATE TABLE catering_availability_settings (
  provider_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accepting_bookings boolean NOT NULL DEFAULT true,
  minimum_lead_days integer NOT NULL DEFAULT 0,
  maximum_advance_days integer NOT NULL DEFAULT 365,
  timezone varchar(100) NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_availability_window_check CHECK (minimum_lead_days >= 0 AND maximum_advance_days >= minimum_lead_days AND maximum_advance_days <= 1095)
);
CREATE TABLE catering_availability_exceptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), provider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date date NOT NULL, end_date date NOT NULL, type varchar(16) NOT NULL, reason varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_availability_exception_range_check CHECK (end_date >= start_date),
  CONSTRAINT catering_availability_exception_type_check CHECK (type IN ('available','blocked')),
  CONSTRAINT catering_availability_exception_no_duplicate UNIQUE (provider_id,start_date,end_date,type)
);
CREATE INDEX catering_availability_exceptions_provider_dates_idx ON catering_availability_exceptions(provider_id,start_date,end_date);
CREATE TABLE catering_availability_weekly_rules (
  provider_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, day_of_week integer NOT NULL, available boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_availability_weekly_day_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT catering_availability_weekly_provider_day_uidx UNIQUE(provider_id,day_of_week)
);
