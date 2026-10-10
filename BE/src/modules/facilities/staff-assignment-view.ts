import { prisma } from "../../config/prisma.js";
import type { UserRole } from "@prisma/client";

/** Read actual assignments; never infer membership from the selected workspace. */
export async function staffAssignmentView(userId: string, role: UserRole) {
  if (!["MANAGER", "COACH", "RECEPTIONIST"].includes(role)) return {};
  const rows = await prisma.facilityStaff.findMany({
    where: { userId, role, isActive: true, facility: { isActive: true } },
    select: { facility: { select: { id: true, name: true } }, role: true },
  });
  return {
    facilityAssignments: rows,
    assignmentStatus: rows.length ? "ASSIGNED" : "UNASSIGNED",
    facilityName:
      rows.map((row) => row.facility.name).join(", ") || "Chưa phân công",
  };
}
