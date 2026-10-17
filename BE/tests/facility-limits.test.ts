import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateFacilitySchema, UpdateFacilitySchema } from "../src/modules/facilities/facilities.schema.js";

test("Facility Limits Schema & Constraints Validation", async (t) => {
  await t.test("accepts valid Facility with capacity limits", () => {
    const valid = {
      code: "FAC_HCM_01",
      name: "Cơ sở TP.HCM Quận 1",
      address: "123 Nguyễn Thị Minh Khai, Q1",
      maxClasses: 20,
      maxRooms: 10,
      maxCoaches: 15,
      maxMembers: 500,
      maxSports: 5,
    };
    const parsed = CreateFacilitySchema.parse(valid);
    assert.equal(parsed.maxClasses, 20);
    assert.equal(parsed.maxRooms, 10);
    assert.equal(parsed.maxCoaches, 15);
    assert.equal(parsed.maxMembers, 500);
    assert.equal(parsed.maxSports, 5);
  });

  await t.test("accepts null or omitted limits for backward compatibility", () => {
    const legacy = {
      code: "FAC_LEGACY",
      name: "Cơ sở Cũ",
      address: "Hà Nội",
      maxClasses: null,
      maxRooms: null,
    };
    const parsed = CreateFacilitySchema.parse(legacy);
    assert.equal(parsed.maxClasses, null);
    assert.equal(parsed.maxRooms, null);
    assert.equal(parsed.maxCoaches, undefined);
  });

  await t.test("rejects negative or non-integer limits", () => {
    assert.throws(
      () =>
        CreateFacilitySchema.parse({
          code: "FAC_INV",
          name: "Invalid",
          address: "Somewhere",
          maxClasses: -5,
        }),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("maxClasses")));
        return true;
      }
    );

    assert.throws(
      () =>
        CreateFacilitySchema.parse({
          code: "FAC_INV2",
          name: "Invalid Float",
          address: "Somewhere",
          maxRooms: 3.5,
        }),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("maxRooms")));
        return true;
      }
    );
  });

  await t.test("accepts partial updates to limits in UpdateFacilitySchema", () => {
    const patch = {
      maxClasses: 50,
      maxMembers: 1000,
      isActive: true,
    };
    const parsed = UpdateFacilitySchema.parse(patch);
    assert.equal(parsed.maxClasses, 50);
    assert.equal(parsed.maxMembers, 1000);
    assert.equal(parsed.isActive, true);
  });
});
