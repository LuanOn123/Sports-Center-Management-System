import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function main() {
  console.log("Applying Term.facilityId migration...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "Term" ADD COLUMN IF NOT EXISTS "facilityId" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Term_facilityId_idx" ON "Term"("facilityId");`);
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Term_facilityId_fkey'
        ) THEN
          ALTER TABLE "Term" ADD CONSTRAINT "Term_facilityId_fkey" 
          FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  } catch (err: any) {
    console.log("Foreign key warning (may already exist):", err.message);
  }
  console.log("Migration applied successfully!");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
