// TEMP (an toán, xóa sau): đếm bảng trong schema test cô lập.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$queryRawUnsafe(
  "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema()",
)
  .then((r) => console.log("tables in current schema:", r[0].n))
  .catch((e) => console.log("ERR", e.message))
  .finally(() => p.$disconnect());
