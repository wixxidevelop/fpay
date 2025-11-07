-- AlterTable: add currency and details to withdrawal_requests
ALTER TABLE "withdrawal_requests"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "details" TEXT;