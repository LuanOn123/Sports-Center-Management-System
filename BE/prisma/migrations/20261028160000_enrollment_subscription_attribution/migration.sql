-- Historical bookings remain unassigned: a current plan cannot establish past usage.
ALTER TABLE "Enrollment" ADD COLUMN "subscriptionId" TEXT;
CREATE INDEX "Enrollment_subscriptionId_idx" ON "Enrollment"("subscriptionId");
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "MembershipSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
