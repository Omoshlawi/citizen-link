-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_aiInteractionId_fkey";

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "AIInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
