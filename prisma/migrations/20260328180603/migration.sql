/*
  Warnings:

  - Added the required column `auto` to the `lost_document_cases` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "lost_document_cases" ADD COLUMN     "auto" BOOLEAN NOT NULL;
