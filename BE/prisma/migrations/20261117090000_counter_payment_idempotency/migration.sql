ALTER TABLE "Payment"
    ADD COLUMN "counterRequestKey" TEXT,
    ADD COLUMN "counterRequestFingerprint" TEXT;

CREATE UNIQUE INDEX "Payment_counterRequestKey_key" ON "Payment"("counterRequestKey");
