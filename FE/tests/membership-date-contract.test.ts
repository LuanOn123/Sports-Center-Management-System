import { expect, it } from "vitest";
import {
  membershipDateInput,
  membershipStartInstant,
  subscriptionTransitions,
  detectPlanSwitchType,
} from "../src/shared/businessRules";

it("preserves the exact expiry instant when selecting its Vietnamese date", () => {
  const expiry = "2026-11-30T17:32:45.123Z";
  expect(membershipDateInput(expiry)).toBe("2026-12-01");
  expect(membershipStartInstant("2026-12-01", expiry)).toBe(expiry);
  expect(membershipStartInstant("2026-12-02", expiry)).toBe(
    "2026-12-02T00:00:00+07:00",
  );
});

it("counter staff can cancel but cannot manually suspend rights", () => {
  for (const role of ["RECEPTIONIST", "ADMIN"]) {
    expect(subscriptionTransitions({ status: "ACTIVE" }, role)).toEqual([
      "CANCELLED",
    ]);
    expect(subscriptionTransitions({ status: "SCHEDULED" }, role)).toEqual([
      "CANCELLED",
    ]);
  }
  expect(subscriptionTransitions({ status: "ACTIVE" }, "MANAGER")).toEqual([]);
});

it("a shorter or longer duration at the same tier is still a continuation", () => {
  const current = { tier: "MEMBERSHIP", plan: { durationDays: 90 } };
  for (const durationDays of [30, 90, 180]) {
    const plan = { tier: "MEMBERSHIP", durationDays };
    expect(detectPlanSwitchType(current, plan)).toBe("RENEW_SAME_TIER");
  }
});
