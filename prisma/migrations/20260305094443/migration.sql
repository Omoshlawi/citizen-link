/*
  Warnings:

  - You are about to drop the column `aiAnalysis` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `matchScore` on the `matches` table. All the data in the column will be lost.
  - Added the required column `aiScore` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `aiVerificationResult` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exactScore` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalScore` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `layer2FieldScores` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `triggeredBy` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vectorScore` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verdict` to the `matches` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MatchVerdict" AS ENUM ('VERIFIED_MATCH', 'PROBABLE_MATCH', 'POSSIBLE_MATCH', 'NO_MATCH');

-- CreateEnum
CREATE TYPE "MatchTrigger" AS ENUM ('LOST_CASE_SUBMITTED', 'FOUND_CASE_VERIFIED', 'MANUAL', 'REINDEX');

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "aiAnalysis",
DROP COLUMN "matchScore",
ADD COLUMN     "aiScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "aiVerificationResult" JSON NOT NULL,
ADD COLUMN     "exactScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "finalScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "layer2FieldScores" JSON NOT NULL,
ADD COLUMN     "triggeredBy" "MatchTrigger" NOT NULL,
ADD COLUMN     "vectorScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "verdict" "MatchVerdict" NOT NULL;
