-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GOAL_PROGRESS_UPDATED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberCourseGoal" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCourseGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SlotEvaluation" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "goalId" TEXT,
    "previousProgress" INTEGER NOT NULL DEFAULT 0,
    "newProgress" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemberCourseGoal_memberId_idx" ON "MemberCourseGoal"("memberId");
CREATE INDEX IF NOT EXISTS "MemberCourseGoal_classId_idx" ON "MemberCourseGoal"("classId");
CREATE UNIQUE INDEX IF NOT EXISTS "MemberCourseGoal_memberId_classId_key" ON "MemberCourseGoal"("memberId", "classId");

CREATE INDEX IF NOT EXISTS "SlotEvaluation_scheduleId_idx" ON "SlotEvaluation"("scheduleId");
CREATE INDEX IF NOT EXISTS "SlotEvaluation_memberId_idx" ON "SlotEvaluation"("memberId");
CREATE INDEX IF NOT EXISTS "SlotEvaluation_goalId_idx" ON "SlotEvaluation"("goalId");
CREATE INDEX IF NOT EXISTS "SlotEvaluation_coachId_idx" ON "SlotEvaluation"("coachId");
CREATE UNIQUE INDEX IF NOT EXISTS "SlotEvaluation_scheduleId_memberId_key" ON "SlotEvaluation"("scheduleId", "memberId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberCourseGoal_memberId_fkey') THEN
    ALTER TABLE "MemberCourseGoal" ADD CONSTRAINT "MemberCourseGoal_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberCourseGoal_classId_fkey') THEN
    ALTER TABLE "MemberCourseGoal" ADD CONSTRAINT "MemberCourseGoal_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SlotEvaluation_scheduleId_fkey') THEN
    ALTER TABLE "SlotEvaluation" ADD CONSTRAINT "SlotEvaluation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ClassSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SlotEvaluation_memberId_fkey') THEN
    ALTER TABLE "SlotEvaluation" ADD CONSTRAINT "SlotEvaluation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SlotEvaluation_coachId_fkey') THEN
    ALTER TABLE "SlotEvaluation" ADD CONSTRAINT "SlotEvaluation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SlotEvaluation_goalId_fkey') THEN
    ALTER TABLE "SlotEvaluation" ADD CONSTRAINT "SlotEvaluation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "MemberCourseGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
