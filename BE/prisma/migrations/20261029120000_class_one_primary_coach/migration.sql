-- R-03: mỗi lớp tối đa MỘT HLV chính.
-- Dọn dữ liệu cũ có thể đã bị đua: giữ HLV chính được gán sớm nhất, các dòng khác chuyển thành HLV phụ.
UPDATE "ClassMember" cm
SET "isPrimary" = false
WHERE cm."isPrimary" = true
  AND EXISTS (
    SELECT 1 FROM "ClassMember" other
    WHERE other."classId" = cm."classId"
      AND other."isPrimary" = true
      AND (other."createdAt" < cm."createdAt"
           OR (other."createdAt" = cm."createdAt" AND other."id" < cm."id"))
  );

-- Prisma schema không khai báo được partial unique index nên tạo bằng SQL.
CREATE UNIQUE INDEX "ClassMember_one_primary_per_class" ON "ClassMember"("classId") WHERE "isPrimary" = true;
