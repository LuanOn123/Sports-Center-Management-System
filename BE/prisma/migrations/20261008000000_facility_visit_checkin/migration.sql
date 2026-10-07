-- Phase 1 Member x Facility: FacilityVisit (check-in vao cua).
-- Membership la GLOBAL: entitlement tra qua ACTIVE + con han, KHONG loc theo facility.
-- `facilityId` o day la USAGE facility (co so su dung thuc te), khac ORIGIN tren Subscription.

-- CreateEnum
CREATE TYPE "FacilityVisitMethod" AS ENUM ('QR', 'RECEPTION');

-- CreateTable
CREATE TABLE "FacilityVisit" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "FacilityVisitMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityVisit_memberId_idx" ON "FacilityVisit"("memberId");
CREATE INDEX "FacilityVisit_facilityId_idx" ON "FacilityVisit"("facilityId");
CREATE INDEX "FacilityVisit_memberId_checkInAt_idx" ON "FacilityVisit"("memberId", "checkInAt");

-- AddForeignKey
ALTER TABLE "FacilityVisit" ADD CONSTRAINT "FacilityVisit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityVisit" ADD CONSTRAINT "FacilityVisit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
