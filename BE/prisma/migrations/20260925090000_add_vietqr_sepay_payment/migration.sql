ALTER TABLE "Payment"
ADD COLUMN "provider" TEXT,
ADD COLUMN "providerTransactionId" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_providerTransactionId_key"
ON "Payment"("providerTransactionId");

CREATE INDEX "Payment_planId_idx" ON "Payment"("planId");
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");



