-- Simulated deposits only. No payment rails or withdrawals.
CREATE TABLE IF NOT EXISTS savings_deposits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES savings_plans(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS savings_deposits_user_date_idx ON savings_deposits(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS savings_deposits_plan_idx ON savings_deposits(plan_id);
