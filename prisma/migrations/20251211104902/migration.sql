-- AlterTable
ALTER TABLE "AIExtraction" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true;
