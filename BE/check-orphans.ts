import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL!.replace("?schema=scms_verify_1", ""), // use default public/sport_center_db
    },
  },
});

async function main() {
  console.log("Checking Orphans in Production Data...");

  // 1. MembershipSubscription.memberId
  const subMemberOrphan = await prisma.membershipSubscription.count({
    where: { member: null },
  });
  console.log("MembershipSubscription without member:", subMemberOrphan);

  // 2. MembershipSubscription.planId
  const subPlanOrphan = await prisma.membershipSubscription.count({
    where: { plan: null },
  });
  console.log("MembershipSubscription without plan:", subPlanOrphan);

  // 3. Enrollment.memberId
  const enrollMemberOrphan = await prisma.enrollment.count({
    where: { member: null },
  });
  console.log("Enrollment without member:", enrollMemberOrphan);

  // 4. Payment.memberId
  const paymentMemberOrphan = await prisma.payment.count({
    where: { member: null },
  });
  console.log("Payment without member:", paymentMemberOrphan);

  // 5. Invoice.paymentId
  const invoicePaymentOrphan = await prisma.invoice.count({
    where: { payment: null },
  });
  console.log("Invoice without payment:", invoicePaymentOrphan);

  // 6. Duplicate ACTIVE memberships per Member
  const dupSubs = await prisma.$queryRaw`
    SELECT "memberId", COUNT(*) as c
    FROM "MembershipSubscription"
    WHERE status = 'ACTIVE'
    GROUP BY "memberId"
    HAVING COUNT(*) > 1
  `;
  console.log("Duplicate ACTIVE Memberships per Member:", dupSubs);

  // 7. PAID payment but no subscription/enrollment (if required)
  const paidOrphans = await prisma.payment.count({
    where: {
      status: "SUCCESS",
      subscriptionId: null,
      // what about enrollment? Currently payments only link to subscription in DB schema.
      // Or they might be something else?
    }
  });
  console.log("SUCCESS Payments without subscription:", paidOrphans);
  
  // 8. Enrollment = BOOKED but schedule already invalid
  const invalidBookings = await prisma.enrollment.count({
    where: {
      status: "BOOKED",
      schedule: { status: { not: "SCHEDULED" } },
    }
  });
  console.log("BOOKED enrollments on non-SCHEDULED schedules:", invalidBookings);
}

main().catch(console.error).finally(() => prisma.$disconnect());
