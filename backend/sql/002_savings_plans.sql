-- Piggy Bank simulated savings plans. No real-money transactions.
CREATE TABLE IF NOT EXISTS savings_plans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('starter','builder','visionary','custom')),
  duration_months INTEGER NOT NULL CHECK (duration_months BETWEEN 1 AND 60),
  target_cents BIGINT NOT NULL CHECK (target_cents > 0),
  saved_cents BIGINT NOT NULL DEFAULT 0 CHECK (saved_cents >= 0),
  starts_on DATE NOT NULL,
  matures_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS savings_plans_user_idx ON savings_plans(user_id, created_at DESC);
