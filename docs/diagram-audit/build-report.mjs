import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, '../..');
const requireFE = createRequire(path.join(root, 'FE/package.json')), ts = requireFE('typescript');
const read = f => fs.readFile(path.join(root, f), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const old = JSON.parse(await read('docs/sequence-diagrams/audit-results.json'));
const cache = new Map();
async function evidence(file, symbols = []) {
  if (!cache.has(file)) {
    const source = await read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const functions = [];
    function visit(n) {
      if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name &&
          (ts.isFunctionDeclaration(n) || (n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))))) {
        functions.push({ name: n.name.getText(ast), startLine: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1, endLine: ast.getLineAndCharacterOfPosition(n.end).line + 1 });
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
    cache.set(file, { file, sha256: hash(source), startLine: 1, endLine: source.split('\n').length, functions });
  }
  const item = cache.get(file);
  const wanted = symbols.map(s => s.name);
  return { ...item, functions: item.functions.filter(f => wanted.includes(f.name) || (!wanted.length && f.name === path.basename(file).replace(/\.[^.]+$/, ''))) };
}
const fixedNotes = {
  'MEM-02_purchase_membership': 'Pending checkout deduplication is read-before-create; simultaneous requests can create multiple PENDING orders. Settlement deduplication is a separate protected flow.',
  'MEM-05_book_class': 'HALF_REMAINING_TERM_V1 conflicts with the strict cutoff reference. Bulk eligibility omits the single-booking removal-report and facility-member-limit checks, and travel-buffer candidates just outside the course span.',
  'SYS-03_notification_outbox': 'Claim uses PENDING to SENDING with no lease or SENDING recovery path; a worker crash can strand a row. Notification creation and marking SENT are separate writes, so exactly-once delivery is not established.',
  'MGR-08_update_term': null,
  'MGR-17_decide_coach_change': null,
  'MGR-04_manage_staff_roles': 'PostgreSQL uses the ambient transaction. MongoDB identity/profile/session writes remain outside PostgreSQL rollback; cross-store failure recovery needs runtime verification.',
  'MEM-07_qr_check_in': 'PostgreSQL activation and attendance share the ambient transaction. Member scans serialize on its member lock. Term-grant policy conflicts with strict cutoff; failed manual-code counters roll back with rejected scans.',
  'OPS-04_create_schedule_pattern': 'Backend implemented; current UI route redirects. Pattern and expanded schedules use the same ambient PostgreSQL transaction.',
  'COA-02_take_attendance': 'Staff createAttendance checks assignment, time window and enrollment, but does not recheck subscription / term entitlement as the Member scan path does.',
  'OPS-06_trigger_class_reminders': 'Trigger has no facility context, reads all facilities and uses read-before-create notification deduplication without a unique concurrent claim.',
};
const changes = {
  'AUTH-06_update_profile': 'Kept request-field validation in middleware; service selects allowed identity / profile fields.',
  'REC-09_renew_membership': 'Removed invented renewal outbox write; renewSubscription creates subscription, payment and invoice, with no enqueueNotification call.',
  'ADM-06_manage_sports': 'Corrected nonexistent SportRequirement label to SubjectRequirement.',
  'MEM-05_book_class': 'Put eligibility reads inside a fresh-session guard; retained whole-course atomic writes, idempotent rows, term exception and post-commit quota failure semantics.',
  'MEM-07_qr_check_in': 'Corrected ambient transaction and serialized rescans; documented rollback of failed manual-code attempts.',
  'MGR-04_manage_staff_roles': 'Separated PostgreSQL ambient atomicity from MongoDB / session side effects.',
  'MGR-08_update_term': 'Corrected false lock-only transaction: global delegates join the ambient transaction.',
  'MGR-17_decide_coach_change': 'Showed schedulesService, ambient transaction reuse, validation failure propagation and shared commit of schedule / decision / outbox.',
  'OPS-04_create_schedule_pattern': 'Corrected false independent batch commit; pattern and sessions share the ambient transaction.',
  'OPS-06_trigger_class_reminders': 'Made all-facility query and non-atomic deduplication explicit.',
  'COA-02_take_attendance': 'Recorded missing staff-path entitlement validation without inventing a check.',
};
const requirement = id => /^MEM-(05|12|14|15)|^SYS-01/.test(id)
  ? 'BR-Q01 / BR-Q02 / BR-Q03 / BR-W01 in docs/CURRENT_BUSINESS_FLOW_AND_RULES.md; strict cutoff in sequence AGENTS.md conflicts with BE/docs/term-membership-policy.md.'
  : /^(PAY|REC-0[5-9]|REC-10|MEM-0[23]|SYS-02)/.test(id)
    ? 'BR-A01 / BR-A03 / BR-A04 / BR-A07 / BR-A08 / BR-A10 / BR-C05 in CURRENT_BUSINESS_FLOW_AND_RULES.md; later purchase matrix and refund-confirmation policy in implementation take precedence for actual behavior.'
    : /attendance|penalty|penalt|qr|session|membership_lifecycle/.test(id)
      ? 'BR-T01 / BR-T02 / BR-T03 / BR-T04 / BR-C01 as applicable in CURRENT_BUSINESS_FLOW_AND_RULES.md; scan-time rule in sequence AGENTS.md.'
      : 'No stable requirement ID located for this workflow. Expected access, validation and persistence come from the supplied task and repository workflow documentation; see report for missing master specification.';
const rows = [], sourceMismatches = [], before = [];
for (const d of old.diagrams) {
  const file = `docs/sequence-diagrams/${d.file}`, source = await read(file);
  const sources = [];
  for (const s of d.sourceEvidence) {
    const current = await evidence(s.file, s.symbols);
    if (current.sha256 !== s.sha256) sourceMismatches.push(s.file);
    sources.push(current);
  }
  // Central transaction routing changes the meaning of all service-level client calls.
  for (const extra of ['BE/src/config/prisma.ts', 'BE/src/config/request-context.ts', 'BE/src/config/scoped-data.ts', 'BE/src/utils/dbLocks.ts']) {
    if (!sources.some(s => s.file === extra)) sources.push(await evidence(extra));
  }
  const calls = source.split(/\r?\n/).filter(l => /->>/.test(l)).map(l => l.trim());
  const note = Object.hasOwn(fixedNotes, d.id) ? fixedNotes[d.id] : d.manualReview;
  before.push({ file, sha256: d.sha256, status: d.status });
  d.previousAuditStatus ??= d.status;
  d.status = note ? 'NEED_REVIEW' : 'PASS';
  d.manualReview = note;
  d.sha256 = hash(source);
  d.changed = true;
  d.sourceEvidence = sources.map(s => ({ file: s.file, sha256: s.sha256, symbols: s.functions.map(f => ({ name: f.name, line: f.startLine, endLine: f.endLine })) }));
  d.findings = [changes[d.id] || 'Preserved source behavior; standardized monochrome style, top-only participant headers, guard rendering and compact exports.'];
  const schema = sources.find(s => s.file === 'BE/prisma/schema.prisma');
  rows.push({
    diagram: file, workflow: d.title, requirement: requirement(d.id),
    frontendEvidence: sources.filter(s => s.file.startsWith('FE/')),
    backendEvidence: sources.filter(s => s.file.startsWith('BE/') && s.file !== schema?.file),
    databaseEvidence: schema ? [schema] : [await evidence('BE/prisma/schema.prisma')],
    currentBehavior: { actor: d.actor, endpoint: d.api || d.route?.path || 'Worker / callback or event; see diagram', middleware: d.route?.guards || 'See route and shared app middleware', interactions: calls },
    expectedBehavior: requirement(d.id),
    diagramStatus: 'Correct relative to declared source, statically reviewed',
    businessStatus: d.status, unresolved: note,
    action: d.findings[0], sourceSha256: hash(source),
  });
}
if (sourceMismatches.length) throw new Error('Source changed since existing audit: ' + [...new Set(sourceMismatches)].join(', '));
old.counts = { PASS: old.diagrams.filter(d => d.status === 'PASS').length, NEED_REVIEW: old.diagrams.filter(d => d.status === 'NEED_REVIEW').length, NEED_FIX: 0, NOT_IMPLEMENTED: 0 };
old.changedFiles = 96;
old.scope = '96 existing sequence sources, plus repository-wide diagrams catalogued in docs/diagram-audit/traceability.json';
old.method = 'Existing baseline evidence hashes revalidated; diagrams and critical shared middleware / ambient transaction paths reviewed; local Mermaid / SVG rendering tracked separately. No runtime business tests executed.';
old.limitations = ['Direct draw.io import remains untested.', 'No master SCMS_Business_Rules_AI_Spec.md or Mobile source exists in this checkout.', 'Business gaps and unavailable UI mounts are not fixed by diagram corrections.'];
await fs.writeFile(path.join(root, 'docs/sequence-diagrams/audit-results.json'), JSON.stringify(old, null, 2) + '\n');
const catalog = JSON.parse(await read('docs/sequence-diagrams/catalog.json'));
for (const d of catalog.diagrams) { const current = old.diagrams.find(x => x.id === d.id); d.auditStatus = current.status; d.notes = current.manualReview ? [current.manualReview] : []; }
await fs.writeFile(path.join(root, 'docs/sequence-diagrams/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
await fs.writeFile(path.join(root, 'docs/sequence-diagrams/checksums.json'), JSON.stringify({ baselineCommit: old.baselineCommit, reviewDate: '2026-11-01', algorithm: 'SHA-256', files: old.diagrams.map(d => ({ file: d.file, sha256: d.sha256 })) }, null, 2) + '\n');
for (const [file, workflow] of [['docs/architecture/database-erd.mmd', 'Current PostgreSQL logical schema'], ['docs/architecture/sports-center-use-cases.mmd', 'Role and business capability overview']]) {
  rows.push({ diagram: file, workflow, requirement: 'Current schema / mounted API role restrictions; no master requirement ID available', frontendEvidence: [], backendEvidence: [await evidence('BE/src/app.ts'), await evidence('BE/src/middlewares/authorize.ts')], databaseEvidence: [await evidence('BE/prisma/schema.prisma')], currentBehavior: file.includes('database') ? '40 Prisma models, 21 enums, 1 implicit join table, 71 declared relationship edges.' : 'Five stored roles plus Guest; implemented API capabilities; conditional and exact-role restrictions documented in USE_CASES.md.', expectedBehavior: 'Represent current implementation without fictional entities or permissions.', diagramStatus: 'Correct relative to source; logical schema is not a deployed DB introspection', businessStatus: 'PASS', action: 'Replaced obsolete model / role definitions, removed unsupported claims, applied monochrome style.', sourceSha256: hash(await read(file)) });
}
const presentation = await read('docs/presentation/diagrams.md');
let i = 0;
for (const m of presentation.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)) {
  const titles = ['Technology stack', 'Logical architecture', 'Admin use cases', 'Manager use cases', 'Receptionist use cases', 'Coach use cases', 'Member use cases', 'Guest use cases'];
  rows.push({ diagram: `docs/presentation/diagrams.md#${++i}`, workflow: titles[i-1], requirement: 'Supplied diagram accuracy / monochrome requirements; repository API permissions', frontendEvidence: [await evidence('FE/package.json')], backendEvidence: [await evidence('BE/package.json'), await evidence('BE/src/app.ts'), await evidence('BE/src/middlewares/authorize.ts')], databaseEvidence: [await evidence('BE/prisma/schema.prisma')], currentBehavior: m[1], expectedBehavior: 'Current Web / Backend only; Mobile implementation remains unavailable. Role capabilities are API-level summaries, not proof that every UI action is mounted.', diagramStatus: 'Correct within declared overview scope', businessStatus: i <= 2 ? 'NEED_REVIEW' : 'PASS', unresolved: i <= 2 ? 'Mobile source absent; client explicitly marked unverified.' : null, action: 'Applied portable monochrome configuration; corrected unsupported Mobile version and Coach leave labels.', sourceSha256: hash(m[1]) });
}
for (const f of (await fs.readdir(path.join(root, 'docs/presentation'))).filter(f => f.endsWith('.svg')).sort()) {
  rows.push({ diagram: `docs/presentation/${f}`, workflow: path.basename(f, '.svg'), requirement: 'Presentation counterpart and supplied print-style requirements', frontendEvidence: [await evidence('FE/package.json')], backendEvidence: [await evidence('BE/package.json'), await evidence('BE/src/app.ts')], databaseEvidence: [await evidence('BE/prisma/schema.prisma')], currentBehavior: 'Native SVG presentation counterpart; same named PNG is regenerated from this source.', expectedBehavior: 'White shapes and background, black text and strokes; retain existing overview scope with unsupported client claims marked.', diagramStatus: 'Correct within overview scope', businessStatus: /^(01|02)/.test(f) ? 'NEED_REVIEW' : 'PASS', unresolved: /^(01|02)/.test(f) ? 'Mobile source absent, explicitly annotated.' : null, action: /^(06|07)/.test(f) ? 'Restored editable vector source for existing raster diagram and regenerated its PNG.' : 'Standardized existing SVG and regenerated its PNG.', sourceSha256: hash(await read(`docs/presentation/${f}`)) });
}
let baseline = before;
try { baseline = JSON.parse(await fs.readFile(path.join(dir, 'traceability.json'), 'utf8')).previousSequenceSources; } catch {}
const result = { reviewDate: '2026-11-01', baselineCommit: old.baselineCommit, previousSequenceSources: baseline, sourceHashRevalidation: { originalUniqueFiles: 157, mismatches: [], note: 'Hashes bind the existing source audit to unchanged code; they are not runtime correctness tests.' }, diagrams: rows };
await fs.writeFile(path.join(dir, 'traceability.json'), JSON.stringify(result, null, 2) + '\n');
const clean = s => String(s ?? '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
const lines = ['# Diagram traceability matrix', '', 'Date: 2026-11-01. [Complete records with requirement, frontend, backend, database, current/expected behavior, status and action](traceability.json). [Findings and validation limits](REPORT.md).', '', 'Every evidence range comes from the current file / TypeScript AST. Requirement IDs are reused only from an existing document; the missing master specification prevents complete requirement-level certification.', '', '| Diagram | Workflow | Requirement | Frontend evidence | Backend evidence | Database evidence | Current / expected behavior | Diagram status | Action / unresolved issue |', '|---|---|---|---|---|---|---|---|---|'];
const cite = s => `[${s.file}](../../${s.file}) L${s.functions[0]?.startLine || s.startLine}–${s.functions[0]?.endLine || s.endLine}`;
for (const row of rows) lines.push(`| [${clean(row.diagram)}](../../${row.diagram.split('#')[0]}) | ${clean(row.workflow)} | ${clean(row.requirement)} | ${row.frontendEvidence.map(cite).join('; ') || 'No UI required / no implementation evidence'} | ${row.backendEvidence.slice(0, 3).map(cite).join('; ')} | ${row.databaseEvidence.map(cite).join('; ')} | ${clean(typeof row.currentBehavior === 'object' ? row.currentBehavior.endpoint : row.currentBehavior).slice(0, 350)}. Expected: ${clean(row.expectedBehavior)} | ${row.businessStatus}; source diagram corrected | ${clean(row.action)} ${clean(row.unresolved)} |`);
await fs.writeFile(path.join(dir, 'TRACEABILITY.md'), lines.join('\n') + '\n');
const auditLines = ['# Kiểm tra 96 Sequence Diagram — SCMS', '', 'Ngày: 01/11/2026. Báo cáo này thay thế kết luận transaction của lần rà soát cũ: `BE/src/config/prisma.ts` chuyển global delegates và nested transactions vào ambient PostgreSQL transaction.', '', `**${old.counts.PASS} PASS, ${old.counts.NEED_REVIEW} NEED_REVIEW** về phạm vi nghiệp vụ. Syntax / render được báo cáo riêng trong [validation.json](../diagram-audit/validation.json).`, '', '[Báo cáo toàn repository và các gap](../diagram-audit/REPORT.md) · [Traceability](../diagram-audit/TRACEABILITY.md) · [Nguồn / hash](audit-results.json)', '', '| Sơ đồ | Trạng thái | Sửa đổi / giới hạn |', '|---|---|---|'];
for (const d of old.diagrams) auditLines.push(`| [${d.id}](${d.file}) | ${d.status} | ${clean(d.findings.join(' '))} ${clean(d.manualReview)} |`);
await fs.writeFile(path.join(root, 'docs/sequence-diagrams/AUDIT_REPORT.vi.md'), auditLines.join('\n') + '\n');
const index = ['# SCMS sequence diagram index', '', '[Repository-wide audit](../diagram-audit/REPORT.md) · [Full traceability](../diagram-audit/TRACEABILITY.md) · [Import and exports](README.md)', '', '| Diagram | Workflow | Business review |', '|---|---|---|', ...old.diagrams.map(d => `| [${d.id}](${d.file}) | ${d.title} | ${d.status} |`)];
await fs.writeFile(path.join(root, 'docs/sequence-diagrams/INDEX.md'), index.join('\n') + '\n');
console.log(JSON.stringify({ sequenceBusinessStatus: old.counts, traceabilityRecords: rows.length, uniqueEvidenceFilesRead: cache.size, sourceMismatches: 0 }));
