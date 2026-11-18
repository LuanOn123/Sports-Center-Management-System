import { cases, schemaCases, withFixture } from "./support.js";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { prisma } from "../../src/config/prisma.js";
import { normalizeBankAccount, verifySepayApiKey, verifySepayHmacSignature } from "../../src/config/sepay.js";
import { SepayWebhookSchema, UpdatePaymentStatusSchema } from "../../src/modules/payments/payments.schema.js";
import { updatePaymentStatus } from "../../src/modules/payments/payments.service.js";
import { getRevenueReport } from "../../src/modules/reports/reports.service.js";
import { findRefundReceptionist } from "../../src/modules/notifications/notifications.service.js";
import { cancelPaymentRefund } from "../../src/modules/payments/refunds.service.js";
import { requestContext } from "../../src/config/request-context.js";
import { completeSchedule } from "../../src/modules/class-schedules/class-schedules.service.js";
import { feedbackEligibility, createFeedback } from "../../src/modules/feedbacks/feedbacks.service.js";

cases("BR-MEMBER-COURSE-REVIEW", [
  ["chưa học không được đánh giá", [], 0, false],
  ["đã học nhưng khóa còn buổi chưa kết thúc không được đánh giá", [{ termId: "term-a" }], 1, false],
  ["khóa trong kỳ đã kết thúc được đánh giá", [{ termId: "term-a" }], 0, true],
  ["lớp legacy không có kỳ cũng chờ buổi cuối kết thúc", [{ termId: null }], 1, false],
] as const, async ([, learned, remaining, eligible]) => {
  await withFixture([
    [prisma.memberProfile, "findUnique", () => ({ id: "member-a" })],
    [prisma.classSchedule, "findMany", ({ where, orderBy, take }) => {
      assert.equal(where.classId, "class-a"); assert.equal(take, 1);
      assert.deepEqual(orderBy, { endTime: "desc" });
      assert.equal(where.AND[0].OR[0].coachId, "coach-a");
      return learned;
    }],
    [prisma.classSchedule, "count", ({ where }) => {
      assert.equal(where.termId, learned[0]?.termId); assert.equal(where.classId, "class-a");
      assert.deepEqual(where.status, { not: "CANCELLED" }); return remaining;
    }],
  ], async () => {
    assert.equal((await feedbackEligibility("member-user", "coach-a", "class-a")).eligible, eligible);
    if (!eligible) await assert.rejects(() => createFeedback({ coachId: "coach-a", classId: "class-a", rating: 5, isAnonymous: false }, "member-user"),
      (error: any) => error.statusCode === 403 && error.errors.code === "FEEDBACK_COURSE_NOT_FINISHED");
  });
});

cases("BR-COACH-COMPLETE", [
  ["HLV không có hồ sơ không được hoàn tất lịch", false, false, "SCHEDULED", 403],
  ["HLV không được phân công không được hoàn tất lịch", true, false, "SCHEDULED", 403],
  ["HLV được phân công vẫn không được hoàn tất trước giờ kết thúc", true, true, "SCHEDULED", 400],
  ["HLV được phân công đọc lại buổi đã hoàn tất không ghi lặp", true, true, "COMPLETED", 0],
] as const, async ([, hasProfile, assigned, status, errorStatus]) => {
  await withFixture([
    [prisma.coachProfile, "findUnique", () => hasProfile ? { id: "coach-a" } : null],
    [prisma.classSchedule, "findFirst", ({ where }) => {
      assert.equal(where.id, "schedule-a"); assert.equal(where.OR[0].coachId, "coach-a");
      return assigned ? { id: "schedule-a" } : null;
    }],
    [prisma.classSchedule, "findUnique", () => ({ id: "schedule-a", status, endTime: new Date(Date.now() + 60000) })],
    [prisma, "$transaction", () => assert.fail("Blocked or repeated completion must not write")],
  ], async () => {
    const run = () => completeSchedule("schedule-a", { id: "coach-user", role: "COACH" });
    if (errorStatus) await assert.rejects(run, (error: any) => error.statusCode === errorStatus);
    else assert.equal((await run()).status, "COMPLETED");
  });
});

cases("BR-PAY-CANCEL-REFUND", [
  ["hủy yêu cầu đang chờ, giữ trạng thái tiền và lưu lý do", "SUCCESS", true, "facility-a", "RECEPTIONIST", "Hội viên gửi nhầm yêu cầu", 0],
  ["không hủy giao dịch đã trả tiền", "REFUNDED", true, "facility-a", "RECEPTIONIST", "Hội viên gửi nhầm yêu cầu", 409],
  ["không hủy lặp yêu cầu đã xử lý", "SUCCESS", false, "facility-a", "RECEPTIONIST", "Hội viên gửi nhầm yêu cầu", 409],
  ["không xử lý yêu cầu cơ sở khác", "SUCCESS", true, "facility-b", "RECEPTIONIST", "Hội viên gửi nhầm yêu cầu", 403],
  ["không cho hội viên tự dùng API của lễ tân", "SUCCESS", true, "facility-a", "MEMBER", "Hội viên gửi nhầm yêu cầu", 403],
  ["không nhận lý do chỉ có khoảng trắng", "SUCCESS", true, "facility-a", "RECEPTIONIST", "   ", 400],
] as const, async ([, status, pending, facilityId, role, reason, errorStatus]) => {
  const original = { id: "payment-a", status, facilityId: "facility-a", refundRequestedAt: pending ? new Date("2026-11-18") : null,
    refundRequestedAmount: 90000, refundReason: "Lý do gốc", member: { userId: "member-a" } };
  const writes: string[] = [];
  const tx = {
    $executeRaw: async () => 1,
    payment: {
      findUnique: async () => original,
      updateMany: async ({ where, data }: any) => {
        assert.deepEqual(where, { id: original.id, status: "SUCCESS", refundRequestedAt: original.refundRequestedAt });
        assert.deepEqual(data, { refundRequestedAt: null, refundRequestedAmount: null, refundReason: null });
        writes.push("payment"); return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...original, refundRequestedAt: null }),
    },
    auditLog: { create: async ({ data }: any) => {
      assert.equal(data.reason, reason.trim()); assert.equal(data.action, "cancelRefund");
      assert.equal(data.before.refundRequestedAmount, 90000); writes.push("audit");
    } },
    notification: { create: async ({ data }: any) => {
      assert.equal(data.userId, "member-a"); assert.equal(data.reason, reason.trim()); writes.push("notification");
    } },
  };
  await withFixture([[prisma, "$transaction", async (callback) => callback(tx)]], async () => {
    await requestContext.run({ facilityId }, async () => {
      const run = () => cancelPaymentRefund(original.id, reason, { id: "reception-a", role });
      if (errorStatus) await assert.rejects(run, (error: any) => error.statusCode === errorStatus);
      else assert.equal((await run()).status, "SUCCESS");
    });
  });
  assert.deepEqual(writes, errorStatus ? [] : ["payment", "audit", "notification"]);
});

cases("BR-PAY-REFUND-RECEPTION", [
  ["chọn lễ tân được phân công đúng cơ sở", "facility-a", { id: "reception-a", fullName: "Lễ tân A" }],
  ["không tìm ở cơ sở khác khi cơ sở giao dịch thiếu lễ tân", "facility-b", null],
  ["không tìm lễ tân toàn hệ thống khi thiếu cơ sở giao dịch", null, null],
] as const, async ([, facilityId, expected]) => {
  let calls = 0;
  await withFixture([[prisma.facilityStaff, "findFirst", ({ where }) => {
    calls++;
    assert.deepEqual(where, {
      facilityId, role: "RECEPTIONIST", isActive: true, facility: { isActive: true },
      user: { role: "RECEPTIONIST", isActive: true },
    });
    return expected ? { user: expected } : null;
  }]], async () => {
    assert.deepEqual(await findRefundReceptionist(facilityId), expected);
    assert.equal(calls, facilityId ? 1 : 0);
  });
});

const transfer = {
  id: 123,
  transferType: "in",
  transferAmount: 300_000,
  accountNumber: "00123456",
  code: "SEVQR12345678",
};
schemaCases("BR-PAY-WEBHOOK", SepayWebhookSchema, [
  ["nhận dữ liệu chuyển khoản vào", transfer, true],
  ["phân loại được tiền ra để bỏ qua", { ...transfer, transferType: "out" }, true],
  ["không suy diễn chiều tiền khi thiếu", { ...transfer, transferType: undefined }, false, "transferType"],
  ["từ chối chiều tiền không có trong hợp đồng", { ...transfer, transferType: "credit" }, false, "transferType"],
  ["từ chối chiều tiền null", { ...transfer, transferType: null }, false, "transferType"],
  ["thiếu mã ID chống lặp bị từ chối", { ...transfer, id: undefined }, false, "id"],
  ["ID âm không hợp lệ", { ...transfer, id: -1 }, false, "id"],
  ["ID không nguyên không hợp lệ", { ...transfer, id: 1.2 }, false, "id"],
  ["ID null không được chuyển ngầm thành 0", { ...transfer, id: null }, false, "id"],
  ["không ghi ID vượt giới hạn cột PostgreSQL", { ...transfer, id: 2_147_483_648 }, false, "id"],
  ["nhận trường ID dạng chuỗi số", { ...transfer, id: "125" }, true],
  ["số tiền dạng chuỗi số được chuyển thành số", { ...transfer, transferAmount: "300000" }, true],
  ["thiếu số tiền không thể chốt", { ...transfer, transferAmount: undefined }, false, "transferAmount"],
  ["từ chối số tiền bằng 0", { ...transfer, transferAmount: 0 }, false, "transferAmount"],
  ["từ chối số tiền âm", { ...transfer, transferAmount: -300_000 }, false, "transferAmount"],
  ["từ chối số tiền vô hạn", { ...transfer, transferAmount: "Infinity" }, false, "transferAmount"],
  ["từ chối số tiền sai định dạng", { ...transfer, transferAmount: "300.000 VND" }, false, "transferAmount"],
  ["boolean không được chuyển ngầm thành một đồng", { ...transfer, transferAmount: true }, false, "transferAmount"],
  ["cho phép SePay trả mã đơn null để tìm theo nội dung", { ...transfer, code: null, content: "SEVQR12345678" }, true],
  ["chuyển thiếu lẻ được giữ cho đối soát ở tầng nghiệp vụ", { ...transfer, transferAmount: 299_999.75 }, true],
]);

cases("BR-PAY-BANK", [
  ["giữ số 0 ở đầu số tài khoản", "001234", "001234"],
  ["bỏ ký tự trang trí từ định dạng ngân hàng", " 001-23.456 ", "00123456"],
  ["chuẩn hóa mã tài khoản ảo", "vcb-009a", "VCB009A"],
  ["tài khoản thiếu không suy diễn thành số 0", null, ""],
] as const, ([, input, expected]) => assert.equal(normalizeBankAccount(input), expected));

cases("BR-PAY-APIKEY", [
  ["chấp nhận đúng thông tin xác thực", "Apikey fixture-key", "fixture-key", true],
  ["kiểu chữ của scheme không đổi khóa", "APIKEY fixture-key", "fixture-key", true],
  ["khóa sai cùng độ dài bị từ chối", "Apikey another-key", "fixture-key", false],
  ["không chấp nhận scheme Bearer", "Bearer fixture-key", "fixture-key", false],
  ["không chấp nhận header trống", undefined, "fixture-key", false],
  ["không thể ủy quyền bằng cấu hình khóa trống", "Apikey fixture-key", "", false],
] as const, ([, header, key, expected]) => assert.equal(verifySepayApiKey(header, key), expected));

cases("BR-PAY-SIGNATURE", [
  ["chữ ký gắn với đúng nội dung gốc", "valid", true],
  ["thay số tiền làm chữ ký mất hiệu lực", "amount", false],
  ["thay định dạng nội dung đã ký làm chữ ký mất hiệu lực", "bytes", false],
  ["thay dấu thời gian đã ký bị phát hiện", "timestamp", false],
  ["khóa xác thực khác không thể xác nhận chữ ký", "secret", false],
  ["thiếu chữ ký bị từ chối", "missing", false],
] as const, ([, variant, expected]) => {
  const secret = "local-fixture";
  const original = JSON.stringify(transfer);
  const timestamp = "2000000000";
  const signature = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${original}`).digest("hex");
  assert.equal(verifySepayHmacSignature({
    secret: variant === "secret" ? "other-fixture" : secret,
    rawBody: variant === "amount" ? JSON.stringify({ ...transfer, transferAmount: 10 })
      : variant === "bytes" ? original + "\n" : original,
    signature: variant === "missing" ? undefined : signature,
    timestamp: variant === "timestamp" ? "2000000001" : timestamp,
  }), expected);
});

type PaymentCase = readonly [string, string | null, string | null, string, string, number];
const validReceipt = { reason: "Đã đối soát khoản trả", reference: "REF-ORIGINAL" };
cases<PaymentCase>("BR-PAY-TRANSITION", [
  ["không cập nhật giao dịch không tồn tại", null, null, "PENDING", "none", 404],
  ["luồng đổi trạng thái không chốt thu tiền tại quầy", "PENDING", null, "SUCCESS", "none", 409],
  ["thu tiền online chỉ được chốt bằng nguồn đã xác thực", "PENDING", "SEPAY", "SUCCESS", "none", 400],
  ["không ép đơn online đang chờ thành thất bại thủ công", "PENDING", "SEPAY", "FAILED", "none", 400],
  ["đơn online đã thu không thể đưa về chờ", "SUCCESS", "SEPAY", "PENDING", "none", 400],
  ["đơn đã thu tại quầy không thể đưa về chờ", "SUCCESS", null, "PENDING", "none", 400],
  ["đơn đã thu tại quầy không thể đánh dấu thất bại", "SUCCESS", null, "FAILED", "none", 400],
  ["đơn thất bại tại quầy không thể mở lại", "FAILED", null, "PENDING", "none", 400],
  ["đơn đã hoàn tại quầy không thể mở lại", "REFUNDED", null, "PENDING", "none", 400],
  ["đơn chưa thu tại quầy không thể xác nhận hoàn", "PENDING", null, "REFUNDED", "approved", 409],
  ["đơn thất bại tại quầy không thể xác nhận hoàn", "FAILED", null, "REFUNDED", "approved", 409],
  ["hoàn tại quầy phải có lý do", "SUCCESS", null, "REFUNDED", "no-reason", 400],
  ["hoàn tại quầy phải có biên nhận", "SUCCESS", null, "REFUNDED", "no-reference", 400],
  ["hoàn online cần yêu cầu đã duyệt", "SUCCESS", "SEPAY", "REFUNDED", "unapproved", 409],
  ["hoàn tại quầy cần yêu cầu đã duyệt", "SUCCESS", null, "REFUNDED", "unapproved", 409],
  ["gửi lại xác nhận hoàn cùng biên nhận không ghi thêm", "REFUNDED", "SEPAY", "REFUNDED", "approved", 200],
  ["gửi lại biên nhận khác không được sửa bằng chứng cũ", "REFUNDED", "SEPAY", "REFUNDED", "different", 409],
  ["lặp lại trạng thái chờ tại quầy không ghi thêm", "PENDING", null, "PENDING", "none", 200],
  ["lặp lại trạng thái thất bại tại quầy không ghi thêm", "FAILED", null, "FAILED", "none", 200],
], async ([, source, gateway, target, receipt, code]) => {
  const payment = source && {
    id: "payment-test", status: source, gateway, invoice: null,
    refundRequestedAt: ["approved", "different"].includes(receipt) ? new Date(0) : null,
    refundReference: "REF-ORIGINAL",
  };
  const confirmation = receipt === "none" ? undefined : {
    reason: receipt === "no-reason" ? " " : validReceipt.reason,
    reference: receipt === "no-reference" ? " " : receipt === "different" ? "REF-OTHER" : validReceipt.reference,
  };
  await withFixture([
    [prisma.payment, "findUnique", async ({ where }) => {
      assert.equal(where.id, "payment-test");
      return payment;
    }],
    [prisma, "$transaction", () => assert.fail("a blocked or repeated action must not write anything")],
  ], async () => {
    const result = updatePaymentStatus("payment-test", target, confirmation);
    if (code === 200) assert.equal(await result, payment);
    else await assert.rejects(result, { statusCode: code });
  });
});

schemaCases("BR-PAY-RECEIPT", UpdatePaymentStatusSchema, [
  ["biên nhận có thể được đính kèm cùng trạng thái hoàn", { status: "REFUNDED", ...validReceipt }, true],
  ["biên nhận quá ngắn không hợp lệ", { status: "REFUNDED", reference: "AB" }, false, "reference"],
  ["biên nhận quá 200 ký tự không hợp lệ", { status: "REFUNDED", reference: "X".repeat(201) }, false, "reference"],
  ["trạng thái cấp gói không được dùng thay trạng thái tiền", { status: "ACTIVATED" }, false, "status"],
]);

cases("BR-REV-CASH", [
  ["đơn chờ và thất bại không góp vào thực thu", 3, 1, 900_000, 0, 0, 900_000],
  ["hoàn một phần trừ đúng khoản đã trả", 0, 0, 900_000, 270_000, 0, 630_000],
  ["hoàn toàn phần trong kỳ đưa thực nhận về 0", 0, 0, 900_000, 900_000, 0, 0],
  ["hoàn khoản thu từ kỳ trước có thể làm thực nhận âm", 0, 0, 0, 250_000, 0, -250_000],
  ["dữ liệu cũ thiếu ngày hoàn đánh dấu chưa đối soát", 0, 0, 500_000, 0, 1, 500_000],
  ["kỳ trống hiển thị 0 thay vì null", 0, 0, null, null, 0, 0],
] as const, async ([, pending, failed, collected, refunded, unreconciled, net]) => {
  const cashPeriod = { gte: new Date("2032-03-14T17:00:00Z"), lte: new Date("2032-03-15T16:59:59.999Z") };
  await withFixture([
    [prisma.payment, "aggregate", async ({ where }) => {
      if (where.refundedAt) {
        assert.deepEqual(where, { refundedAt: cashPeriod, status: "REFUNDED" });
        return { _sum: { refundedAmount: refunded }, _count: refunded ? 1 : 0 };
      }
      assert.deepEqual(where, { paidAt: cashPeriod, status: { in: ["SUCCESS", "REFUNDED"] } });
      return { _sum: { amount: collected }, _count: collected ? 1 : 0 };
    }],
    [prisma.payment, "count", async ({ where }) => {
      if (where.status === "REFUNDED") { assert.equal(where.refundedAt, null); return unreconciled; }
      assert.deepEqual(where.createdAt, cashPeriod);
      return where.status === "PENDING" ? pending : where.status === "FAILED" ? failed : pending + failed + Number(Boolean(collected));
    }],
    [prisma.payment, "groupBy", async ({ where }) => {
      assert.deepEqual(where, { paidAt: cashPeriod, status: { in: ["SUCCESS", "REFUNDED"] } });
      return collected ? [{ method: "CASH", _sum: { amount: collected } }] : [];
    }],
    [prisma.payment, "findMany", async ({ where, orderBy }) => {
      assert.deepEqual(where, { paidAt: cashPeriod, status: { in: ["SUCCESS", "REFUNDED"] } });
      assert.deepEqual(orderBy, { paidAt: "desc" });
      return [];
    }],
  ], async () => {
    const report = await getRevenueReport("2032-03-15", "2032-03-15");
    assert.deepEqual(
      [report.totalRevenue, report.refundedAmount, report.netRevenue, report.pendingPayments, report.failedPayments, report.netRevenueVerified],
      [collected ?? 0, refunded ?? 0, net, pending, failed, unreconciled === 0],
    );
    assert.equal(Object.values(report.revenueByMethod).reduce((sum, total) => sum + total, 0), report.totalRevenue);
  });
});
