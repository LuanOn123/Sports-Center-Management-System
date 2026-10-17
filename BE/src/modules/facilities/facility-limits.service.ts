import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";

type DbClient = typeof prisma | any;

/**
 * Kiểm tra giới hạn số lớp học của cơ sở (maxClasses).
 */
export async function checkFacilityClassLimit(facilityId: string, tx?: DbClient) {
  const db = tx ?? prisma;
  const facility = await db.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, name: true, maxClasses: true },
  });
  if (!facility || facility.maxClasses == null) return;

  const currentCount = await db.class.count({
    where: { facilityId, isActive: true },
  });

  if (currentCount >= facility.maxClasses) {
    throw new AppError(
      `Cơ sở "${facility.name}" đã đạt giới hạn tối đa ${facility.maxClasses} lớp học (hiện có: ${currentCount}).`,
      400,
      { code: "FACILITY_CLASS_LIMIT_EXCEEDED", limit: facility.maxClasses, current: currentCount }
    );
  }
}

/**
 * Kiểm tra giới hạn số phòng tập của cơ sở (maxRooms).
 */
export async function checkFacilityRoomLimit(facilityId: string, tx?: DbClient) {
  const db = tx ?? prisma;
  const facility = await db.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, name: true, maxRooms: true },
  });
  if (!facility || facility.maxRooms == null) return;

  const currentCount = await db.room.count({
    where: { facilityId, isActive: true },
  });

  if (currentCount >= facility.maxRooms) {
    throw new AppError(
      `Cơ sở "${facility.name}" đã đạt giới hạn tối đa ${facility.maxRooms} phòng tập (hiện có: ${currentCount}).`,
      400,
      { code: "FACILITY_ROOM_LIMIT_EXCEEDED", limit: facility.maxRooms, current: currentCount }
    );
  }
}

/**
 * Kiểm tra giới hạn số huấn luyện viên của cơ sở (maxCoaches).
 */
export async function checkFacilityCoachLimit(facilityId: string, tx?: DbClient) {
  const db = tx ?? prisma;
  const facility = await db.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, name: true, maxCoaches: true },
  });
  if (!facility || facility.maxCoaches == null) return;

  const currentCount = await db.facilityStaff.count({
    where: { facilityId, role: "COACH", isActive: true },
  });

  if (currentCount >= facility.maxCoaches) {
    throw new AppError(
      `Cơ sở "${facility.name}" đã đạt giới hạn tối đa ${facility.maxCoaches} huấn luyện viên (hiện có: ${currentCount}).`,
      400,
      { code: "FACILITY_COACH_LIMIT_EXCEEDED", limit: facility.maxCoaches, current: currentCount }
    );
  }
}

/**
 * Kiểm tra giới hạn số hội viên / học viên của cơ sở (maxMembers).
 * Hội viên thuộc cơ sở khi có gói tập ACTIVE phát hành tại cơ sở hoặc có đăng ký lớp tại cơ sở.
 */
export async function checkFacilityMemberLimit(
  facilityId: string,
  candidateMemberId?: string,
  tx?: DbClient
) {
  const db = tx ?? prisma;
  const facility = await db.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, name: true, maxMembers: true },
  });
  if (!facility || facility.maxMembers == null) return;

  const now = new Date();

  // Kiểm tra nếu candidateMemberId đã được tính vào cơ sở thì không tăng thêm
  if (candidateMemberId) {
    const isAlreadyMember = await db.membershipSubscription.findFirst({
      where: {
        memberId: candidateMemberId,
        facilityId,
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    if (isAlreadyMember) return;

    const hasBooking = await db.enrollment.findFirst({
      where: {
        memberId: candidateMemberId,
        class: { facilityId },
        status: { in: ["BOOKED", "COMPLETED"] },
      },
    });
    if (hasBooking) return;
  }

  // Đếm distinct memberId tại cơ sở
  const [subMembers, classMembers] = await Promise.all([
    db.membershipSubscription.findMany({
      where: {
        facilityId,
        status: "ACTIVE",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { memberId: true },
      distinct: ["memberId"],
    }),
    db.enrollment.findMany({
      where: {
        class: { facilityId },
        status: { in: ["BOOKED", "COMPLETED"] },
      },
      select: { memberId: true },
      distinct: ["memberId"],
    }),
  ]);

  const uniqueMemberIds = new Set<string>([
    ...subMembers.map((s: { memberId: string }) => s.memberId),
    ...classMembers.map((c: { memberId: string }) => c.memberId),
  ]);

  const currentCount = uniqueMemberIds.size;
  if (currentCount >= facility.maxMembers) {
    throw new AppError(
      `Cơ sở "${facility.name}" đã đạt giới hạn tối đa ${facility.maxMembers} hội viên (hiện có: ${currentCount}).`,
      400,
      { code: "FACILITY_MEMBER_LIMIT_EXCEEDED", limit: facility.maxMembers, current: currentCount }
    );
  }
}

/**
 * Kiểm tra giới hạn số bộ môn của cơ sở (maxSports).
 */
export async function checkFacilitySportLimit(
  facilityId: string,
  newSportIds: string[],
  tx?: DbClient
) {
  const db = tx ?? prisma;
  const facility = await db.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, name: true, maxSports: true },
  });
  if (!facility || facility.maxSports == null) return;

  // Lấy các bộ môn của các lớp đang active tại cơ sở
  const activeClasses = await db.class.findMany({
    where: { facilityId, isActive: true },
    select: { sports: { select: { id: true } } },
  });

  const existingSportIds = new Set<string>();
  for (const c of activeClasses) {
    for (const s of c.sports) {
      existingSportIds.add(s.id);
    }
  }

  const combinedSportIds = new Set([...existingSportIds, ...newSportIds]);
  if (combinedSportIds.size > facility.maxSports) {
    throw new AppError(
      `Cơ sở "${facility.name}" chỉ cho phép tối đa ${facility.maxSports} bộ môn hoạt động cùng lúc (hiện có: ${existingSportIds.size}, sau khi thêm: ${combinedSportIds.size}).`,
      400,
      {
        code: "FACILITY_SPORT_LIMIT_EXCEEDED",
        limit: facility.maxSports,
        current: existingSportIds.size,
        requested: combinedSportIds.size,
      }
    );
  }
}

/**
 * Lấy chi tiết giới hạn và số lượng thực tế đang sử dụng của cơ sở.
 */
export async function getFacilityUsageAndLimits(facilityId: string, tx?: DbClient) {
  const db = tx ?? prisma;
  const facility = await db.facility.findUnique({
    where: { id: facilityId },
    select: {
      id: true,
      name: true,
      code: true,
      maxClasses: true,
      maxRooms: true,
      maxCoaches: true,
      maxMembers: true,
      maxSports: true,
    },
  });
  if (!facility) throw new AppError("Facility not found", 404);

  const now = new Date();

  const [classesCount, roomsCount, coachesCount, subMembers, classMembers, activeClasses] =
    await Promise.all([
      db.class.count({ where: { facilityId, isActive: true } }),
      db.room.count({ where: { facilityId, isActive: true } }),
      db.facilityStaff.count({ where: { facilityId, role: "COACH", isActive: true } }),
      db.membershipSubscription.findMany({
        where: {
          facilityId,
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
      db.enrollment.findMany({
        where: {
          class: { facilityId },
          status: { in: ["BOOKED", "COMPLETED"] },
        },
        select: { memberId: true },
        distinct: ["memberId"],
      }),
      db.class.findMany({
        where: { facilityId, isActive: true },
        select: { sports: { select: { id: true } } },
      }),
    ]);

  const uniqueMemberIds = new Set<string>([
    ...subMembers.map((s: { memberId: string }) => s.memberId),
    ...classMembers.map((c: { memberId: string }) => c.memberId),
  ]);

  const uniqueSportIds = new Set<string>();
  for (const c of activeClasses) {
    for (const s of c.sports) {
      uniqueSportIds.add(s.id);
    }
  }

  const buildMetric = (current: number, limit: number | null) => ({
    current,
    limit,
    remaining: limit != null ? Math.max(0, limit - current) : null,
    isExceeded: limit != null ? current >= limit : false,
    percentUsed: limit != null && limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : null,
  });

  return {
    facilityId: facility.id,
    facilityName: facility.name,
    facilityCode: facility.code,
    limits: {
      classes: buildMetric(classesCount, facility.maxClasses),
      rooms: buildMetric(roomsCount, facility.maxRooms),
      coaches: buildMetric(coachesCount, facility.maxCoaches),
      members: buildMetric(uniqueMemberIds.size, facility.maxMembers),
      sports: buildMetric(uniqueSportIds.size, facility.maxSports),
    },
  };
}
