import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { requestContext } from "../src/config/request-context.js";

async function main() {
  if (!process.env.DATABASE_URL?.includes("scms_verify_")) {
    console.log("SKIP final-member-facility: need scms_verify_ schema");
    return;
  }
  const { getScheduleTravelConflictReason } = await import(
    "../src/modules/enrollments/enrollments.service.js"
  );
  const { classifyAttendance, absenceAllowance, classifyFixedAbsence } = await import("../src/config/attendance.js");
  const t0 = new Date("2026-10-07T08:00:00+07:00");
  const t1 = new Date("2026-10-07T09:00:00+07:00");
  assert.ok(getScheduleTravelConflictReason(
    { startTime: t1, endTime: new Date("2026-10-07T10:00:00+07:00"), facilityId: "B" },
    [{ startTime: t0, endTime: t1, facilityId: "A", className: "A" }], 30));
  assert.equal(getScheduleTravelConflictReason(
    { startTime: new Date("2026-10-07T09:30:00+07:00"), endTime: new Date("2026-10-07T10:30:00+07:00"), facilityId: "B" },
    [{ startTime: t0, endTime: t1, facilityId: "A", className: "A" }], 30), null);
  assert.equal(getScheduleTravelConflictReason(
    { startTime: t1, endTime: new Date("2026-10-07T10:00:00+07:00"), facilityId: "A" },
    [{ startTime: t0, endTime: t1, facilityId: "A", className: "A" }], 30), null);
  assert.equal(getScheduleTravelConflictReason(
    { startTime: t1, endTime: new Date("2026-10-07T10:00:00+07:00"), facilityId: "B" },
    [{ startTime: t0, endTime: t1, facilityId: "A", className: "A" }], 0), null);
  assert.equal(classifyAttendance(0, 0), "NORMAL");
  assert.equal(classifyAttendance(100, 4), "NORMAL");
  assert.equal(classifyAttendance(85, 5), "NORMAL");
  assert.equal(classifyAttendance(79, 5), "NOTICE");
  assert.equal(classifyAttendance(70, 5), "NOTICE");
  assert.equal(classifyAttendance(69, 5), "WARNING");
  assert.equal(absenceAllowance(2), 0);
  assert.equal(absenceAllowance(3), 0);
  assert.equal(absenceAllowance(4), 0);
  assert.equal(absenceAllowance(5), 1);
  assert.equal(absenceAllowance(10), 2);
  assert.equal(absenceAllowance(15), 3);
  assert.equal(absenceAllowance(20), 4);
  assert.equal(classifyFixedAbsence(0, 2), "NORMAL");
  assert.equal(classifyFixedAbsence(1, 2), "NORMAL");
  assert.equal(classifyFixedAbsence(2, 2), "NOTICE");
  assert.equal(classifyFixedAbsence(3, 2), "WARNING");
  assert.equal(classifyFixedAbsence(0, 1), "NORMAL");
  assert.equal(classifyFixedAbsence(1, 1), "NOTICE");
  assert.equal(classifyFixedAbsence(2, 1), "WARNING");
  assert.equal(classifyFixedAbsence(0, 0), "NORMAL");
  assert.equal(classifyFixedAbsence(1, 0), "WARNING");
  await requestContext.run({ facilityId: "final-check" }, async () => {});
  console.log("FINAL unit: PASS=26 FAIL=0");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
