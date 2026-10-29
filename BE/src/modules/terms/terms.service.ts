import { prisma } from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middlewares/errorHandler.js";
import { buildPaginationMeta } from "../../utils/pagination.js";

export async function createTerm(data: any) {
  const existing = await prisma.term.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new AppError(`Mã kỳ học "${data.code}" đã tồn tại. Vui lòng chọn mã khác.`, 409);
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const registrationStartDate = new Date(data.registrationStartDate);
  const registrationEndDate = new Date(data.registrationEndDate);

  return prisma.term.create({
    data: {
      ...data,
      facilityId: data.facilityId || null,
      startDate,
      endDate,
      registrationStartDate,
      registrationEndDate,
    },
    include: {
      facility: { select: { id: true, name: true, code: true } },
      _count: { select: { schedules: true, patterns: true } },
    },
  });
}

export async function listTerms(query: any) {
  const page = Math.max(1, parseInt(query.page ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "10") || 10));
  const skip = (page - 1) * limit;

  const now = new Date();

  // If query.current === "true", return the active / open term
  if (query.current === "true") {
    const facilityWhere: any = query.facilityId
      ? { OR: [{ facilityId: query.facilityId }, { facilityId: null }] }
      : {};

    const currentTerm = await prisma.term.findFirst({
      where: {
        AND: [
          facilityWhere,
          {
            OR: [
              { status: "IN_PROGRESS" },
              { status: "OPEN_REGISTRATION" },
              { status: { not: "CLOSED" }, startDate: { lte: now }, endDate: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { startDate: "asc" },
      include: {
        facility: { select: { id: true, name: true, code: true } },
        _count: { select: { schedules: true, patterns: true } },
      },
    });
    return { term: currentTerm };
  }

  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.year) {
    const yearNum = parseInt(query.year);
    if (!isNaN(yearNum)) {
      const yearStart = new Date(`${yearNum}-01-01T00:00:00.000Z`);
      const yearEnd = new Date(`${yearNum}-12-31T23:59:59.999Z`);
      where.startDate = { gte: yearStart, lte: yearEnd };
    }
  }
  if (query.facilityId) {
    if (query.facilityId === "system" || query.facilityId === "null") {
      where.facilityId = null;
    } else if (query.exactFacility === "true") {
      where.facilityId = query.facilityId;
    } else {
      where.AND = [
        ...(where.AND || []),
        { OR: [{ facilityId: query.facilityId }, { facilityId: null }] },
      ];
    }
  }

  const [total, terms] = await Promise.all([
    prisma.term.count({ where }),
    prisma.term.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: "desc" },
      include: {
        facility: { select: { id: true, name: true, code: true } },
        _count: { select: { schedules: true, patterns: true } },
      },
    }),
  ]);

  return { terms, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getTermById(id: string) {
  const term = await prisma.term.findUnique({
    where: { id },
    include: {
      facility: { select: { id: true, name: true, code: true } },
      _count: { select: { schedules: true, patterns: true } },
      schedules: {
        where: { status: "SCHEDULED" },
        take: 10,
        orderBy: { startTime: "asc" },
        include: { class: { select: { name: true } }, room: { select: { name: true } } },
      },
    },
  });
  if (!term) throw new AppError("Không tìm thấy kỳ học", 404);
  return term;
}

export async function getCurrentTerm(facilityId?: string) {
  const now = new Date();
  const facilityWhere = facilityId
    ? { OR: [{ facilityId }, { facilityId: null }] }
    : {};

  if (facilityId) {
    const facilityTerm = await prisma.term.findFirst({
      where: {
        facilityId,
        OR: [
          { status: "IN_PROGRESS" },
          { status: "OPEN_REGISTRATION" },
          { status: { not: "CLOSED" }, startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: { startDate: "asc" },
      include: {
        facility: { select: { id: true, name: true, code: true } },
        _count: { select: { schedules: true, patterns: true } },
      },
    });
    if (facilityTerm) return facilityTerm;
  }

  const currentTerm = await prisma.term.findFirst({
    where: {
      AND: [
        facilityWhere,
        {
          OR: [
            { status: "IN_PROGRESS" },
            { status: "OPEN_REGISTRATION" },
            { status: { not: "CLOSED" }, startDate: { lte: now }, endDate: { gte: now } },
          ],
        },
      ],
    },
    orderBy: [
      // Ưu tiên kỳ toàn hệ thống (facilityId = null) khi không có facilityId cụ thể
      { facilityId: "asc" },
      { startDate: "asc" },
    ],
    include: {
      facility: { select: { id: true, name: true, code: true } },
      _count: { select: { schedules: true, patterns: true } },
    },
  });
  return currentTerm;
}

async function updateTermInternal(id: string, data: any, managerFacilityId?: string) {
  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) throw new AppError("Không tìm thấy kỳ học", 404);

  // Business rule for MANAGER role: chỉ được cập nhật kỳ thuộc cơ sở của mình
  if (managerFacilityId) {
    if (!term.facilityId) {
      throw new AppError("Quản lý cơ sở không có quyền chỉnh sửa kỳ học chung của toàn hệ thống.", 403);
    }
    if (term.facilityId !== managerFacilityId) {
      throw new AppError("Quản lý cơ sở không có quyền chỉnh sửa kỳ học của cơ sở khác.", 403);
    }
    if (data.facilityId !== undefined && data.facilityId !== managerFacilityId) {
      throw new AppError("Không được phép chuyển kỳ học sang cơ sở khác hoặc hệ thống chung.", 403);
    }
  }

  if (data.code && data.code !== term.code) {
    const existing = await prisma.term.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new AppError(`Mã kỳ học "${data.code}" đã tồn tại. Vui lòng chọn mã khác.`, 409);
    }
  }

  const nextStatuses: Record<string, string[]> = { PLANNING: ["OPEN_REGISTRATION"], OPEN_REGISTRATION: ["IN_PROGRESS", "CLOSED"], IN_PROGRESS: ["CLOSED"], CLOSED: [] };
  if (data.status && data.status !== term.status && !nextStatuses[term.status]?.includes(data.status))
    throw new AppError("Không thể chuyển trạng thái kỳ học theo chiều ngược hoặc bỏ qua bước mở đăng ký.", 409);
  const merged = { ...term, ...data };
  const start = new Date(merged.startDate), end = new Date(merged.endDate);
  const regStart = new Date(merged.registrationStartDate), regEnd = new Date(merged.registrationEndDate);
  if (![start, end, regStart, regEnd].every(d => Number.isFinite(d.getTime())) || end <= start || regEnd <= regStart || regEnd > end)
    throw new AppError("Khoảng ngày kỳ học hoặc thời gian đăng ký không hợp lệ.", 400);
  const newStartDate = data.startDate ? new Date(data.startDate) : term.startDate;
  const newEndDate = data.endDate ? new Date(data.endDate) : term.endDate;

  // Safety check: không cho co hẹp dải ngày nếu đã có lịch học nằm ngoài dải ngày mới
  if (data.startDate || data.endDate) {
    const outsideSchedules = await prisma.classSchedule.count({
      where: {
        termId: id,
        OR: [
          { startTime: { lt: newStartDate } },
          { endTime: { gt: newEndDate } },
        ],
      },
    });
    if (outsideSchedules > 0) {
      throw new AppError(
        `Không thể thay đổi ngày của kỳ: có ${outsideSchedules} buổi học đã xếp nằm ngoài khoảng thời gian mới.`,
        400
      );
    }
  }

  const updateData: any = { ...data };
  if (data.facilityId !== undefined) {
    updateData.facilityId = data.facilityId || null;
  }
  if (data.startDate) updateData.startDate = newStartDate;
  if (data.endDate) updateData.endDate = newEndDate;
  if (data.registrationStartDate) updateData.registrationStartDate = new Date(data.registrationStartDate);
  if (data.registrationEndDate) updateData.registrationEndDate = new Date(data.registrationEndDate);

  return prisma.term.update({
    where: { id },
    data: updateData,
    include: {
      facility: { select: { id: true, name: true, code: true } },
      _count: { select: { schedules: true, patterns: true } },
    },
  });
}

export async function deleteTerm(id: string, managerFacilityId?: string) {
  const term = await prisma.term.findUnique({
    where: { id },
    include: {
      _count: { select: { schedules: true, patterns: true } },
    },
  });
  if (!term) throw new AppError("Không tìm thấy kỳ học", 404);

  // Business rule for MANAGER role: chỉ được xóa kỳ thuộc cơ sở của mình
  if (managerFacilityId) {
    if (!term.facilityId) {
      throw new AppError("Quản lý cơ sở không có quyền xóa kỳ học chung của toàn hệ thống.", 403);
    }
    if (term.facilityId !== managerFacilityId) {
      throw new AppError("Quản lý cơ sở không có quyền xóa kỳ học của cơ sở khác.", 403);
    }
  }

  if (term._count.schedules > 0 || term._count.patterns > 0) {
    throw new AppError(
      `Không thể xóa kỳ học đã có ${term._count.schedules} buổi học hoặc mẫu lịch. Hãy chuyển trạng thái kỳ sang CLOSED.`,
      400
    );
  }

  await prisma.term.delete({ where: { id } });
  return { message: "Xóa kỳ học thành công" };
}

/** Helper: Tìm kỳ học bao phủ thời điểm chỉ định (ưu tiên kỳ của cơ sở) */
export async function findTermForDate(
  date: Date,
  facilityIdOrTx?: string | any,
  maybeTx?: any
) {
  const facilityId = typeof facilityIdOrTx === "string" ? facilityIdOrTx : undefined;
  const tx =
    facilityIdOrTx && typeof facilityIdOrTx === "object" && "$executeRaw" in facilityIdOrTx
      ? facilityIdOrTx
      : maybeTx;
  const db = tx ?? prisma;

  if (facilityId) {
    const facilityTerm = await db.term.findFirst({
      where: {
        facilityId,
        startDate: { lte: date },
        endDate: { gte: date },
        status: { not: "CLOSED" },
      },
    });
    if (facilityTerm) return facilityTerm;
  }

  const facilityWhere = facilityId
    ? { OR: [{ facilityId }, { facilityId: null }] }
    : {};

  return db.term.findFirst({
    where: {
      AND: [
        facilityWhere,
        {
          startDate: { lte: date },
          endDate: { gte: date },
          status: { not: "CLOSED" },
        },
      ],
    },
    orderBy: { startDate: "asc" },
  });
}

/** Helper: Kiểm tra tính hợp lệ của buổi học trong kỳ */
export async function assertCanScheduleInTerm(
  termId: string,
  startTime: Date,
  endTime: Date,
  facilityIdOrTx?: string | any,
  maybeTx?: any
) {
  const facilityId = typeof facilityIdOrTx === "string" ? facilityIdOrTx : undefined;
  const tx = (facilityIdOrTx && typeof facilityIdOrTx === "object" && "$executeRaw" in facilityIdOrTx)
    ? facilityIdOrTx
    : maybeTx;
  const db = tx ?? prisma;
  const term = await db.term.findUnique({
    where: { id: termId },
    include: { facility: true },
  });
  if (!term) throw new AppError("Kỳ học được chọn không tồn tại", 404);
  if (term.status === "CLOSED") {
    throw new AppError(`Kỳ học "${term.name}" đã kết thúc (CLOSED), không thể xếp thêm lịch học.`, 400);
  }
  if (term.facilityId && facilityId && term.facilityId !== facilityId) {
    throw new AppError(
      `Kỳ học "${term.name}" được gán riêng cho cơ sở "${term.facility?.name || term.facilityId}", không áp dụng cho cơ sở này.`,
      400
    );
  }
  if (startTime < term.startDate || endTime > term.endDate) {
    const fmt = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    throw new AppError(
      `Buổi học (${fmt(startTime)}) phải nằm trọn trong thời gian của kỳ "${term.name}" (${fmt(term.startDate)} – ${fmt(term.endDate)}).`,
      400
    );
  }
  return term;
}

export async function updateTerm(id: string, data: any, managerFacilityId?: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('term:' || ${id}::text))`;
    return updateTermInternal(id, data, managerFacilityId);
  });
}
