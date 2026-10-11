import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateFacilityCoachSchema } from "../src/modules/facilities/facilities.schema.js";

test("CreateFacilityCoachSchema validation rules", async (t) => {
  await t.test("accepts valid payload with sports", () => {
    const valid = {
      email: "coach.test@example.com",
      fullName: "Nguyễn Văn Coach",
      password: "password123",
      phone: "0901234567",
      gender: "MALE",
      sportIds: ["sport-yoga-id", "sport-pilates-id"],
    };
    const parsed = CreateFacilityCoachSchema.parse(valid);
    assert.equal(parsed.email, "coach.test@example.com");
    assert.equal(parsed.sportIds.length, 2);
  });

  await t.test("rejects empty sportIds array", () => {
    const invalid = {
      email: "coach.test@example.com",
      fullName: "Nguyễn Văn Coach",
      sportIds: [],
    };
    assert.throws(
      () => CreateFacilityCoachSchema.parse(invalid),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("sportIds")));
        return true;
      }
    );
  });

  await t.test("rejects missing sportIds", () => {
    const invalid = {
      email: "coach.test@example.com",
      fullName: "Nguyễn Văn Coach",
    };
    assert.throws(
      () => CreateFacilityCoachSchema.parse(invalid),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("sportIds")));
        return true;
      }
    );
  });

  await t.test("rejects invalid email", () => {
    const invalid = {
      email: "not-an-email",
      fullName: "Nguyễn Văn Coach",
      sportIds: ["sport-1"],
    };
    assert.throws(
      () => CreateFacilityCoachSchema.parse(invalid),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("email")));
        return true;
      }
    );
  });

  await t.test("rejects empty fullName", () => {
    const invalid = {
      email: "coach@test.com",
      fullName: "   ",
      sportIds: ["sport-1"],
    };
    assert.throws(
      () => CreateFacilityCoachSchema.parse(invalid),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("fullName")));
        return true;
      }
    );
  });
});

test("Coach specialization class coverage rule", async (t) => {
  function checkEligibility(coachSports: string[], classSports: string[]) {
    const coachSet = new Set(coachSports);
    const missing = classSports.filter((s) => !coachSet.has(s));
    return {
      eligible: classSports.length > 0 && missing.length === 0,
      missing,
    };
  }

  await t.test("eligible when coach has all class sports", () => {
    const result = checkEligibility(["yoga", "pilates", "hiit"], ["yoga", "pilates"]);
    assert.equal(result.eligible, true);
    assert.equal(result.missing.length, 0);
  });

  await t.test("ineligible when coach lacks one class sport", () => {
    const result = checkEligibility(["yoga"], ["yoga", "pilates"]);
    assert.equal(result.eligible, false);
    assert.deepEqual(result.missing, ["pilates"]);
  });

  await t.test("ineligible when coach has no sports", () => {
    const result = checkEligibility([], ["yoga"]);
    assert.equal(result.eligible, false);
    assert.deepEqual(result.missing, ["yoga"]);
  });
});
