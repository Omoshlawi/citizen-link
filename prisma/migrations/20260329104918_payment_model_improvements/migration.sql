-- AlterEnum: add OVERDUE to InvoiceStatus
ALTER TYPE "InvoiceStatus" ADD VALUE 'OVERDUE';

-- AlterEnum: replace free-form paymentProvider string with PaymentProvider enum
CREATE TYPE "PaymentProvider" AS ENUM ('MPESA', 'STRIPE', 'AFRICASTALKING');

-- CreateEnum: DisbursementStatus
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'INITIATED', 'COMPLETED', 'FAILED');

-- AlterTable: Invoice — add dueDate, change onDelete (no SQL needed for Restrict; FK already exists)
ALTER TABLE "invoices" ADD COLUMN "dueDate" TIMESTAMP(3);

-- AlterTable: Transaction — add initiatedById, checkoutRequestId, replace paymentProvider type
ALTER TABLE "transactions"
  ADD COLUMN "initiatedById" TEXT,
  ADD COLUMN "checkoutRequestId" TEXT,
  ADD COLUMN "paymentProviderNew" "PaymentProvider";

-- Migrate existing paymentProvider string values (best-effort)
UPDATE "transactions"
SET "paymentProviderNew" = CASE
  WHEN LOWER("paymentProvider") LIKE '%mpesa%' OR LOWER("paymentProvider") LIKE '%safaricom%' THEN 'MPESA'::"PaymentProvider"
  WHEN LOWER("paymentProvider") LIKE '%stripe%' THEN 'STRIPE'::"PaymentProvider"
  WHEN LOWER("paymentProvider") LIKE '%africastalking%' OR LOWER("paymentProvider") LIKE '%at%' THEN 'AFRICASTALKING'::"PaymentProvider"
  ELSE NULL
END;

ALTER TABLE "transactions" DROP COLUMN "paymentProvider";
ALTER TABLE "transactions" RENAME COLUMN "paymentProviderNew" TO "paymentProvider";

-- AddUniqueConstraint on checkoutRequestId
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_checkoutRequestId_key" UNIQUE ("checkoutRequestId");

-- AddIndex
CREATE INDEX "transactions_checkoutRequestId_idx" ON "transactions"("checkoutRequestId");
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- AddForeignKey: initiatedById → users
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_initiatedById_fkey"
  FOREIGN KEY ("initiatedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Disbursement
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "disbursementNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentProvider" "PaymentProvider",
    "providerTransactionId" TEXT,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "initiatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- AddUniqueConstraint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_disbursementNumber_key" UNIQUE ("disbursementNumber");

-- CreateIndex
CREATE INDEX "disbursements_invoiceId_idx" ON "disbursements"("invoiceId");
CREATE INDEX "disbursements_recipientId_idx" ON "disbursements"("recipientId");
CREATE INDEX "disbursements_status_idx" ON "disbursements"("status");

-- AddForeignKey
ALTER TABLE "disbursements"
  ADD CONSTRAINT "disbursements_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "disbursements"
  ADD CONSTRAINT "disbursements_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
