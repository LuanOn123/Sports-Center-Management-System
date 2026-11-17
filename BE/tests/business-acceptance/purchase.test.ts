import { at, cases, DAY, MINUTE, NOW, schemaCases } from "./support.js";
import assert from "node:assert/strict";
import { Prisma, type MembershipPlan, type MemberTier } from "@prisma/client";
import { AppError } from "../../src/middlewares/errorHandler.js";
import { CreatePlanSchema, UpdatePlanSchema } from "../../src/modules/membership-plans/membership-plans.schema.js";
import { inspectPlanPurchase, planAmount } from "../../src/modules/subscriptions/subscription-purchase.service.js";
import { CreateSubscriptionSchema, RenewSubscriptionSchema } from "../../src/modules/subscriptions/subscriptions.schema.js";

function makePlan(tier: MemberTier, price = 300_000): MembershipPlan {
  return {
    id: `plan-${tier}`, name: tier, description: null,
    tier, price: new Prisma.Decimal(price), durationDays: 30,
    maxConcurrentClasses: tier === "PREMIUM" ? 6 : tier === "MEMBERSHIP" ? 3 : 0,
    isActive: true, createdAt: NOW, updatedAt: NOW,
  };
}

type PurchaseCase = readonly [
  name: string, current: MemberTier | null, next: MemberTier, expiry: number,
  requested: number | string | undefined,
  expected: readonly [status: "ACTIVE" | "SCHEDULED", start: number, suspends: boolean] | number,
  queued?: boolean, errorCode?: string,
];

cases<PurchaseCase>("BR-PLAN-SWITCH", [
  ["hội viên chưa có gói mua Standard ngay", null, "MEMBERSHIP", 0, undefined, ["ACTIVE", 0, false]],
  ["hội viên chưa có gói chọn ngày bắt đầu", null, "PREMIUM", 0, DAY, ["SCHEDULED", DAY, false]],
  ["chọn đúng mốc hôm nay cấp gói ngay", null, "MEMBERSHIP", 0, 0, ["ACTIVE", 0, false]],
  ["ngày được chọn trong quá khứ vẫn bắt đầu hôm nay", null, "PREMIUM", 0, -DAY, ["ACTIVE", 0, false]],
  ["ngày đặt trước đúng 60 ngày hợp lệ", null, "MEMBERSHIP", 0, 60 * DAY, ["SCHEDULED", 60 * DAY, false]],
  ["ngày đặt trước 60 ngày cộng 1 ms bị chặn", null, "MEMBERSHIP", 0, 60 * DAY + 1, 400],
  ["FREE nhường quyền khi Standard có hiệu lực ngay", "FREE", "MEMBERSHIP", 365 * DAY, undefined, ["ACTIVE", 0, true]],
  ["FREE giữ quyền đến ngày bắt đầu Premium", "FREE", "PREMIUM", 365 * DAY, DAY, ["SCHEDULED", DAY, false]],
  ["FREE hiện tại không kéo dài thời gian chờ của gói mới", "FREE", "MEMBERSHIP", 3650 * DAY, 60 * DAY, ["SCHEDULED", 60 * DAY, false]],
  ["gói FREE không thể bán kể cả khách mới", null, "FREE", 0, undefined, 400, false, "FREE_PLAN_NOT_FOR_SALE"],
  ["gói FREE không xuất hiện như lựa chọn hạ cấp", "PREMIUM", "FREE", 20 * DAY, undefined, 400, false, "FREE_PLAN_NOT_FOR_SALE"],
  ["ngày bắt đầu không đọc được bị chặn", null, "MEMBERSHIP", 0, "không-phải-ngày", 400],
  ["gói chờ đã thanh toán chặn mua Standard mới", null, "MEMBERSHIP", 0, undefined, 409, true, "SCHEDULED_SUBSCRIPTION_EXISTS"],
  ["gói chờ chặn nâng cấp Premium", "MEMBERSHIP", "PREMIUM", 15 * DAY, undefined, 409, true, "SCHEDULED_SUBSCRIPTION_EXISTS"],
  ["gói chờ chặn gia hạn Premium lần nữa", "PREMIUM", "PREMIUM", DAY, undefined, 409, true, "SCHEDULED_SUBSCRIPTION_EXISTS"],
  ["Standard tự nối tiếp khi còn hạn", "MEMBERSHIP", "MEMBERSHIP", 10 * DAY, undefined, ["SCHEDULED", 10 * DAY, false]],
  ["Premium tự nối tiếp khi còn hạn", "PREMIUM", "PREMIUM", DAY, undefined, ["SCHEDULED", DAY, false]],
  ["gia hạn nhận đúng mốc hết hạn được chỉ định", "MEMBERSHIP", "MEMBERSHIP", 10 * DAY, 10 * DAY, ["SCHEDULED", 10 * DAY, false]],
  ["gia hạn chấp nhận sai lệch làm tròn đúng một phút", "MEMBERSHIP", "MEMBERSHIP", DAY, DAY - MINUTE, ["SCHEDULED", DAY, false]],
  ["gia hạn sớm hơn mốc trên một phút bị chặn", "MEMBERSHIP", "MEMBERSHIP", DAY, DAY - MINUTE - 1, 400, false, "RENEWAL_START_DATE_CONFLICT"],
  ["gia hạn tạo khoảng trống trên một phút bị chặn", "PREMIUM", "PREMIUM", DAY, DAY + MINUTE + 1, 400, false, "RENEWAL_START_DATE_CONFLICT"],
  ["gia hạn tại đúng thời điểm hết hạn bắt đầu ngay", "MEMBERSHIP", "MEMBERSHIP", 0, undefined, ["ACTIVE", 0, false]],
  ["gói lưu ACTIVE nhưng đã hết hạn không trì hoãn gia hạn", "PREMIUM", "PREMIUM", -1, undefined, ["ACTIVE", 0, false]],
  ["nâng Premium ngay dừng quyền Standard", "MEMBERSHIP", "PREMIUM", 20 * DAY, undefined, ["ACTIVE", 0, true]],
  ["nâng Premium ngày tới giữ quyền Standard", "MEMBERSHIP", "PREMIUM", 20 * DAY, DAY, ["SCHEDULED", DAY, false]],
  ["nâng Premium tương lai sau khi gói cũ hết hạn giữ ngày đã chọn", "MEMBERSHIP", "PREMIUM", DAY, 5 * DAY, ["SCHEDULED", 5 * DAY, false]],
  ["nâng Premium đúng 60 ngày hợp lệ", "MEMBERSHIP", "PREMIUM", DAY, 60 * DAY, ["SCHEDULED", 60 * DAY, false]],
  ["nâng Premium quá 60 ngày bị chặn", "MEMBERSHIP", "PREMIUM", DAY, 60 * DAY + 1, 400],
  ["hạ Standard không có ngày tự nối sau Premium", "PREMIUM", "MEMBERSHIP", 30 * DAY, undefined, ["SCHEDULED", 30 * DAY, false]],
  ["hạ Standard sớm hơn hạn Premium 1 ms bị chặn", "PREMIUM", "MEMBERSHIP", DAY, DAY - 1, 400],
  ["hạ Standard tại mốc hết hạn Premium hợp lệ", "PREMIUM", "MEMBERSHIP", DAY, DAY, ["SCHEDULED", DAY, false]],
  ["hạ Standard tối đa 60 ngày sau hạn Premium", "PREMIUM", "MEMBERSHIP", DAY, 61 * DAY, ["SCHEDULED", 61 * DAY, false]],
  ["hạ Standard vượt mốc 60 ngày sau hạn Premium bị chặn", "PREMIUM", "MEMBERSHIP", DAY, 61 * DAY + 1, 400],
  ["hạ Standard sau khi Premium đã hết hạn bắt đầu ngay", "PREMIUM", "MEMBERSHIP", -1, undefined, ["ACTIVE", 0, false]],
], async ([, current, next, expiry, requested, expected, queued, errorCode]) => {
  const reads: string[] = [];
  const db = {
    membershipSubscription: {
      async findFirst({ where }: { where: { memberId: string; status: string } }) {
        assert.equal(where.memberId, "member-test");
        reads.push(where.status);
        if (where.status === "SCHEDULED") return queued ? { id: "paid-queued" } : null;
        assert.equal(where.status, "ACTIVE");
        return current ? { id: "current", tier: current, endDate: at(expiry), plan: makePlan(current) } : null;
      },
    },
  } as unknown as Parameters<typeof inspectPlanPurchase>[0];
  const date = typeof requested === "number" ? at(requested) : requested;
  const result = inspectPlanPurchase(db, "member-test", makePlan(next), date, NOW);
  if (typeof expected === "number") {
    await assert.rejects(result, (error: AppError) =>
      error instanceof AppError && error.statusCode === expected &&
      (!errorCode || (error.errors as { code?: string })?.code === errorCode));
  } else {
    const resolved = await result;
    assert.deepEqual([resolved.targetStatus, +resolved.calculatedStartDate - +NOW, resolved.shouldSuspendCurrentActive], expected);
    assert.deepEqual(reads, ["SCHEDULED", "ACTIVE"]);
  }
  if (queued) assert.deepEqual(reads, ["SCHEDULED"]);
});

cases("BR-PAY-PRICE", [
  ["giữ nguyên số VND gói tiêu chuẩn", 300_000, 300_000],
  ["giữ nguyên giá một đồng", 1, 1],
  ["giữ giá cao trong giới hạn Decimal(12,2)", 9_999_999_999, 9_999_999_999],
  ["gói thu tiền không có giá 0", 0, null],
  ["không thể ghi thu giá âm", -1, null],
  ["không làm tròn phần lẻ dương", 300_000.25, null],
  ["giá không hữu hạn bị chặn", Infinity, null],
  ["giá vượt phạm vi nguyên an toàn bị chặn", Number.MAX_SAFE_INTEGER + 1, null],
] as const, ([, amount, expected]) => {
  const plan = makePlan("MEMBERSHIP", amount);
  if (expected === null)
    assert.throws(() => planAmount(plan), { statusCode: 409, errors: { code: "INVALID_PLAN_PRICE" } });
  else assert.equal(planAmount(plan), expected);
});

const planDraft = { name: "Gói 30 ngày", price: 300_000, durationDays: 30, tier: "MEMBERSHIP" };
schemaCases("BR-PLAN-CATALOG", CreatePlanSchema, [
  ["tạo Standard từ giá VND và thời hạn", planDraft, true],
  ["tạo Premium có quota tùy chỉnh", { ...planDraft, tier: "PREMIUM", maxConcurrentClasses: 8 }, true],
  ["cho phép quota 0 trên gói chưa gồm quyền học", { ...planDraft, maxConcurrentClasses: 0 }, true],
  ["không tạo FREE từ danh mục bán", { ...planDraft, tier: "FREE" }, false, "tier"],
  ["không tạo gói trả phí giá 0", { ...planDraft, price: 0 }, false, "price"],
  ["không tạo gói trả phí giá lẻ", { ...planDraft, price: 300_000.5 }, false, "price"],
  ["không tạo gói thời hạn 0 ngày", { ...planDraft, durationDays: 0 }, false, "durationDays"],
  ["không chấp nhận số ngày lẻ", { ...planDraft, durationDays: 1.5 }, false, "durationDays"],
  ["không chấp nhận quota âm", { ...planDraft, maxConcurrentClasses: -1 }, false, "maxConcurrentClasses"],
  ["không chấp nhận quota lẻ", { ...planDraft, maxConcurrentClasses: 2.5 }, false, "maxConcurrentClasses"],
]);
schemaCases("BR-PLAN-UPDATE", UpdatePlanSchema, [
  ["cho phép đổi giá nguyên mà không đổi quota", { price: 350_000 }, true],
  ["cho phép ngừng bán", { isActive: false }, true],
  ["chặn chuyển gói bán thành FREE", { tier: "FREE" }, false, "tier"],
  ["chặn sửa giá thành VND lẻ", { price: 49.9 }, false, "price"],
]);

const sale = { memberId: "member-test", planId: "plan-paid", paymentMethod: "CASH" };
const requestId = "1ac2fe43-58ec-40cc-be8c-76681ef34493";
schemaCases("BR-PAY-COUNTER", CreateSubscriptionSchema, [
  ["đăng ký tiền mặt có hội viên và gói", sale, true],
  ["chuyển khoản tại quầy dùng cùng định danh yêu cầu", { ...sale, paymentMethod: "BANK_TRANSFER", requestId }, true],
  ["quầy không thể gắn phương thức SePay", { ...sale, paymentMethod: "SEPAY" }, false, "paymentMethod"],
  ["thiếu hội viên không thể tạo giao dịch", { ...sale, memberId: undefined }, false, "memberId"],
  ["thiếu gói không thể tạo giao dịch", { ...sale, planId: "" }, false, "planId"],
  ["không dùng định danh gửi lại sai định dạng", { ...sale, requestId: "not-uuid" }, false, "requestId"],
]);
schemaCases("BR-PAY-RENEW", RenewSubscriptionSchema, [
  ["gia hạn nhận định danh gửi lại hợp lệ", { planId: sale.planId, paymentMethod: "CASH", requestId }, true],
  ["gia hạn thiếu phương thức thu tiền", { planId: sale.planId }, false, "paymentMethod"],
  ["gia hạn không thể chuyển qua SePay thủ công", { planId: sale.planId, paymentMethod: "SEPAY" }, false, "paymentMethod"],
]);
