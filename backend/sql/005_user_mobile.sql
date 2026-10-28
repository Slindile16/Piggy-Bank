-- Run once in pgAdmin against piggy_bank.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(16);
-- Existing users can add a mobile number from Profile; new registrations require one.
