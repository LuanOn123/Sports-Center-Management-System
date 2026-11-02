/**
 * One-time idempotent backfill (R-07): gắn kỳ học cho ClassSchedule cũ đang có termId = NULL.
 * Cùng luật tự chọn kỳ với `createScheduleBatchInTx` lúc tạo lịch: kỳ chưa đóng bao trọn
 * buổi học, ưu tiên kỳ riêng của cơ sở rồi tới kỳ toàn hệ thống.
 *
 * PHẢI chạy `--apply` TRƯỚC `npm run db:deploy`: migration 20261029000000_business_rule_hardening
 * dừng lại nếu còn buổi SCHEDULED tương lai chưa có kỳ.
 *
 * Chạy:
 *   npx tsx prisma/backfill-schedule-terms.ts            # dry-run: chỉ liệt kê, không mutate
 *   npx tsx prisma/backfill-schedule-terms.ts --apply    # áp dụng (idempotent)
 *   (npm:  npm run db:backfill:schedule-terms -- --apply)
 *
 * Phạm vi & an toàn:
 * - CHỈ buổi có termId = NULL; buổi đã có kỳ không bị đụng tới → chạy lại không đổi gì thêm.
 * - Buổi không tìm được kỳ phù hợp chỉ được report để Manager tạo kỳ / xử lý tay.
 * - KHÔNG đụng enrollment / attendance / payment.
 *
 * Rollback: script in ra id từng buổi đã gắn kỳ; đặt lại đúng các id đó:
 *   UPDATE "ClassSchedule" SET "termId" = NULL WHERE id IN ('<id1>', ...);
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
import { requestContext } from "../src/config/request-context.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const schedules = await requestContext.run({ facilityId: undefined, actorId: "system:backfill-schedule-terms" }, () =>
    prisma.classSchedule.findMany({
      where: { termId: null },
      select: { id: true, startTime: true, endTime: true, class: { select: { name: true, facilityId: true } } },
      orderBy: { startTime: "asc" },
    }),
  );

  const terms = await requestContext.run({ facilityId: undefined, actorId: "system:backfill-schedule-terms" }, () =>
    prisma.term.findMany({ where: { status: { not: "CLOSED" } }, orderBy: { startDate: "asc" } }),
  );
  const covering = (facilityId: string | null, start: Date, end: Date) => {
    const fits = (term: (typeof terms)[number]) => term.startDate <= start && term.endDate >= end;
    return (facilityId ? terms.find((term) => term.facilityId === facilityId && fits(term)) : undefined)
      ?? terms.find((term) => term.facilityId === null && fits(term));
  };

  const assigned: { id: string; termId: string }[] = [];
  const unresolved: { id: string; className: string; startTime: Date }[] = [];
  for (const schedule of schedules) {
    const facilityId = schedule.class.facilityId ?? undefined;
    const termId = covering(schedule.class.facilityId, schedule.startTime, schedule.endTime)?.id;
    if (!termId) {
      unresolved.push({ id: schedule.id, className: schedule.class.name, startTime: schedule.startTime });
      continue;
    }
    if (apply) {
      await requestContext.run(
        { facilityId, actorId: "system:backfill-schedule-terms", reason: "R-07 backfill schedule term" },
        () => prisma.classSchedule.updateMany({ where: { id: schedule.id, termId: null }, data: { termId } }),
      );
    }
    assigned.push({ id: schedule.id, termId });
  }

  console.log(`[backfill-schedule-terms] mode=${apply ? "APPLY" : "DRY-RUN"} scanned=${schedules.length}`);
  console.log(`  ${apply ? "assigned" : "would assign"}: ${assigned.length}`);
  for (const row of assigned) console.log(`    ${row.id} -> term ${row.termId}`);
  console.log(`  unresolved (no covering term): ${unresolved.length}`);
  for (const row of unresolved)
    console.log(`    ${row.id} | ${row.className} | ${row.startTime.toISOString()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
