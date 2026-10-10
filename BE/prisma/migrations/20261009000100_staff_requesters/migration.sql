-- Preserve legacy Coach/Member identifiers while supporting staff requesters.
ALTER TABLE "LeaveRequest" ALTER COLUMN "coachId" DROP NOT NULL;
ALTER TABLE "LeaveRequest" ADD COLUMN "requesterId" TEXT, ADD COLUMN "requesterRole" "UserRole";
UPDATE "LeaveRequest" AS l SET "requesterId" = c."userId", "requesterRole" = 'COACH'
FROM "CoachProfile" AS c WHERE c."id" = l."coachId";
CREATE INDEX "LeaveRequest_facilityId_requesterId_idx" ON "LeaveRequest" ("facilityId", "requesterId");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_has_requester"
CHECK ("coachId" IS NOT NULL OR "requesterId" IS NOT NULL);

ALTER TABLE "Issue" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "Issue" ADD COLUMN "requesterId" TEXT, ADD COLUMN "requesterRole" "UserRole";
-- Existing Issue.memberId stores the authenticated User.id, not MemberProfile.id.
UPDATE "Issue" SET "requesterId" = "memberId", "requesterRole" = 'MEMBER';
CREATE INDEX "Issue_facilityId_requesterId_idx" ON "Issue" ("facilityId", "requesterId");
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_has_requester"
CHECK ("memberId" IS NOT NULL OR "requesterId" IS NOT NULL);
