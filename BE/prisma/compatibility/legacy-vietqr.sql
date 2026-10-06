-- Complete the exact DDL of the pending 20260925090000 migration on installs
-- where the alternative online-payment migration already added planId.
-- Run only after checking migration history and taking a backup. Historical
-- migration files/checksums stay unchanged. This script retains all old data.
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "planId" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerTransactionId_key"
  ON "Payment"("providerTransactionId");
CREATE INDEX IF NOT EXISTS "Payment_planId_idx" ON "Payment"("planId");
CREATE INDEX IF NOT EXISTS "Payment_provider_idx" ON "Payment"("provider");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conname = 'Payment_planId_fkey' AND conrelid = '"Payment"'::regclass) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
