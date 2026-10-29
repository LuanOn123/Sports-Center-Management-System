-- R-06: mỗi (member, coach) tối đa MỘT feedback chung (classId NULL).
-- @@unique([coachId, memberId, classId]) không chặn trùng khi classId NULL, và upsert cũ
-- tìm bằng classId = '' nên mỗi lần gửi lại tạo thêm dòng. Dọn trùng: giữ bản cập nhật gần nhất.
DELETE FROM "CoachFeedback" f
WHERE f."classId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "CoachFeedback" other
    WHERE other."classId" IS NULL
      AND other."coachId" = f."coachId"
      AND other."memberId" = f."memberId"
      AND (other."updatedAt" > f."updatedAt"
           OR (other."updatedAt" = f."updatedAt" AND other."id" > f."id"))
  );

-- Prisma schema không khai báo được partial unique index nên tạo bằng SQL.
CREATE UNIQUE INDEX "CoachFeedback_general_unique" ON "CoachFeedback"("coachId", "memberId") WHERE "classId" IS NULL;
