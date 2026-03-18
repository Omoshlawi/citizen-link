/*
  Warnings:

  - You are about to drop the `template_render_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "template_render_logs" DROP CONSTRAINT "template_render_logs_templateId_fkey";

-- DropTable
DROP TABLE "template_render_logs";
