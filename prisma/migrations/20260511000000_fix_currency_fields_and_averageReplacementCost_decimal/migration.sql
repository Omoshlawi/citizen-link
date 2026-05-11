-- Remove hardcoded "KES" defaults from currency columns.
-- Services always set currency explicitly via RegionService.getCurrency()
-- at insert time, so these defaults were misleading and non-portable.

ALTER TABLE "document_types" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "disbursements" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "wallets" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "wallet_ledger" ALTER COLUMN "currency" DROP DEFAULT;

-- Change averageReplacementCost from DOUBLE PRECISION (float) to DECIMAL(10,2).
-- This field holds a monetary value and must use exact decimal arithmetic.
-- Existing data is cast; PostgreSQL rounds to 2 decimal places.

ALTER TABLE "document_types"
  ALTER COLUMN "averageReplacementCost"
  TYPE DECIMAL(10,2)
  USING "averageReplacementCost"::DECIMAL(10,2);
