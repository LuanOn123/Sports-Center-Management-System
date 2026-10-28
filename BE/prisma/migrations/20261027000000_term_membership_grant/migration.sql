-- Additive only: historical enrollments retain their existing membership rules.
ALTER TABLE "Enrollment" ADD COLUMN "termMembershipGrant" JSONB;
