-- Also accepts installations repaired by tests/migrate-term-facility.ts.
ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "facilityId" TEXT;
CREATE INDEX IF NOT EXISTS "Term_facilityId_idx" ON "Term"("facilityId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Term_facilityId_fkey'
    AND conrelid = '"Term"'::regclass) THEN
    ALTER TABLE "Term" ADD CONSTRAINT "Term_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
