ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COACH_CHANGE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COACH_CHANGE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COACH_CHANGE_REJECTED';
CREATE TABLE "CoachChangeRequest" (
  "id" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "requesterCoachId" TEXT NOT NULL,
  "replacementCoachId" TEXT,
  "requestedStartTime" TIMESTAMP(3) NOT NULL,
  "requestedEndTime" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decisionReason" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CoachChangeRequest_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoachChangeRequest_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ClassSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoachChangeRequest_requesterCoachId_fkey" FOREIGN KEY ("requesterCoachId") REFERENCES "CoachProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CoachChangeRequest_replacementCoachId_fkey" FOREIGN KEY ("replacementCoachId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "CoachChangeRequest_facilityId_status_idx" ON "CoachChangeRequest"("facilityId", "status");
CREATE INDEX "CoachChangeRequest_requesterCoachId_createdAt_idx" ON "CoachChangeRequest"("requesterCoachId", "createdAt");
CREATE INDEX "CoachChangeRequest_scheduleId_idx" ON "CoachChangeRequest"("scheduleId");
CREATE UNIQUE INDEX "CoachChangeRequest_pending_unique" ON "CoachChangeRequest"("scheduleId", "requesterCoachId") WHERE "status" = 'PENDING';
