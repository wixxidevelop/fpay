-- CreateEnum
CREATE TYPE "VerificationOutcome" AS ENUM ('SENT', 'UNKNOWN', 'ERROR');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "withdrawalPinLockedUntil" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "cotPinLockedUntil" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "withdrawalPinLastChangedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "cotPinLastChangedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verification_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "outcome" "VerificationOutcome" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_attempts_email_outcome_createdAt_idx" ON "email_verification_attempts"("email", "outcome", "createdAt");
