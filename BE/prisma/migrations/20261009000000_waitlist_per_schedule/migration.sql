-- Phase 2 Member x Facility: WaitlistEntry theo BUOI (schedule-specific).
-- 1 member chi co toi da 1 WAITING cho 1 buoi (unique tung phan theo status).
-- Scope facility qua Schedule -> Class (khong them facilityId truc tiep).

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'PROMOTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_scheduleId_idx" ON "WaitlistEntry"("scheduleId");
CREATE INDEX "WaitlistEntry_memberId_idx" ON "WaitlistEntry"("memberId");
CREATE INDEX "WaitlistEntry_scheduleId_status_idx" ON "WaitlistEntry"("scheduleId", "status");
CREATE INDEX "WaitlistEntry_scheduleId_status_position_idx" ON "WaitlistEntry"("scheduleId", "status", "position");

-- 1 member toi da 1 WAITING cho 1 buoi (PROMOTED/CANCELLED cu duoc phep ton tai lich su).
CREATE UNIQUE INDEX "WaitlistEntry_scheduleId_memberId_waiting_key"
  ON "WaitlistEntry"("scheduleId", "memberId")
  WHERE "status" = 'WAITING';

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ClassSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
