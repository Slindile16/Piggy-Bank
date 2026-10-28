-- Run once in pgAdmin. Tracks goal edits without changing lock dates or balances.
CREATE TABLE IF NOT EXISTS savings_plan_changes (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 plan_id UUID NOT NULL REFERENCES savings_plans(id) ON DELETE CASCADE,
 old_name VARCHAR(100) NOT NULL,
 new_name VARCHAR(100) NOT NULL,
 old_target_cents BIGINT NOT NULL,
 new_target_cents BIGINT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS savings_plan_changes_lookup ON savings_plan_changes(user_id,plan_id,created_at DESC);
