/*
  Warnings:

  - Made the column `coordinates` on table `pickup_stations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "pickup_stations" ALTER COLUMN "coordinates" SET NOT NULL;
