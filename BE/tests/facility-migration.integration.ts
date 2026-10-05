import dotenv from "dotenv";
dotenv.config({ path: ".env.test", quiet: true });
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const schema = "scms_verify_migration_20261005";
  url.searchParams.set("schema", schema);
  assert.match(schema, /^scms_verify_/);
  const env = { ...process.env, DATABASE_URL: url.href };
  const baseline = execFileSync(
    "git",
    ["show", "HEAD:BE/prisma/schema.prisma"],
    { encoding: "utf8" },
  )
    .replace(/model Facility \{[\s\S]*?\n\}/, "")
    .replace(/model FacilityStaff \{[\s\S]*?\n\}/, "")
    .replace(/^.*facilityStaffs.*FacilityStaff\[\].*$/m, "")
    .replace(/^\s*ADMIN\s*$/m, "")
    .replace("RECEPTIONIST", "STAFF");
  fs.writeFileSync("prisma/legacy-baseline.tmp.prisma", baseline);
  const cli = (args: string[]) => {
    const result = spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", ...args],
      { env, encoding: "utf8" },
    );
    if (result.status)
      throw new Error(
        result.stderr.replace(/postgresql:\/\/[^\s]+/g, "[redacted]"),
      );
  };
  cli([
    "db",
    "push",
    "--schema",
    "prisma/legacy-baseline.tmp.prisma",
    "--skip-generate",
  ]);
  const db = new PrismaClient({ datasources: { db: { url: url.href } } });
  try {
    await db.$executeRaw`INSERT INTO "User"("id","email","password","fullName","role","updatedAt") VALUES ('legacy-staff','legacy-staff@test.invalid','test-hash','Legacy Staff','STAFF',CURRENT_TIMESTAMP)`;
    await db.$executeRaw`INSERT INTO "Room"("id","name","capacity","areaType","updatedAt") VALUES ('legacy-room','Legacy room',10,'INDOOR',CURRENT_TIMESTAMP)`;
    cli([
      "db",
      "execute",
      "--file",
      "prisma/compatibility/legacy-vietqr.sql",
      "--schema",
      "prisma/schema.prisma",
    ]);
    // Running the compatibility step twice must remain safe with existing planId.
    cli([
      "db",
      "execute",
      "--file",
      "prisma/compatibility/legacy-vietqr.sql",
      "--schema",
      "prisma/schema.prisma",
    ]);
    const compatibilityColumns = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM information_schema.columns WHERE table_schema = 'scms_verify_migration_20261005' AND table_name = 'Payment' AND column_name IN ('planId', 'provider', 'providerTransactionId', 'expiresAt')`;
    assert.equal(Number(compatibilityColumns[0].count), 4);
    cli([
      "db",
      "execute",
      "--file",
      "prisma/migrations/20261005000000_facilities_roles/migration.sql",
      "--schema",
      "prisma/schema.prisma",
    ]);
    cli([
      "db",
      "execute",
      "--file",
      "prisma/migrations/20261005000100_facility_operations/migration.sql",
      "--schema",
      "prisma/schema.prisma",
    ]);
    assert.equal(
      (await db.room.findUniqueOrThrow({ where: { id: "legacy-room" } }))
        .facilityId,
      "legacy-main",
    );
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: "legacy-staff" } })).role,
      "RECEPTIONIST",
    );
    assert.equal(await db.room.count(), 1);
    console.log(
      "PASS SQL migration: pending SePay compatibility is repeatable; legacy rooms preserved, default facility created, STAFF renamed",
    );
  } finally {
    // Only this explicitly named disposable schema is dropped.
    await db.$executeRawUnsafe(
      'DROP SCHEMA "scms_verify_migration_20261005" CASCADE',
    );
    await db.$disconnect();
    fs.unlinkSync("prisma/legacy-baseline.tmp.prisma");
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
