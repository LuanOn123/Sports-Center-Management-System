import "dotenv/config";
import mongoose from "mongoose";
import { configureDns } from "../config/dns.js";
import { prisma } from "../config/prisma.js";
import { User } from "../models/User.js";
import { synchronizeUserProjection } from "../modules/users/user-projection.service.js";
async function main() {
  configureDns();
  await mongoose.connect(process.env.MONGO_URI!);
  const apply = process.argv.includes("--apply");
  const adminFlag = process.argv.indexOf("--admin-email");
  const adminEquals = process.argv.find((value) =>
    value.startsWith("--admin-email="),
  );
  const adminEmail = (
    adminFlag >= 0
      ? process.argv[adminFlag + 1]
      : adminEquals?.slice("--admin-email=".length)
  )
    ?.trim()
    .toLowerCase();
  if (
    (adminFlag >= 0 || adminEquals) &&
    (!adminEmail || !adminEmail.includes("@"))
  )
    throw new Error("--admin-email requires an email");
  if (
    apply &&
    !(await prisma.facility.findUnique({ where: { id: "legacy-main" } }))
  )
    throw new Error("Deploy SQL migrations first");
  const users = await User.find().select("role email").lean();
  if (adminEmail && !users.some((u) => u.email === adminEmail))
    throw new Error("Requested admin account does not exist");
  console.log(
    `${apply ? "Applying" : "Dry run"}: ${users.length} MongoDB identities; account details are not logged.`,
  );
  for (const user of users) {
    const id = user._id.toString();
    if (!apply) continue;
    if ((user.role as string) === "STAFF")
      await User.collection.updateOne(
        { _id: user._id },
        { $set: { role: "RECEPTIONIST" } },
      );
    if (user.email === adminEmail)
      await User.updateOne({ _id: user._id }, { role: "ADMIN" });
    await synchronizeUserProjection(id);
    const role =
      user.email === adminEmail
        ? "ADMIN"
        : (user.role as string) === "STAFF"
          ? "RECEPTIONIST"
          : user.role;
    if (
      ["MANAGER", "COACH", "RECEPTIONIST"].includes(role) &&
      (await prisma.facility.findUnique({ where: { id: "legacy-main" } }))
    )
      await prisma.facilityStaff.upsert({
        where: {
          userId_facilityId_role: {
            userId: id,
            facilityId: "legacy-main",
            role: role as any,
          },
        },
        create: { userId: id, facilityId: "legacy-main", role: role as any },
        update: {},
      });
  }
  if (apply) {
    // Existing assignments establish the specialization used by legacy classes.
    // New coaches must have their subjects selected explicitly by ADMIN.
    const assignments = await prisma.classMember.findMany({
      include: { class: { include: { sports: true } } },
    });
    for (const assignment of assignments)
      for (const sport of assignment.class.sports)
        await prisma.coachSpecialization.upsert({
          where: {
            coachId_sportId: { coachId: assignment.coachId, sportId: sport.id },
          },
          create: { coachId: assignment.coachId, sportId: sport.id },
          update: {},
        });
  }
  console.log(
    apply
      ? "Identity projections synchronized."
      : "No data changed. Use --apply after deploying SQL migrations and taking a backup.",
  );
}
main()
  .catch(() => {
    console.error(
      "Identity migration failed; inspect connection and identity collisions before retrying.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
