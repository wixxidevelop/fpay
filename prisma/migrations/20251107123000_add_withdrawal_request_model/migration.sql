-- CreateEnum for WithdrawalStatus
DO $$ BEGIN
  CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING','APPROVED','DENIED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable withdrawal_requests
CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "withdrawal_requests_userId_status_idx" ON "withdrawal_requests" ("userId","status");

-- Foreign key
ALTER TABLE "withdrawal_requests"
  ADD CONSTRAINT "withdrawal_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;