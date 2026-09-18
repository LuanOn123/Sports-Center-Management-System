import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { createNotification } from "../notifications/notifications.service.js";
import type { CreateSubscriptionInput, RenewSubscriptionInput } from "./subscriptions.schema.js";

async function autoCreateInvoice(
  memberId: string,
  paymentId: string,
  amount: number
) {
  await prisma.invoice.create({
    data: {
      invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      memberId,
      paymentId,
      subtotal: amount,
      discount: 0,
      total: amount,
      status: "ISSUED",
      issuedAt: new Date(),
    },
  });
}

export async function createSubscription(
  data: CreateSubscriptionInput,
  createdById: string
) {
  // Resolve member (accept userId or profileId)
  const memberProfile = await prisma.memberProfile.findFirst({
    where: { OR: [{ id: data.memberId }, { userId: data.memberId }] },
    include: { user: true },
  });
  if (!memberProfile) throw new AppError("Member not found", 404);
  
  // BR-16 Check: User must currently be a MEMBER and active
  if (!memberProfile.user.isActive || memberProfile.user.role !== "MEMBER") {
    throw new AppError("Cannot create subscription: user is not an active MEMBER", 400);
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id: data.planId } });
  if (!plan || !plan.isActive) throw new AppError("Membership plan not found or inactive", 404);

  const startDate = data.startDate ? new Date(data.startDate) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.durationDays);

  return prisma.$transaction(async (tx) => {
    // Resolve member's user for snapshot
    const memberUser = await tx.user.findUnique({ where: { id: memberProfile.userId }, select: { fullName: true } });

    // Suspend existing ACTIVE subscriptions
    await tx.membershipSubscription.updateMany({
      where: { memberId: memberProfile.id, status: "ACTIVE" },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });

    const subscription = await tx.membershipSubscription.create({
      data: {
        memberId: memberProfile.id,
        planId: plan.id,
        tier: plan.tier,
        startDate,
        endDate,
        status: "ACTIVE",
      },
      include: { plan: true },
    });

    // Create payment
    const payment = await tx.payment.create({
      data: {
        memberId: memberProfile.id,
        subscriptionId: subscription.id,
        amount: plan.price,
        method: data.paymentMethod,
        status: "SUCCESS",
        paidAt: new Date(),
        note: data.note,
        createdById,
      },
    });

    // Auto-create invoice with BR-25 snapshot fields
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        memberId: memberProfile.id,
        paymentId: payment.id,
        subtotal: Number(plan.price),
        discount: 0,
        total: Number(plan.price),
        status: "ISSUED",
        issuedAt: new Date(),
        memberName: memberUser?.fullName ?? null,
        planName: plan.name,
        planTier: plan.tier,
      },
    });

    return { subscription, payment, invoice };
  });
}

export async function renewSubscription(
  subscriptionId: string,
  data: RenewSubscriptionInput,
  createdById: string
) {
  const existing = await prisma.membershipSubscription.findUnique({
    where: { id: subscriptionId },
    include: { member: { include: { user: true } } },
  });
  if (!existing) throw new AppError("Subscription not found", 404);

  // BR-16 Check: User must currently be a MEMBER and active
  if (!existing.member.user.isActive || existing.member.user.role !== "MEMBER") {
    throw new AppError("Cannot renew subscription: user is no longer an active MEMBER", 400);
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id: data.planId } });
  if (!plan || !plan.isActive) throw new AppError("Membership plan not found or inactive", 404);

  // New start: after existing endDate if still active, else now
  const now = new Date();
  const startDate =
    existing.status === "ACTIVE" && existing.endDate > now ? existing.endDate : now;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.durationDays);

  return prisma.$transaction(async (tx) => {
    // BR-25: Get member's name for snapshot
    const memberUser = await tx.user.findFirst({
      where: { memberProfile: { id: existing.memberId } },
      select: { fullName: true },
    });

    const subscription = await tx.membershipSubscription.create({
      data: {
        memberId: existing.memberId,
        planId: plan.id,
        tier: plan.tier,
        startDate,
        endDate,
        status: "ACTIVE",
      },
      include: { plan: true },
    });

    const payment = await tx.payment.create({
      data: {
        memberId: existing.memberId,
        subscriptionId: subscription.id,
        amount: plan.price,
        method: data.paymentMethod,
        status: "SUCCESS",
        paidAt: new Date(),
        note: data.note,
        createdById,
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        memberId: existing.memberId,
        paymentId: payment.id,
        subtotal: Number(plan.price),
        discount: 0,
        total: Number(plan.price),
        status: "ISSUED",
        issuedAt: new Date(),
        memberName: memberUser?.fullName ?? null,
        planName: plan.name,
        planTier: plan.tier,
      },
    });

    return { subscription, payment, invoice };
  });
}

export async function getMemberSubscriptions(memberId: string, query: any, currentUser: any) {
  const memberProfile = await prisma.memberProfile.findFirst({
    where: { OR: [{ id: memberId }, { userId: memberId }] },
  });
  if (!memberProfile) throw new AppError("Member not found", 404);

  // BR-01 Fix: IDOR protection
  if (currentUser.role === "MEMBER" && memberProfile.userId !== currentUser.id) {
    throw new AppError("Forbidden: You can only view your own subscriptions", 403);
  }
  if (currentUser.role === "COACH") {
    // For now, coaches are not allowed to view financial subscriptions of members.
    // If business logic requires it later, we can check if the member is in their classes.
    throw new AppError("Forbidden: Coaches cannot view member financial subscriptions", 403);
  }

  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;
  const where: any = { memberId: memberProfile.id };
  if (query.status) where.status = query.status;

  const [total, subscriptions] = await Promise.all([
    prisma.membershipSubscription.count({ where }),
    prisma.membershipSubscription.findMany({
      where,
      skip,
      take: limit,
      include: { plan: true, payments: { include: { invoice: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { subscriptions, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getSubscriptionById(id: string) {
  const sub = await prisma.membershipSubscription.findUnique({
    where: { id },
    include: {
      plan: true,
      member: { include: { user: { select: { fullName: true, email: true } } } },
      payments: { include: { invoice: true } },
    },
  });
  if (!sub) throw new AppError("Subscription not found", 404);
  return sub;
}

export async function updateSubscriptionStatus(id: string, status: string) {
  const sub = await prisma.membershipSubscription.findUnique({ where: { id } });
  if (!sub) throw new AppError("Subscription not found", 404);

  // BR-15: Suspension state machine
  const now = new Date();
  const updateData: any = { status };

  if (status === "SUSPENDED" && sub.status === "ACTIVE") {
    // Save how many days are left so we can restore when resuming
    const msLeft = sub.endDate.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    updateData.suspendedAt = now;
    updateData.remainingDays = daysLeft;
  }

  if (status === "ACTIVE" && sub.status === "SUSPENDED") {
    // Resume: add back remaining days from suspension point
    const daysToAdd = sub.remainingDays ?? 0;
    const newEndDate = new Date();
    newEndDate.setDate(now.getDate() + daysToAdd);
    updateData.endDate = newEndDate;
    updateData.suspendedAt = null;
    updateData.remainingDays = null;
  }

  const updated = await prisma.membershipSubscription.update({
    where: { id },
    data: updateData,
    include: {
      plan: true,
      member: { include: { user: true } },
    },
  });

  // Notify member on CANCELLED
  if (status === "CANCELLED") {
    createNotification(
      updated.member.userId,
      "SUBSCRIPTION_CANCELLED",
      "Gói tập của bạn đã bị hủy",
      `Gói "${updated.plan.name}" đã bị hủy. Nếu có thắc mắc, vui lòng liên hệ nhân viên.`,
    ).catch(() => {});
  }

  return updated;
}
