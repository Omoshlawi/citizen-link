/*
  Warnings:

  - Added the required column `modelVersion` to the `AIInteraction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AIInteraction" ADD COLUMN     "modelVersion" TEXT NOT NULL;
