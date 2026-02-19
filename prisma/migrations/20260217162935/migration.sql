-- CreateEnum
CREATE TYPE "ClaimStatusReason" AS ENUM ('INVALID_DOCUMENT', 'FRAUD_SUSPECTED', 'DUPLICATE_CLAIM', 'INCORRECT_INFORMATION', 'POLICY_VIOLATION', 'USER_REQUEST', 'OTHER');

-- CreateTable
CREATE TABLE "ClaimStatusTransition" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "ClaimStatus" NOT NULL,
    "toStatus" "ClaimStatus" NOT NULL,
    "reason" "ClaimStatusReason",
    "comment" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimStatusTransition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClaimStatusTransition" ADD CONSTRAINT "ClaimStatusTransition_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimStatusTransition" ADD CONSTRAINT "ClaimStatusTransition_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
