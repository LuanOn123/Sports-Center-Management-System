import "dotenv/config";
import mongoose from "mongoose";
import { prisma } from "../config/prisma.js";
import { User } from "../models/User.js";

/** Read-only: run before migrations. Output IDs and counts, never passwords/emails/URLs. */
async function main() {
  if (!process.env.DATABASE_URL || !process.env.MONGO_URI)
    throw new Error("CONFIG_REQUIRED");
  await mongoose.connect(process.env.MONGO_URI);
  const duplicates = await prisma.$queryRaw<any[]>`
    SELECT 'multiple_active' AS issue, "memberId" AS id, COUNT(*)::int AS count FROM "MembershipSubscription" WHERE status = 'ACTIVE' GROUP BY "memberId" HAVING COUNT(*) > 1
    UNION ALL SELECT 'multiple_scheduled', "memberId", COUNT(*)::int FROM "MembershipSubscription" WHERE status = 'SCHEDULED' GROUP BY "memberId" HAVING COUNT(*) > 1
    UNION ALL SELECT 'multiple_primary', "classId", COUNT(*)::int FROM "ClassMember" WHERE "isPrimary" GROUP BY "classId" HAVING COUNT(*) > 1
    UNION ALL SELECT 'duplicate_generic_feedback', "memberId", COUNT(*)::int FROM "CoachFeedback" WHERE "classId" IS NULL GROUP BY "memberId", "coachId" HAVING COUNT(*) > 1`;
  const invalidTerms = await prisma.$queryRaw<
    any[]
  >`SELECT id FROM "Term" WHERE "startDate" >= "endDate" OR "registrationStartDate" >= "registrationEndDate" OR "registrationEndDate" > "endDate"`;
  const missingPrimary = await prisma.$queryRaw<
    any[]
  >`SELECT DISTINCT c.id FROM "Class" c JOIN "ClassSchedule" s ON s."classId" = c.id WHERE s.status = 'SCHEDULED' AND s."endTime" > CURRENT_TIMESTAMP AND NOT EXISTS (SELECT 1 FROM "ClassMember" cm WHERE cm."classId" = c.id AND cm."isPrimary")`;
  const refundedRights = await prisma.$queryRaw<
    any[]
  >`SELECT DISTINCT s.id FROM "MembershipSubscription" s JOIN "Payment" p ON p."subscriptionId" = s.id WHERE p.status = 'REFUNDED' AND s.status IN ('ACTIVE', 'SCHEDULED')`;
  const unassignedSessions = await prisma.classSchedule.findMany({
    where: { status: "SCHEDULED", endTime: { gt: new Date() }, termId: null },
    select: { id: true },
  });
  const legacyBookings = await prisma.enrollment.count({
    where: { subscriptionId: null },
  });
  const incompleteAccounts = await User.countDocuments({
    provisioningStatus: { $in: ["PENDING", "FAILED"] },
  });
  const missingProfiles = await prisma.$queryRaw<
    any[]
  >`SELECT u.id FROM "User" u WHERE (u.role = 'MEMBER' AND NOT EXISTS (SELECT 1 FROM "MemberProfile" p WHERE p."userId"=u.id)) OR (u.role='COACH' AND NOT EXISTS (SELECT 1 FROM "CoachProfile" p WHERE p."userId"=u.id))`;
  const projections = await prisma.user.findMany({
    select: { id: true, role: true, isActive: true },
  });
  const byId = new Map(projections.map((user) => [user.id, user]));
  const projectionMismatches: string[] = [];
  for await (const user of User.find({})
    .select("_id role isActive")
    .lean()
    .cursor()) {
    const id = String(user._id),
      pg = byId.get(id);
    if (!pg || pg.role !== user.role || pg.isActive !== user.isActive)
      projectionMismatches.push(id);
    byId.delete(id);
  }
  projectionMismatches.push(...byId.keys());
  console.log(
    JSON.stringify(
      {
        unassignedSessions,
        projectionMismatches,
        readOnly: true,
        duplicates,
        invalidTerms,
        missingPrimary,
        refundedRights,
        missingProfiles,
        incompleteAccounts,
        legacyBookings,
      },
      null,
      2,
    ),
  );
  if (
    unassignedSessions.length ||
    projectionMismatches.length ||
    duplicates.length ||
    invalidTerms.length ||
    missingPrimary.length ||
    refundedRights.length ||
    missingProfiles.length ||
    incompleteAccounts
  )
    process.exitCode = 2;
}
main()
  .catch((error) => {
    console.error("Preflight failed:", error.code ?? error.name);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([prisma.$disconnect(), mongoose.disconnect()]);
  });
