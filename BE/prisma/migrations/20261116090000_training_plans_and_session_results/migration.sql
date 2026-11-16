BEGIN;

ALTER TABLE "SlotEvaluation" ADD COLUMN "results" TEXT;
ALTER TABLE "Issue" ADD COLUMN "submittedOnBehalf" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "memberId" TEXT,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "homework" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingPlan_classId_memberId_idx" ON "TrainingPlan"("classId", "memberId");
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
