-- Demo-only withdrawal ledger. No bank payout or biometric verification is performed.
CREATE TABLE IF NOT EXISTS savings_withdrawals (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 plan_id UUID NOT NULL REFERENCES savings_plans(id) ON DELETE CASCADE,
 amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
 penalty_cents BIGINT NOT NULL CHECK (penalty_cents >= 0),
 payout_cents BIGINT NOT NULL CHECK (payout_cents >= 0),
 early BOOLEAN NOT NULL,
 full_withdrawal BOOLEAN NOT NULL,
 status VARCHAR(32) NOT NULL DEFAULT 'demo_completed' CHECK (status = 'demo_completed'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS savings_withdrawals_user_date_idx ON savings_withdrawals(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS savings_withdrawals_plan_idx ON savings_withdrawals(plan_id);
