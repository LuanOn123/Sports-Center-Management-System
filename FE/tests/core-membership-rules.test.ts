import { describe, expect, it } from "vitest";
import {
  canCompleteSchedule,
  canGenerateAttendanceQr,
  downgradeReason,
  effectiveSubscription,
  isEffectiveSubscription,
  membershipDateInput,
  membershipStartInstant,
  refundEstimate,
} from "../src/shared/businessRules";

const now = Date.parse("2027-01-01T00:00:00Z");
const day = 86_400_000;
const at = (offset: number) => new Date(now + offset).toISOString();
const active = {
  id: "current",
  tier: "MEMBERSHIP",
  status: "ACTIVE",
  startDate: at(-day),
  endDate: at(day),
};

describe("member entitlement boundaries", () => {
  it.each([
    {
      title: "starts at the activation instant",
      change: { startDate: at(0) },
      expected: true,
    },
    {
      title: "excludes one millisecond before activation",
      change: { startDate: at(1) },
      expected: false,
    },
    {
      title: "includes the last millisecond before expiry",
      change: { endDate: at(1) },
      expected: true,
    },
    {
      title: "expires at the exact end instant",
      change: { endDate: at(0) },
      expected: false,
    },
    {
      title: "excludes cancelled entitlements even within their original dates",
      change: { status: "CANCELLED" },
      expected: false,
    },
    {
      title:
        "excludes a scheduled subscription even if its start date has arrived",
      change: { status: "SCHEDULED" },
      expected: false,
    },
    {
      title: "fails closed if expiry is malformed",
      change: { endDate: "unknown" },
      expected: false,
    },
    {
      title: "excludes a period that has zero duration",
      change: { startDate: at(0), endDate: at(0) },
      expected: false,
    },
  ])("$title", ({ change, expected }) => {
    expect(isEffectiveSubscription({ ...active, ...change }, now)).toBe(
      expected,
    );
  });

  const premium = { ...active, id: "premium", tier: "PREMIUM" };
  it.each([
    {
      title: "ignores a higher-tier renewal waiting to start",
      subscriptions: [{ ...premium, status: "SCHEDULED" }, active],
      expected: "current",
    },
    {
      title: "ignores an expired Premium while Membership still applies",
      subscriptions: [{ ...premium, endDate: at(0) }, active],
      expected: "current",
    },
    {
      title: "chooses longer remaining access within the same tier",
      subscriptions: [
        active,
        { ...active, id: "renewal", endDate: at(30 * day) },
      ],
      expected: "renewal",
    },
    {
      title: "returns no entitlement when the only plan belongs to history",
      subscriptions: [{ ...active, status: "CANCELLED" }],
      expected: undefined,
    },
  ])("$title", ({ subscriptions, expected }) => {
    const inputOrder = subscriptions.map((subscription) => subscription.id);
    expect(effectiveSubscription(subscriptions, now)?.id).toBe(expected);
    expect(subscriptions.map((subscription) => subscription.id)).toEqual(
      inputOrder,
    );
  });
});

describe("membership dates and original sale terms", () => {
  it.each([
    ["2026-12-31T16:59:59.999Z", "2026-12-31"],
    ["2026-12-31T17:00:00.000Z", "2027-01-01"],
    ["2028-02-28T17:00:00.000Z", "2028-02-29"],
    ["2028-02-29T17:00:00.000Z", "2028-03-01"],
  ])("converts %s to the Vietnam calendar date %s", (instant, expected) => {
    expect(membershipDateInput(instant)).toBe(expected);
  });

  it.each([
    {
      date: "2028-02-29",
      expiry: undefined,
      expected: "2028-02-29T00:00:00+07:00",
    },
    {
      date: "2027-01-01",
      expiry: "2027-01-01T06:30:45+07:00",
      expected: "2027-01-01T06:30:45+07:00",
    },
    {
      date: "2027-01-03",
      expiry: "2027-01-01T06:30:45+07:00",
      expected: "2027-01-03T00:00:00+07:00",
    },
  ])(
    "sends the correct checkout start instant for $date",
    ({ date, expiry, expected }) => {
      expect(membershipStartInstant(date, expiry)).toBe(expected);
    },
  );

  it("warns on a shorter same-tier purchase for legacy plans without a sale snapshot", () => {
    expect(
      downgradeReason(
        { tier: "PREMIUM", plan: { durationDays: 90 } },
        { tier: "PREMIUM", durationDays: 30 },
      ),
    ).toContain("gia hạn nối tiếp");
  });
});

describe("refund display from the original amount", () => {
  it.each([
    {
      title: "excludes an already expired member purchase",
      remaining: -1,
      daysLeft: 0,
      amount: 300_001,
      duration: 30,
      role: "MEMBER",
      refund: 0,
    },
    {
      title: "shows one day for a partial day below the member threshold",
      remaining: 1,
      daysLeft: 1,
      amount: 300_001,
      duration: 30,
      role: "MEMBER",
      refund: 0,
    },
    {
      title: "rounds a fractional member refund down to whole VND",
      remaining: 18 * day,
      daysLeft: 18,
      amount: 300_001,
      duration: 30,
      role: "MEMBER",
      refund: 90_000,
    },
    {
      title: "rounds a fractional member refund up to whole VND",
      remaining: 18 * day,
      daysLeft: 18,
      amount: 300_002,
      duration: 30,
      role: "MEMBER",
      refund: 90_001,
    },
    {
      title: "rounds an Admin prorated refund to whole VND",
      remaining: day,
      daysLeft: 1,
      amount: 100_000,
      duration: 3,
      role: "ADMIN",
      refund: 33_333,
    },
    {
      title: "includes the last partial day for a receptionist estimate",
      remaining: 2 * day + 1,
      daysLeft: 3,
      amount: 100_000,
      duration: 6,
      role: "RECEPTIONIST",
      refund: 50_000,
    },
    {
      title: "avoids dividing by a missing legacy duration",
      remaining: 3 * day,
      daysLeft: 3,
      amount: 100_000,
      duration: 0,
      role: "ADMIN",
      refund: 0,
    },
    {
      title: "never estimates a cash return for a zero-value purchase",
      remaining: 25 * day,
      daysLeft: 25,
      amount: 0,
      duration: 30,
      role: "MEMBER",
      refund: 0,
    },
  ] as const)(
    "$title",
    ({ remaining, daysLeft, amount, duration, role, refund }) => {
      expect(
        refundEstimate(at(remaining), amount, duration, role, now),
      ).toEqual({
        daysLeft,
        refundAmount: refund,
      });
    },
  );
});

describe("session controls", () => {
  it.each([
    {
      title: "blocks a scheduled session one millisecond before its end",
      schedule: { status: "SCHEDULED", endTime: at(1) },
      expected: false,
    },
    {
      title: "allows a scheduled session one millisecond after its end",
      schedule: { status: "SCHEDULED", endTime: at(-1) },
      expected: true,
    },
    {
      title: "requires a usable end time before session completion",
      schedule: { status: "SCHEDULED" },
      expected: false,
    },
  ])("$title", ({ schedule, expected }) => {
    expect(canCompleteSchedule(schedule, now)).toBe(expected);
  });

  it.each([
    {
      title: "keeps attendance available at the scheduled start",
      schedule: { status: "SCHEDULED", startTime: at(0), endTime: at(day) },
      expected: true,
    },
    {
      title: "hides attendance for a cancelled session in the check-in window",
      schedule: { status: "CANCELLED", startTime: at(0), endTime: at(day) },
      expected: false,
    },
    {
      title: "fails closed for a session without an attendance end time",
      schedule: { status: "SCHEDULED", startTime: at(0) },
      expected: false,
    },
  ])("$title", ({ schedule, expected }) => {
    expect(canGenerateAttendanceQr(schedule, now)).toBe(expected);
  });
});
