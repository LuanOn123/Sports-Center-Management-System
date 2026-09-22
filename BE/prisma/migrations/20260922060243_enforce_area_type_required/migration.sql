/*
  Warnings:

  - Made the column `areaType` on table `Class` required. This step will fail if there are existing NULL values in that column.
  - Made the column `areaType` on table `Room` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "areaType" SET NOT NULL;

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "areaType" SET NOT NULL;
