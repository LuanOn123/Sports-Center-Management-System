import type { PrismaClient } from "@prisma/client";

/** Seed-only: establish a valid term before inserting guarded schedules. */
export async function ensureSeedTerm(db: Pick<PrismaClient, "term">, facilityId: string) {
  const now = Date.now(), day = 86_400_000;
  return db.term.upsert({
    where: { id: `seed-term-${facilityId}` },
    create: { id: `seed-term-${facilityId}`, code: `SEED-${facilityId}`, name: "Kỳ học dữ liệu mẫu",
      facilityId, status: "IN_PROGRESS", startDate: new Date(now - 365 * day), endDate: new Date(now + 365 * day),
      registrationStartDate: new Date(now - 365 * day), registrationEndDate: new Date(now + 365 * day) },
    update: { endDate: new Date(now + 365 * day), registrationEndDate: new Date(now + 365 * day) },
  });
}
