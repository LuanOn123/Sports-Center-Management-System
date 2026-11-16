import test from "node:test";
import assert from "node:assert/strict";
import {
  GoogleLoginSchema,
  GoogleRegisterSchema,
  RegisterSchema,
} from "../src/modules/auth/auth.schema.js";

test("GoogleLoginSchema requires credential string", () => {
  const valid = GoogleLoginSchema.safeParse({ credential: "mock-google-token" });
  assert.equal(valid.success, true);

  const missing = GoogleLoginSchema.safeParse({});
  assert.equal(missing.success, false);

  const empty = GoogleLoginSchema.safeParse({ credential: "" });
  assert.equal(empty.success, false);
});

test("GoogleRegisterSchema requires phone and accepts optional profile data", () => {
  const valid = GoogleRegisterSchema.safeParse({
    credential: "mock-google-token",
    phone: "0901234567",
    gender: "MALE",
    dateOfBirth: "2000-01-01",
    fitnessGoal: "Tăng cơ giảm mỡ",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.phone, "0901234567");
    assert.equal(valid.data.fitnessGoal, "Tăng cơ giảm mỡ");
  }

  const missingPhone = GoogleRegisterSchema.safeParse({
    credential: "mock-google-token",
  });
  assert.equal(missingPhone.success, false);
});

test("RegisterSchema requires phone and includes fitnessGoal", () => {
  const valid = RegisterSchema.safeParse({
    email: "member@example.com",
    password: "Password123@",
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    fitnessGoal: "Tăng cường thể lực",
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.phone, "0912345678");
    assert.equal(valid.data.fitnessGoal, "Tăng cường thể lực");
  }

  // Reject missing phone
  const missingPhone = RegisterSchema.safeParse({
    email: "member@example.com",
    password: "Password123@",
    fullName: "Nguyễn Văn A",
  });
  assert.equal(missingPhone.success, false);

  // Reject fitnessGoal over 500 characters
  const tooLong = RegisterSchema.safeParse({
    email: "member@example.com",
    password: "Password123@",
    fullName: "Nguyễn Văn A",
    phone: "0912345678",
    fitnessGoal: "a".repeat(501),
  });
  assert.equal(tooLong.success, false);
});
