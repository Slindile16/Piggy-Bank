-- Upgrade existing Piggy Bank databases to support 1–360 month plans.
-- Demo-only savings; no actual funds or banking integrations.
ALTER TABLE savings_plans DROP CONSTRAINT IF EXISTS savings_plans_duration_months_check;
ALTER TABLE savings_plans ADD CONSTRAINT savings_plans_duration_months_check CHECK (duration_months BETWEEN 1 AND 360);
