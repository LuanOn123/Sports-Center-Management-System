import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Serialize mua/gia hạn gói của MỘT member (Policy A: 1 member = 1 ACTIVE).
 * Hai purchase/renew/webhook-settlement đồng thời cho cùng member phải xếp hàng,
 * nếu không cả hai cùng đọc ACTIVE cũ rồi cùng SUSPEND + cùng tạo ACTIVE mới.
 * Lock sống trong transaction, tự release khi commit/rollback.
 */
export async function lockMemberSubscription(db: DbClient, memberId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('membership:member:' || ${memberId}::text))`;
}

/**
 * Thứ tự lock bắt buộc cho mọi flow đặt chỗ / đổi chỗ / hình phạt:
 *
 *   1. `lockMemberQuota()`  — quota là tài nguyên theo MỘT memberId (không phải memberId × classId)
 *   2. `lockMemberClass()`  — chỗ đặt trong một (member × class)
 *   3. `lockSchedule()`     — sức chứa của một buổi
 *
 * `lockSchedules()` (nhiều buổi) cũng phải gọi SAU cùng thứ tự trên.
 * Tuyệt đối không lock ngược thứ tự ở bất kỳ service nào (deadlock).
 * Lock sống trong transaction, tự release khi commit/rollback.
 */

/**
 * Serialize quota lớp học song song của một hội viên.
 * Hai request đồng thời đặt 2 Class khác nhau cho cùng member phải xếp hàng,
 * nếu không cả hai cùng đọc `used < limit` rồi cùng commit -> vượt quota.
 */
export async function lockMemberQuota(db: DbClient, memberId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('enrollment:member-quota:' || ${memberId}::text))`;
}

/**
 * Advisory lock dùng chung cho mọi thao tác ảnh hưởng tới chỗ đặt của một (member × class):
 * bookClass / transferEnrollment / attendance penalty apply & restore.
 * Luôn gọi SAU `lockMemberQuota()` và TRƯỚC `lockSchedule()`.
 */
export async function lockMemberClass(db: DbClient, memberId: string, classId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('enrollment:member-class:' || ${memberId}::text || ':' || ${classId}::text))`;
}

/** Serialize theo schedule (chống overbooking). Luôn gọi SAU lockMemberQuota/lockMemberClass. */
export async function lockSchedule(db: DbClient, scheduleId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('enrollment:schedule:' || ${scheduleId}::text))`;
}

/** Lock nhiều schedule theo thứ tự cố định để tránh deadlock giữa các transaction. */
export async function lockSchedules(db: DbClient, scheduleIds: string[]) {
  for (const id of [...new Set(scheduleIds)].sort()) {
    await lockSchedule(db, id);
  }
}

/**
 * Serialize xử lý WEBHOOK THANH TOÁN cho MỘT payment (SePay).
 *
 * Hai webhook khác `sepayId` cùng trỏ về một đơn phải xếp hàng, nếu không cả hai cùng đọc
 * `Payment.status = PENDING` rồi cùng kích hoạt gói → tạo 2 subscription cho một lần thu tiền.
 * Lock này KHÔNG thuộc chuỗi lock enrollment: trong transaction webhook nó là lock duy nhất
 * (claim `SepayWebhookEvent` đã tự serialize theo `sepayId`).
 */
export async function lockPaymentWebhook(db: DbClient, paymentId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payment:webhook:' || ${paymentId}::text))`;
}

/**
 * Phase 1 — serialize check-in vào cửa của một hội viên.
 * Hai request check-in đồng thời của cùng member phải xếp hàng để cửa sổ
 * chống-duplicate đọc được dữ liệu mới nhất (không tạo 2 lượt trong vài giây).
 * Lock sống trong transaction, tự release khi commit/rollback.
 */
export async function lockMemberCheckIn(db: DbClient, memberId: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('facility-visit:member:' || ${memberId}::text))`;
}
