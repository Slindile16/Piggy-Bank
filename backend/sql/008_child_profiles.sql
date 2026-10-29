-- Piggy Bank Kids · demo child profiles (no real child documents or photographs)
CREATE TABLE IF NOT EXISTS child_profiles (
  id UUID PRIMARY KEY,
  guardian_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(80) NOT NULL,
  surname VARCHAR(80) NOT NULL,
  date_of_birth DATE NOT NULL,
  relationship VARCHAR(30) NOT NULL CHECK (relationship IN ('Mother','Father','Legal Guardian')),
  avatar_color VARCHAR(20) NOT NULL DEFAULT 'emerald',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS child_profiles_guardian_idx ON child_profiles(guardian_user_id);
