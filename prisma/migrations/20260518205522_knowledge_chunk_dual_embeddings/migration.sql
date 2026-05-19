/*
  Warnings:

  - You are about to drop the column `embedding` on the `knowledge_chunks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "knowledge_chunks" DROP COLUMN "embedding",
ADD COLUMN     "embedding_1536" vector(1536),
ADD COLUMN     "embedding_768" vector(768);
