// Provision disposable namespaces; never run this suite against application data.
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";
dotenv.config({ quiet: true });
const suite = process.argv[2] || "manager";
assert.ok(["manager", "reception"].includes(suite), "Unknown isolated suite");
const name = `scms_verify_manager_${randomBytes(8).toString("hex")}`;
const directPg = new URL(process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL);
directPg.searchParams.set("schema", name);
directPg.searchParams.set("connection_limit", "3");
directPg.searchParams.set("connect_timeout", "15");
const mongo = new URL(process.env.MONGO_URI);
mongo.pathname = "/" + name;
const env = {
  ...process.env,
  DATABASE_URL: directPg.href,
  DIRECT_DATABASE_URL: directPg.href,
  MONGO_URI: mongo.href,
  NODE_ENV: "test",
};
const db = new PrismaClient({ datasources: { db: { url: directPg.href } } });
let created = false;
const baselinePath = `prisma/${name}.prisma`;
const baseline = readFileSync("prisma/schema.prisma", "utf8")
  .replace(/  requesterId\s+String\?[^\r\n]*\r?\n/g, "")
  .replace(/  requesterRole\s+UserRole\?[^\r\n]*\r?\n/g, "")
  .replace(/  @@index\(\[facilityId, requesterId\]\)[^\r\n]*\r?\n/g, "")
  .replace(/(model LeaveRequest \{[\s\S]*?coachId\s+String)\?/, "$1")
  .replace(/(model Issue \{[\s\S]*?memberId\s+String)\?/, "$1");
writeFileSync(baselinePath, baseline, { flag: "wx" });
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: "inherit",
      timeout: 600000,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Test command failed: ${args[0]} (${code})`)),
    );
  });
}
try {
  await db.$executeRawUnsafe(`CREATE SCHEMA "${name}"`);
  created = true;
  await db.$disconnect();
  await run([
    "node_modules/prisma/build/index.js",
    "db",
    "push",
    "--accept-data-loss",
    "--skip-generate",
    "--schema",
    baselinePath,
  ]);
  const sql = readFileSync(
    "prisma/migrations/20261008000100_manager_assignment_constraints/migration.sql",
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .filter((s) => /CREATE UNIQUE INDEX/.test(s)))
    await db.$executeRawUnsafe(
      statement
        .replace(/CREATE UNIQUE INDEX/i, "CREATE UNIQUE INDEX IF NOT EXISTS")
        .replace(/"FacilityStaff"/g, `"${name}"."FacilityStaff"`),
    );
  const legacyFacility = await db.facility.create({
    data: { code: "legacy", name: "Migration fixture", address: "Test only" },
  });
  const legacyCoach = await db.user.create({
    data: {
      email: "legacy-coach@test.invalid",
      password: "fixture",
      fullName: "Legacy Coach",
      role: "COACH",
      coachProfile: { create: {} },
    },
    include: { coachProfile: true },
  });
  const legacyMember = await db.user.create({
    data: {
      email: "legacy-member@test.invalid",
      password: "fixture",
      fullName: "Legacy Member",
      role: "MEMBER",
    },
  });
  await db.$executeRawUnsafe(`INSERT INTO "${name}"."LeaveRequest" ("id", "facilityId", "coachId", "startTime", "endTime", "reason") VALUES ('legacy-leave', '${legacyFacility.id}', '${legacyCoach.coachProfile.id}', NOW(), NOW() + INTERVAL '1 hour', 'Legacy leave')`);
  await db.$executeRawUnsafe(`INSERT INTO "${name}"."Issue" ("id", "facilityId", "memberId", "title", "description", "updatedAt") VALUES ('legacy-issue', '${legacyFacility.id}', '${legacyMember.id}', 'Legacy issue', 'Retained description', NOW())`);
  const requesterSql = readFileSync(
    "prisma/migrations/20261009000100_staff_requesters/migration.sql",
    "utf8",
  );
  for (const statement of requesterSql.split(";").filter((s) => s.trim())) {
    const s = statement
      .replace(/CREATE INDEX/i, "CREATE INDEX IF NOT EXISTS")
      .replace(/"LeaveRequest"/g, `"${name}"."LeaveRequest"`)
      .replace(/"CoachProfile"/g, `"${name}"."CoachProfile"`)
      .replace(/"Issue"/g, `"${name}"."Issue"`)
      .replace(/"UserRole"/g, `"${name}"."UserRole"`);
    await db.$executeRawUnsafe(s);
  }
  assert.equal(
    (await db.leaveRequest.findUniqueOrThrow({ where: { id: "legacy-leave" } }))
      .requesterId,
    legacyCoach.id,
  );
  const migratedIssue = await db.issue.findUniqueOrThrow({
    where: { id: "legacy-issue" },
  });
  assert.equal(migratedIssue.requesterId, legacyMember.id);
  assert.equal(migratedIssue.requesterRole, "MEMBER");
  assert.equal(migratedIssue.description, "Retained description");
  await db.leaveRequest.delete({ where: { id: "legacy-leave" } });
  await db.issue.delete({ where: { id: "legacy-issue" } });
  await db.user.deleteMany({
    where: { id: { in: [legacyCoach.id, legacyMember.id] } },
  });
  await db.facility.delete({ where: { id: legacyFacility.id } });
  console.log(
    "PASS requester migration preserves and backfills legacy Coach/Member requests",
  );
  await db.$disconnect();
  await run([
    "node_modules/tsx/dist/cli.mjs",
    `tests/${suite}-isolation.integration.ts`,
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  unlinkSync(baselinePath);
  if (created && /^scms_verify_manager_[a-f0-9]{16}$/.test(name)) {
    try {
      await mongoose.connect(mongo.href, { serverSelectionTimeoutMS: 10000 });
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
      await db.$disconnect();
      await db.$executeRawUnsafe(`DROP SCHEMA "${name}" CASCADE`);
      console.log("Removed disposable Manager test namespaces.");
    }
  }
  await db.$disconnect();
}
