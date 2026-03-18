/*
  Warnings:

  - You are about to drop the column `changedBy` on the `template_versions` table. All the data in the column will be lost.
  - Added the required column `changedById` to the `template_versions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "template_versions" DROP COLUMN "changedBy",
ADD COLUMN     "changedById" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
