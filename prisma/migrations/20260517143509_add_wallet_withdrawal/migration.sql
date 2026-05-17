-- CreateEnum
CREATE TYPE "WalletWithdrawalStatus" AS ENUM ('INITIATED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "wallet_withdrawals" (
    "id" TEXT NOT NULL,
    "withdrawalNumber" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'INITIATED',
    "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'MPESA',
    "providerTransactionId" TEXT,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_withdrawals_withdrawalNumber_key" ON "wallet_withdrawals"("withdrawalNumber");

-- CreateIndex
CREATE INDEX "wallet_withdrawals_userId_idx" ON "wallet_withdrawals"("userId");

-- CreateIndex
CREATE INDEX "wallet_withdrawals_walletId_idx" ON "wallet_withdrawals"("walletId");

-- CreateIndex
CREATE INDEX "wallet_withdrawals_status_idx" ON "wallet_withdrawals"("status");

-- AddForeignKey
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
