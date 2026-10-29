BEGIN;
-- Never discard paid periods or coach assignments to make an index pass.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MembershipSubscription" WHERE status = 'ACTIVE' GROUP BY "memberId" HAVING COUNT(*) > 1)
    OR EXISTS (SELECT 1 FROM "MembershipSubscription" WHERE status = 'SCHEDULED' GROUP BY "memberId" HAVING COUNT(*) > 1)
    OR EXISTS (SELECT 1 FROM "ClassMember" WHERE "isPrimary" GROUP BY "classId" HAVING COUNT(*) > 1)
    OR EXISTS (SELECT 1 FROM "CoachFeedback" WHERE "classId" IS NULL GROUP BY "coachId", "memberId" HAVING COUNT(*) > 1)
  THEN RAISE EXCEPTION 'SCMS_PREFLIGHT_REQUIRED: reconcile duplicate entitlements, primary coaches or generic feedback before deployment';
  END IF;
  IF EXISTS (SELECT 1 FROM "ClassSchedule" WHERE status = 'SCHEDULED' AND "endTime" > CURRENT_TIMESTAMP AND "termId" IS NULL)
  THEN RAISE EXCEPTION 'SCMS_PREFLIGHT_REQUIRED: assign a term to future sessions before deployment'; END IF;
END $$;

ALTER TABLE "Payment" ADD COLUMN "refundRequestedAmount" DECIMAL(12,2),
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3), ADD COLUMN "refundReason" TEXT, ADD COLUMN "refundReference" TEXT;
CREATE UNIQUE INDEX "subscription_one_active_member" ON "MembershipSubscription" ("memberId") WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX "subscription_one_scheduled_member" ON "MembershipSubscription" ("memberId") WHERE status = 'SCHEDULED';
CREATE UNIQUE INDEX "class_one_primary_coach" ON "ClassMember" ("classId") WHERE "isPrimary";
CREATE UNIQUE INDEX "feedback_one_generic_member_coach" ON "CoachFeedback" ("memberId", "coachId") WHERE "classId" IS NULL;

-- Deferred so replacing a primary can demote then promote inside a transaction.
CREATE FUNCTION scms_require_primary_coach() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'ClassSchedule' THEN
    IF NEW.status = 'SCHEDULED' AND NEW."endTime" > CURRENT_TIMESTAMP AND NEW."termId" IS NULL
    THEN RAISE EXCEPTION 'TERM_REQUIRED'; END IF;
  END IF;
  target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."classId" ELSE NEW."classId" END;
  IF EXISTS (SELECT 1 FROM "ClassSchedule" WHERE "classId" = target_id AND status = 'SCHEDULED' AND "endTime" > CURRENT_TIMESTAMP)
    AND (SELECT COUNT(*) FROM "ClassMember" WHERE "classId" = target_id AND "isPrimary") <> 1
  THEN RAISE EXCEPTION 'CLASS_PRIMARY_COACH_REQUIRED'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "class_primary_assignment_guard" AFTER INSERT OR UPDATE OR DELETE ON "ClassMember"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION scms_require_primary_coach();
CREATE CONSTRAINT TRIGGER "schedule_primary_assignment_guard" AFTER INSERT OR UPDATE ON "ClassSchedule"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION scms_require_primary_coach();
COMMIT;
