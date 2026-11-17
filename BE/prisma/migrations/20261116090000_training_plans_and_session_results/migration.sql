BEGIN;

ALTER TABLE "SlotEvaluation" ADD COLUMN IF NOT EXISTS "results" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "submittedOnBehalf" BOOLEAN NOT NULL DEFAULT false;

-- Legacy plans have no class association. Preserve them and the TrainingResult
-- foreign key without guessing a class for existing member/coach records.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = to_regclass('"TrainingPlan"')
          AND attname = 'startDate' AND NOT attisdropped
    ) THEN
        ALTER TABLE "TrainingPlan" RENAME TO "LegacyTrainingPlan";
        ALTER TABLE "LegacyTrainingPlan" RENAME CONSTRAINT "TrainingPlan_pkey" TO "LegacyTrainingPlan_pkey";
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TrainingPlan" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "memberId" TEXT,
    "coachId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "homework" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TrainingPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingPlan_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainingPlan_classId_memberId_idx" ON "TrainingPlan"("classId", "memberId");

COMMIT;
