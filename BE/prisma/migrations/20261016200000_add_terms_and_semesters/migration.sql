-- CreateEnum
CREATE TYPE "TermStatus" AS ENUM ('PLANNING', 'OPEN_REGISTRATION', 'IN_PROGRESS', 'CLOSED');

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "registrationStartDate" TIMESTAMP(3) NOT NULL,
    "registrationEndDate" TIMESTAMP(3) NOT NULL,
    "status" "TermStatus" NOT NULL DEFAULT 'PLANNING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Term_code_key" ON "Term"("code");

-- CreateIndex
CREATE INDEX "Term_status_idx" ON "Term"("status");

-- CreateIndex
CREATE INDEX "Term_startDate_endDate_idx" ON "Term"("startDate", "endDate");

-- AlterTable ClassSchedule
ALTER TABLE "ClassSchedule" ADD COLUMN "termId" TEXT;

-- CreateIndex
CREATE INDEX "ClassSchedule_termId_idx" ON "ClassSchedule"("termId");

-- AddForeignKey
ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable SchedulePattern
ALTER TABLE "SchedulePattern" ADD COLUMN "termId" TEXT;

-- CreateIndex
CREATE INDEX "SchedulePattern_termId_idx" ON "SchedulePattern"("termId");

-- AddForeignKey
ALTER TABLE "SchedulePattern" ADD CONSTRAINT "SchedulePattern_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
