/*
  Warnings:

  - You are about to drop the `ClaimStatusTransition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClaimStatusTransition" DROP CONSTRAINT "ClaimStatusTransition_changedById_fkey";

-- DropForeignKey
ALTER TABLE "ClaimStatusTransition" DROP CONSTRAINT "ClaimStatusTransition_claimId_fkey";

-- DropTable
DROP TABLE "ClaimStatusTransition";

-- CreateTable
CREATE TABLE "claim_status_transitions" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fromStatus" "ClaimStatus" NOT NULL,
    "toStatus" "ClaimStatus" NOT NULL,
    "reason" "ClaimStatusReason",
    "comment" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_status_transitions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "claim_status_transitions" ADD CONSTRAINT "claim_status_transitions_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_status_transitions" ADD CONSTRAINT "claim_status_transitions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
