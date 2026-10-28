-- Demo-only banking preferences. Never store real account numbers, card numbers, expiry or CVV.
CREATE TABLE IF NOT EXISTS demo_banking_preferences (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 bank_name VARCHAR(80) NOT NULL,
 account_type VARCHAR(30) NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
