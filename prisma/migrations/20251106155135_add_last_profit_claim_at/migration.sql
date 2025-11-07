-- AlterTable
ALTER TABLE "stock_purchases" ADD COLUMN     "lastProfitClaimAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
