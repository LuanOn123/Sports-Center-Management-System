import fs from "node:fs";
import path from "node:path";
import ts from "../BE/node_modules/typescript/lib/typescript.js";

const root = path.resolve(import.meta.dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const files = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const parse = p => ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, p.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const walk = (node, fn) => { fn(node); ts.forEachChild(node, child => walk(child, fn)); };
const app = parse("BE/src/app.ts");
const imports = {};
const mounts = new Map();
walk(app, n => {
  if (ts.isImportDeclaration(n) && n.importClause?.name && ts.isStringLiteral(n.moduleSpecifier)) imports[n.importClause.name.text] = "BE/src/" + n.moduleSpecifier.text.replace(/^\.\//, "").replace(/\.js$/, ".ts");
  if (!ts.isCallExpression(n) || n.expression.getText(app) !== "app.use") return;
  const [mount, router] = n.arguments;
  if (!mount || !router || !imports[router.getText(app)]) return;
  const prefix = ts.isTemplateExpression(mount) ? mount.templateSpans.at(-1).literal.text : mount.getText(app) === "v1" ? "" : null;
  if (prefix !== null && prefix !== "/subjects") mounts.set(imports[router.getText(app)], prefix);
});
const backend = new Map();
for (const [source, prefix] of mounts) {
  const ast = parse(source);
  const variables = {};
  const roleNames = n => {
    const roles = [];
    walk(n, child => {
      if (ts.isCallExpression(child) && child.expression.getText(ast) === "authorize") roles.push(...child.arguments.filter(ts.isStringLiteral).map(s => s.text));
      if (ts.isIdentifier(child) && variables[child.text]) roles.push(...variables[child.text]);
    });
    return [...new Set(roles)];
  };
  walk(ast, n => { if (ts.isVariableDeclaration(n) && n.initializer) variables[n.name.getText(ast)] = roleNames(n.initializer); });
  const inherited = [];
  walk(ast, n => { if (ts.isCallExpression(n) && n.expression.getText(ast) === "router.use") inherited.push(...roleNames(n)); });
  walk(ast, n => {
    if (!ts.isCallExpression(n)) return;
    const expression = n.expression.getText(ast);
    let method, route, middleware;
    if (/^router\.(get|post|patch|put|delete)$/.test(expression)) {
      method = expression.split(".")[1]; route = n.arguments[0]; middleware = n.arguments.slice(1);
    } else if (expression === "route" && ts.isStringLiteral(n.arguments[0] ?? {})) {
      method = n.arguments[0].text; route = n.arguments[1]; middleware = [n.arguments[2]];
    }
    if (!method || !route || !ts.isStringLiteral(route)) return;
    const endpoint = (prefix + (route.text === "/" ? "" : route.text)).replace(/:(\w+)/g, "{$1}") || "/";
    const roles = [...new Set([...inherited, ...middleware.filter(Boolean).flatMap(roleNames)])];
    if (roles.includes("MANAGER") || roles.includes("RECEPTIONIST")) roles.push("ADMIN");
    backend.set(`${method.toUpperCase()} ${endpoint}`, { source, line: ast.getLineAndCharacterOfPosition(n.getStart()).line + 1, roles: [...new Set(roles)], handler: n.arguments.at(-1)?.getText(ast).split("\n")[0] });
  });
}
// The app mounts the same router at both resource names.
for (const [key, route] of [...backend]) if (key.includes(" /sports")) backend.set(key.replace(" /sports", " /subjects"), route);
const fe = JSON.parse(read("FE/src/shared/operations.json"));
const sources = files("FE/src").filter(p => /\.tsx?$/.test(p)).map(p => [p, read(p)]);
const consumerFor = op => {
  const feature = op.path.split("/")[1];
  const names = { users: "manage/ResourcePage", members: "reception/members", coaches: "manage/ResourcePage", "membership-plans": "api/membership", sports: "api/classes", rooms: "manage/ResourcePage", classes: "api/classes", "class-schedules": "api/classes", subscriptions: "api/membership", enrollments: "api/enrollments", payments: "reception/payments", invoices: "reception/payments" };
  const exact = sources.filter(([, code]) => code.includes(JSON.stringify(op.method + " " + op.path)) || code.includes(JSON.stringify(op.path))).map(([p]) => p);
  if (names[feature]) exact.push(...sources.filter(([p]) => p.includes(names[feature])).map(([p]) => p));
  if (["slots", "issues", "leave-requests", "schedule-patterns", "counter-orders", "audit-logs", "staff-candidates", "facilities"].includes(feature)) exact.push("FE/src/features/operations/OperationsPage.tsx");
  return [...new Set(exact)];
};
const rows = Object.entries(fe).map(([key, op]) => {
  const route = backend.get(key);
  return { key, feature: op.path.split("/")[1], method: op.method, path: op.path, roles: route?.roles.length ? route.roles.join(", ") : op.security.length ? "Authenticated (service checks ownership)" : "Public", consumers: consumerFor(op), backend: route ? `${route.source}:${route.line}` : "MISSING", handler: route?.handler, status: route ? "MATCH" : "MISSING_API", request: op.body, query: op.parameters.filter(p => p.in === "query"), responseStatuses: op.statusCodes };
});
let markdown = "# FE / BE API contract map — 2026-10-06\n\nGenerated from live checkout route AST and FE operations. MATCH means method/path registration matches; it does not claim every role flow or response is dynamically tested. Roles include ADMIN inheritance from authorize.ts. Service ownership and facility checks still apply. Consumers include shared dynamic resource calls and should be followed into their service modules. Full DTO/query/status metadata is in API_CONTRACT_MAP.json; backend business services are adjacent to the listed router. `/subjects` is a current BE alias of `/sports`; health/docs are infrastructure routes.\n\n| Feature | Role / access | FE consumer | FE API | Method | Current BE route | Status |\n|---|---|---|---|---|---|---|\n";
for (const r of rows) markdown += `| ${r.feature} | ${r.roles} | ${r.consumers.map(p => p.replace("FE/src/", "")).join("<br>") || "UNUSED_API (no direct consumer found)"} | ${r.path} | ${r.method} | ${r.backend} | ${r.status} |\n`;
const unused = [...backend.keys()].filter(k => !fe[k] && k !== "GET /health");
markdown += `\nBackend operations absent from FE catalog: ${unused.join(", ") || "none"}.\n\nRequest/response examples may be incomplete in Swagger. Handwritten workflow overrides retain stricter verified body constraints and extra parameters. Successful integration tests and their coverage are recorded separately in INTEGRATION_AUDIT_2026-10-06.md.\n`;
fs.writeFileSync(path.join(root, "docs/API_CONTRACT_MAP.md"), markdown);
fs.writeFileSync(path.join(root, "docs/API_CONTRACT_MAP.json"), JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ frontend: rows.length, backend: backend.size, missing: rows.filter(r => r.status !== "MATCH").map(r => r.key), backendOnly: unused }, null, 2));
if (rows.some(r => r.status !== "MATCH")) process.exitCode = 1;
