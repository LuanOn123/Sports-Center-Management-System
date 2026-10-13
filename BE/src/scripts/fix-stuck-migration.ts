import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const DIRECT_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL!;
const prisma = new PrismaClient({
  datasources: { db: { url: DIRECT_URL } },
});

async function main() {
  // 1. Xem trạng thái 5 migration mới nhất
  const rows = await prisma.$queryRaw<any[]>`
    SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
    FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5
  `;
  console.log("\n=== Migration state (5 mới nhất) ===");
  console.log(JSON.stringify(rows, null, 2));

  // 2. Nếu migration bị kẹt (finished_at IS NULL và rolled_back_at IS NULL), mark rolled-back
  const stuck = rows.find(
    (r) =>
      r.migration_name === "20261012100000_leave_notifications_and_payment_failed" &&
      r.finished_at === null &&
      r.rolled_back_at === null,
  );
  if (stuck) {
    console.log("\nMigration đang kẹt → đánh dấu rolled-back...");
    await prisma.$executeRaw`
      UPDATE _prisma_migrations
      SET rolled_back_at = NOW()
      WHERE migration_name = '20261012100000_leave_notifications_and_payment_failed'
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    console.log("Done. Migration đã được đánh dấu rolled-back.");
  } else {
    const row = rows.find(
      (r) => r.migration_name === "20261012100000_leave_notifications_and_payment_failed",
    );
    console.log("\nMigration state:", row ?? "Chưa có trong bảng (chưa bao giờ chạy).");
  }
}

main()
  .catch((e) => {
    console.error("Lỗi:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
