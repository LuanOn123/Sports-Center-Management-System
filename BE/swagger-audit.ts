/**
 * Swagger audit — đối chiếu spec (`@swagger` JSDoc + operations-openapi) với
 * các route THẬT khai báo trong `app.ts` + module `*.routes.ts`.
 *
 * Chạy từ thư mục BE/:   npx tsx swagger-audit.ts
 *
 * Báo:
 *  1. DƯ    — endpoint có trong Swagger nhưng KHÔNG có trong BE (exit 1).
 *  2. THIẾU — endpoint có trong BE nhưng chưa có trong Swagger (báo cáo, không fail;
 *             /health intentionally không document).
 *  3. Header `X-Facility-Id` — mọi operation FACILITY-scope phải khai báo (exit 1 nếu thiếu).
 *
 * ⚠️ FACILITY_SCOPE_ROOTS / PUBLIC_SCOPE_GET_ROOTS phải GIỐNG mảng trong
 * `src/app.ts` (mirror có chủ đích — cùng cảnh báo với config/swagger.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { swaggerSpec } from "./src/config/swagger.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

// --- Mirror từ app.ts (giữ đồng bộ) -----------------------------------------
const FACILITY_SCOPE_ROOTS = new Set([
  "rooms",
  "classes",
  "class-schedules",
  "enrollments",
  "subscriptions",
  "payments",
  "invoices",
  "reports",
  "attendance",
  "feedbacks",
  "operations",
  "members",
  "coaches",
  "issues",
  "leave-requests",
  "audit-logs",
  "slots",
  "schedule-patterns",
  "counter-orders",
  "membership-plans",
  "sports",
  "subjects",
  "facility-visits",
  "waitlist",
]);
const PUBLIC_SCOPE_GET_ROOTS = new Set([
  "membership-plans",
  "sports",
  "subjects",
]);
// -----------------------------------------------------------------------------

const root = process.cwd();
const appTs = fs.readFileSync(path.join(root, "src/app.ts"), "utf8");

// 1) Mount: router variable -> prefixes (app.use(`${v1}/x`, var) / app.use(v1, var))
const mounts = new Map<string, string[]>();
const addMount = (v: string, prefix: string) => {
  const list = mounts.get(v) ?? [];
  list.push(prefix);
  mounts.set(v, list);
};
for (const m of appTs.matchAll(/app\.use\(`\$\{v1\}([^`]*)`,\s*(\w+)\)/g))
  addMount(m[2], m[1]);
for (const m of appTs.matchAll(/app\.use\(v1,\s*(\w+)\)/g)) addMount(m[1], "");

// 2) Import: router variable -> file (src/modules/...)
const varToFile = new Map<string, string>();
for (const m of appTs.matchAll(/import (\w+) from "\.\/(modules\/[^"]+)\.js"/g))
  varToFile.set(m[1], `${m[2]}.ts`); // group loại đuôi ".js" do backtracking

const normalize = (p: string) => p.replace(/:(\w+)/g, "{$1}").replace(/\/+$/, "") || "/";

// 3) Route THẬT
const real = new Set<string>();
for (const [v, prefixes] of mounts) {
  const rel = varToFile.get(v);
  if (!rel) {
    console.log(`WARN: không tìm thấy file cho router "${v}"`);
    continue;
  }
  const src = fs.readFileSync(path.join(root, "src", rel), "utf8");
  let count = 0;
  for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    for (const prefix of prefixes) real.add(`${m[1].toUpperCase()} ${normalize(prefix + m[2])}`);
    count++;
  }
  for (const m of src.matchAll(/route\(\s*"(get|post|put|patch|delete)",\s*"([^"]+)"/g)) {
    for (const prefix of prefixes) real.add(`${m[1].toUpperCase()} ${normalize(prefix + m[2])}`);
    count++;
  }
  if (count === 0) console.log(`WARN: không parse được route nào từ ${rel}`);
}
real.add("GET /health"); // app-level, cố ý không đưa vào Swagger

// 4) Spec (đã gồm header injection)
const spec = swaggerSpec as any;
const doc = new Set<string>();
const headerMissing: string[] = [];
let withHeader = 0;
let headerRequired = 0;
let totalOps = 0;

for (const [p, ops] of Object.entries<any>(spec.paths ?? {})) {
  const rootSeg = p.split("/")[1];
  for (const method of Object.keys(ops ?? {})) {
    if (!(HTTP_METHODS as readonly string[]).includes(method)) continue;
    const key = `${method.toUpperCase()} ${p}`;
    doc.add(key);
    totalOps++;
    const params: any[] = Array.isArray(ops[method]?.parameters) ? ops[method].parameters : [];
    const header = params.find((x) => x?.name === "X-Facility-Id");
    if (header) {
      withHeader++;
      if (header.required) headerRequired++;
    }
    const scopeExpected =
      FACILITY_SCOPE_ROOTS.has(rootSeg) &&
      p !== "/payments/sepay/webhook" &&
      !(method === "get" && PUBLIC_SCOPE_GET_ROOTS.has(rootSeg));
    if (scopeExpected && !header) headerMissing.push(key);
  }
}

const stale = [...doc].filter((x) => !real.has(x)).sort();
const missing = [...real].filter((x) => !doc.has(x) && x !== "GET /health").sort();

console.log(`\nRoute THẬT: ${real.size} | Endpoint trong Swagger: ${doc.size} (ops: ${totalOps})`);
console.log(
  `X-Facility-Id: ${withHeader}/${totalOps} operations (${headerRequired} required)`,
);
console.log(`\n=== DƯ (Swagger → không có trong BE): ${stale.length} ===`);
stale.forEach((x) => console.log("  -", x));
console.log(`\n=== THIẾU (BE → chưa có trong Swagger): ${missing.length} ===`);
missing.forEach((x) => console.log("  -", x));
console.log(
  `\n=== FACILITY-scope thiếu header X-Facility-Id: ${headerMissing.length} ===`,
);
headerMissing.forEach((x) => console.log("  -", x));

process.exit(stale.length > 0 || headerMissing.length > 0 ? 1 : 0);