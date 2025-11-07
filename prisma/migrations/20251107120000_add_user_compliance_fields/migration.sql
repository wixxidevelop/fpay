-- AlterTable: add compliance and withdrawal security fields to users
ALTER TABLE "users"
  ADD COLUMN "withdrawalPinHash" TEXT,
  ADD COLUMN "withdrawalPinEnc" TEXT,
  ADD COLUMN "cotPinHash" TEXT,
  ADD COLUMN "cotPinEnc" TEXT,
  ADD COLUMN "taxCodeHash" TEXT,
  ADD COLUMN "taxCodeEnc" TEXT,
  ADD COLUMN "upgradeLevel" INTEGER,
  ADD COLUMN "requireCommissionFee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireWithdrawalFee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "withdrawalPinValidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cotPinValidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taxCodeValidated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "upgradeCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "commissionFeeAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "withdrawalFeeAccepted" BOOLEAN NOT NULL DEFAULT false;