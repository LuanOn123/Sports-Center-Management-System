-- AlterTable
ALTER TABLE "MembershipSubscription" ADD COLUMN     "facilityId" TEXT NOT NULL DEFAULT 'legacy-main',
ADD COLUMN     "priceSnapshot" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "facilityId" TEXT NOT NULL DEFAULT 'legacy-main';

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "facilityId" TEXT NOT NULL DEFAULT 'legacy-main',
ADD COLUMN     "requirementsSnapshot" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ClassSchedule" ADD COLUMN     "coachId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "facilityId" TEXT NOT NULL DEFAULT 'legacy-main',
ADD COLUMN     "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RoomCapability" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "RoomCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectRequirement" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "minimum" INTEGER NOT NULL,

    CONSTRAINT "SubjectRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachSpecialization" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,

    CONSTRAINT "CoachSpecialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePattern" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulePattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionReason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "response" TEXT,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomCapability_roomId_key_key" ON "RoomCapability"("roomId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectRequirement_sportId_key_key" ON "SubjectRequirement"("sportId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CoachSpecialization_coachId_sportId_key" ON "CoachSpecialization"("coachId", "sportId");

-- CreateIndex
CREATE INDEX "LeaveRequest_coachId_startTime_endTime_idx" ON "LeaveRequest"("coachId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Issue_facilityId_memberId_idx" ON "Issue"("facilityId", "memberId");

-- CreateIndex
CREATE INDEX "AuditLog_facilityId_createdAt_idx" ON "AuditLog"("facilityId", "createdAt");

-- AddForeignKey
ALTER TABLE "MembershipSubscription" ADD CONSTRAINT "MembershipSubscription_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomCapability" ADD CONSTRAINT "RoomCapability_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequirement" ADD CONSTRAINT "SubjectRequirement_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachSpecialization" ADD CONSTRAINT "CoachSpecialization_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachSpecialization" ADD CONSTRAINT "CoachSpecialization_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePattern" ADD CONSTRAINT "SchedulePattern_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePattern" ADD CONSTRAINT "SchedulePattern_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePattern" ADD CONSTRAINT "SchedulePattern_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve historical sale amounts. Refund amounts for historical records must be
-- reconciled manually: the previous implementation only kept the amount in notes.
UPDATE "MembershipSubscription" s SET "priceSnapshot" = p."amount"
FROM (SELECT DISTINCT ON ("subscriptionId") "subscriptionId", "amount"
      FROM "Payment" WHERE "paidAt" IS NOT NULL AND "subscriptionId" IS NOT NULL
      ORDER BY "subscriptionId", "paidAt" ASC, "id" ASC) p
WHERE p."subscriptionId" = s."id";
