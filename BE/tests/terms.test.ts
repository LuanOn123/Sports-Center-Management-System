import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateTermSchema, UpdateTermSchema } from "../src/modules/terms/terms.schema.js";

test("Terms Schema Validation", async (t) => {
  await t.test("accepts valid Term creation payload", () => {
    const valid = {
      code: "TERM_2026_K1",
      name: "Kỳ 1 Năm 2026 (Xuân - Hè)",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-04-30T23:59:59.000Z",
      registrationStartDate: "2025-12-01T00:00:00.000Z",
      registrationEndDate: "2025-12-25T23:59:59.000Z",
      status: "OPEN_REGISTRATION",
      description: "Kỳ 1 gồm các khóa bơi và yoga",
    };
    const parsed = CreateTermSchema.parse(valid);
    assert.equal(parsed.code, "TERM_2026_K1");
    assert.equal(parsed.status, "OPEN_REGISTRATION");
  });

  await t.test("rejects when endDate is before or equal to startDate", () => {
    const invalid = {
      code: "TERM_INVALID_DATES",
      name: "Kỳ không hợp lệ",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-04-01T00:00:00.000Z",
      registrationStartDate: "2026-03-01T00:00:00.000Z",
      registrationEndDate: "2026-03-20T00:00:00.000Z",
    };
    assert.throws(
      () => CreateTermSchema.parse(invalid),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("endDate")));
        return true;
      }
    );
  });

  await t.test("rejects when registrationEndDate is before registrationStartDate", () => {
    const invalid = {
      code: "TERM_INVALID_REG",
      name: "Kỳ không hợp lệ reg date",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-04-30T23:59:59.000Z",
      registrationStartDate: "2025-12-25T00:00:00.000Z",
      registrationEndDate: "2025-12-01T00:00:00.000Z",
    };
    assert.throws(
      () => CreateTermSchema.parse(invalid),
      (err: any) => {
        assert.ok(err.issues.some((i: any) => i.path.includes("registrationEndDate")));
        return true;
      }
    );
  });

  await t.test("accepts partial updates in UpdateTermSchema", () => {
    const validUpdate = {
      status: "IN_PROGRESS",
      description: "Cập nhật mô tả kỳ",
    };
    const parsed = UpdateTermSchema.parse(validUpdate);
    assert.equal(parsed.status, "IN_PROGRESS");
    assert.equal(parsed.description, "Cập nhật mô tả kỳ");
  });
});
