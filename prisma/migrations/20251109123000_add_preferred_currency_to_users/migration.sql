-- Add preferred_currency to users and index it
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT NOT NULL DEFAULT 'USD';
CREATE INDEX IF NOT EXISTS "users_preferredCurrency_idx" ON "users" ("preferredCurrency");

