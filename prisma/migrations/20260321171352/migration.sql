-- DropForeignKey
ALTER TABLE "template_versions" DROP CONSTRAINT "template_versions_templateId_fkey";

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
