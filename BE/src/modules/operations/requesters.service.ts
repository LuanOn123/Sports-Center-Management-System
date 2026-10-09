import type { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requestContext } from "../../config/request-context.js";
import { AppError } from "../../middlewares/errorHandler.js";

type RequesterRecord = {
  requesterId: string | null;
  requesterRole: UserRole | null;
  coachId?: string | null;
  memberId?: string | null;
};

/** Resolve only the identities referenced by already facility-scoped requests. */
export async function withRequesters<T extends RequesterRecord>(rows: T[]) {
  const coachIds = rows.flatMap((row) =>
    !row.requesterId && row.coachId ? [row.coachId] : [],
  );
  const profiles = coachIds.length
    ? await prisma.coachProfile.findMany({
        where: { id: { in: coachIds } },
        select: { id: true, userId: true },
      })
    : [];
  const coachUsers = new Map(
    profiles.map((profile) => [profile.id, profile.userId]),
  );
  const requesterId = (row: T) =>
    row.requesterId ||
    row.memberId ||
    (row.coachId ? coachUsers.get(row.coachId) : undefined);
  const ids = [
    ...new Set(
      rows.flatMap((row) => (requesterId(row) ? [requesterId(row)!] : [])),
    ),
  ];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true, role: true },
      })
    : [];
  const byId = new Map(users.map((user) => [user.id, user]));
  return rows.map((row) => {
    const user = byId.get(requesterId(row) || "");
    return {
      ...row,
      user,
      requester: user
        ? { ...user, role: row.requesterRole || user.role }
        : null,
    };
  });
}

export async function createStaffLeave(
  user: { id: string; role: string },
  input: { startTime: string; endTime: string; reason: string },
) {
  if (user.role !== "COACH" && user.role !== "RECEPTIONIST")
    throw new AppError("Only facility staff can submit leave", 403);
  const coach =
    user.role === "COACH"
      ? await prisma.coachProfile.findUnique({ where: { userId: user.id } })
      : null;
  if (user.role === "COACH" && !coach)
    throw new AppError("Coach not found", 404);
  return prisma.leaveRequest.create({
    data: {
      requesterId: user.id,
      requesterRole: user.role,
      coachId: coach?.id,
      facilityId: requestContext.getStore()!.facilityId!,
      reason: input.reason,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
    },
  });
}

export function issueOwner(user: { id: string; role: string }) {
  if (user.role === "MEMBER")
    return {
      OR: [{ requesterId: user.id }, { requesterId: null, memberId: user.id }],
    };
  if (user.role === "COACH") return { requesterId: user.id };
  return {};
}
