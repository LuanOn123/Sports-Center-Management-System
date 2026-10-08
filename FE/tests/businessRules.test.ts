import { describe, expect, it } from "vitest";
import {
  canCompleteSchedule,
  canGenerateAttendanceQr,
  effectiveSubscription,
  isEffectiveSubscription,
  paymentTransitions,
  subscriptionTransitions,
  terminalSessionError,
  downgradeReason,
  refundEstimate,
} from "../src/shared/businessRules";
import { translateApiMessage } from "../src/shared/apiErrors";
import { ATTENDANCE } from "../../BE/src/config/attendance";
const now = Date.parse("2026-09-18T06:00:00Z");
describe("workflow state boundaries", () => {
  it("requires ACTIVE status and both date bounds for entitlement", () => {
    const s = {
      status: "ACTIVE",
      startDate: "2026-09-01",
      endDate: "2026-10-01",
      tier: "MEMBERSHIP",
    };
    expect(isEffectiveSubscription(s, now)).toBe(true);
    expect(
      isEffectiveSubscription({ ...s, startDate: "2026-09-19" }, now),
    ).toBe(false);
    expect(isEffectiveSubscription({ ...s, endDate: "2026-09-17" }, now)).toBe(
      false,
    );
    expect(isEffectiveSubscription({ ...s, status: "SUSPENDED" }, now)).toBe(
      false,
    );
    expect(isEffectiveSubscription({ ...s, startDate: "invalid" }, now)).toBe(
      false,
    );
    expect(
      effectiveSubscription([s, { ...s, tier: "PREMIUM" }], now)?.tier,
    ).toBe("PREMIUM");
  });
  it("payment states are terminal and refunds require manager", () => {
    expect(paymentTransitions("PENDING", "MANAGER")).toEqual([
      "SUCCESS",
      "FAILED",
    ]);
    expect(paymentTransitions("SUCCESS", "MANAGER")).toEqual(["REFUNDED"]);
    expect(paymentTransitions("REFUNDED", "MANAGER")).toEqual([]);
    expect(paymentTransitions("FAILED", "MANAGER")).toEqual([]);
    expect(paymentTransitions("SUCCESS", "STAFF")).toEqual([]);
    expect(paymentTransitions("PENDING", "MANAGER", "SEPAY")).toEqual([]);
    expect(paymentTransitions("SUCCESS", "MANAGER", "SEPAY")).toEqual([]);
    expect(paymentTransitions("SUCCESS", "MANAGER", null)).toEqual([
      "REFUNDED",
    ]);
  });
  it("never resumes historical subscriptions, even with audited remaining days", () => {
    expect(subscriptionTransitions({ status: "SUSPENDED" }, "MANAGER")).toEqual(
      [],
    );
    expect(
      subscriptionTransitions(
        { status: "SUSPENDED", remainingDays: 4 },
        "MANAGER",
      ),
    ).toEqual([]);
    expect(subscriptionTransitions({ status: "EXPIRED" }, "MANAGER")).toEqual(
      [],
    );
    expect(subscriptionTransitions({ status: "ACTIVE" }, "MANAGER")).toEqual([
      "SUSPENDED",
      "CANCELLED",
    ]);
    expect(subscriptionTransitions({ status: "CANCELLED" }, "MANAGER")).toEqual(
      [],
    );
    expect(subscriptionTransitions({ status: "ACTIVE" }, "STAFF")).toEqual([]);
  });
  it("only closes scheduled sessions after their end", () => {
    expect(
      canCompleteSchedule(
        { status: "SCHEDULED", endTime: "2026-09-18T06:00:00Z" },
        now,
      ),
    ).toBe(true);
    expect(
      canCompleteSchedule(
        { status: "SCHEDULED", endTime: "2026-09-18T06:01:00Z" },
        now,
      ),
    ).toBe(false);
    expect(
      canCompleteSchedule({ status: "CANCELLED", endTime: "2026-09-17" }, now),
    ).toBe(false);
    expect(
      canCompleteSchedule({ status: "COMPLETED", endTime: "2026-09-17" }, now),
    ).toBe(false);
  });
  it("distinguishes revoked access from refreshable token expiry", () => {
    for (const message of [
      "Unauthorized: account is locked",
      "Unauthorized: role has changed, please login again",
      "Unauthorized: user not found",
    ])
      expect(terminalSessionError(message)).toBe(true);
    expect(terminalSessionError("Unauthorized: invalid or expired token")).toBe(
      false,
    );
  });
  it("translates business conflicts without changing their cause", () => {
    expect(translateApiMessage("This class is full")).toContain("đủ số lượng");
    expect(
      translateApiMessage(
        "Cannot change role: COACH is assigned to upcoming classes.",
      ),
    ).toContain("lịch dạy");
    expect(
      translateApiMessage("Subscription belongs to a different member"),
    ).toContain("hội viên khác");
    expect(translateApiMessage("Duplicate value for: phone")).not.toContain(
      "Email",
    );
  });
});

it("checks the sold duration snapshot even after a plan is edited", () => {
  const current = {
    tier: "MEMBERSHIP",
    durationDaysSnapshot: 90,
    plan: { durationDays: 30 },
  };
  expect(
    downgradeReason(current, { tier: "MEMBERSHIP", durationDays: 60 }),
  ).toContain("ngắn hơn");
  expect(
    downgradeReason(current, { tier: "MEMBERSHIP", durationDays: 90 }),
  ).toBe("");
  expect(
    downgradeReason(current, { tier: "FREE", durationDays: 3650 }),
  ).toContain("thấp hơn");
  expect(
    downgradeReason(
      { ...current, tier: "FREE" },
      { tier: "MEMBERSHIP", durationDays: 30 },
    ),
  ).toBe("");
});

it("keeps member refund boundary separate from capped manager prorating", () => {
  const end = new Date(now + 15 * 86400000).toISOString();
  expect(refundEstimate(end, 1000000, 30, "MEMBER", now).refundAmount).toBe(0);
  expect(refundEstimate(end, 1000000, 30, "MEMBER", now - 1).refundAmount).toBe(
    300000,
  );
  expect(refundEstimate(end, 1000000, 30, "MANAGER", now).refundAmount).toBe(
    500000,
  );
  expect(refundEstimate(end, 1000000, 10, "MANAGER", now).refundAmount).toBe(
    1000000,
  );
});

it("opens attendance QR only within inclusive server time bounds for scheduled sessions", () => {
  const schedule = {
    status: "SCHEDULED",
    startTime: "2026-09-27T10:00:00Z",
    endTime: "2026-09-27T11:00:00Z",
  };
  const open =
    Date.parse(schedule.startTime) -
    ATTENDANCE.SCAN_OPEN_MINUTES_BEFORE * 60_000;
  const close =
    Date.parse(schedule.endTime) + ATTENDANCE.SCAN_CLOSE_MINUTES_AFTER * 60_000;
  expect(canGenerateAttendanceQr(schedule, open - 1)).toBe(false);
  expect(canGenerateAttendanceQr(schedule, open)).toBe(true);
  expect(canGenerateAttendanceQr(schedule, close)).toBe(true);
  expect(canGenerateAttendanceQr(schedule, close + 1)).toBe(false);
  expect(
    canGenerateAttendanceQr({ ...schedule, status: "COMPLETED" }, open),
  ).toBe(false);
  expect(
    canGenerateAttendanceQr({ ...schedule, startTime: "invalid" }, open),
  ).toBe(false);
});
