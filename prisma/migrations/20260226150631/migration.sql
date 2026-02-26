-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_matchId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupAddressId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupStationId_fkey";

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
