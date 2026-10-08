-- FINAL attendance: phan biet FIXED vs RECURRING bang snapshot tren Class.
-- FIXED: plannedSessionCount la con so co dinh, KHONG tu tang khi them schedule.
-- RECURRING (mac dinh): khong co tong co dinh, dung rolling fallback.
ALTER TABLE "Class" ADD COLUMN "attendancePolicy" TEXT NOT NULL DEFAULT 'RECURRING';
ALTER TABLE "Class" ADD COLUMN "plannedSessionCount" INTEGER;
