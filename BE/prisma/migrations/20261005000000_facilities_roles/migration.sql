-- P1 was previously shipped without a database migration. Retain installations
-- that already created these tables through db push.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = '"UserRole"'::regtype AND enumlabel = 'STAFF') THEN
    ALTER TYPE "UserRole" RENAME VALUE 'STAFF' TO 'RECEPTIONIST';
  END IF;
END $$;
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
CREATE TABLE IF NOT EXISTS "Facility" (
  "id" TEXT PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
  "address" TEXT NOT NULL, "contactInfo" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "FacilityStaff" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "facilityId" TEXT NOT NULL REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role" "UserRole" NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "FacilityStaff_userId_facilityId_role_key" ON "FacilityStaff"("userId", "facilityId", "role");
CREATE INDEX IF NOT EXISTS "FacilityStaff_userId_idx" ON "FacilityStaff"("userId");
CREATE INDEX IF NOT EXISTS "FacilityStaff_facilityId_idx" ON "FacilityStaff"("facilityId");
INSERT INTO "Facility"("id", "code", "name", "address", "updatedAt")
VALUES ('legacy-main', 'LEGACY_MAIN', 'Cơ sở hiện tại', 'Cần cập nhật địa chỉ', CURRENT_TIMESTAMP)
ON CONFLICT("id") DO NOTHING;
