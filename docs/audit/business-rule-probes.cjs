/* Characterization probes for the 2026-09-17 audit, NOT acceptance tests.
 * A passing probe confirms the documented current defect. Run from repo root:
 * node --test docs/audit/business-rule-probes.cjs
 * Loads actual service source; all persistence is mocked, no DB/network access.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../FE/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
class AppError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
function service(name, prisma) {
  const file = path.join(root, `BE/src/modules/${name}/${name}.service.ts`);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const mockedRequire = (id) => {
    if (id.endsWith('/prisma.js')) return { prisma };
    if (id.endsWith('/errorHandler.js')) return { AppError };
    if (id.endsWith('/pagination.js')) return { buildPaginationMeta: () => ({}) };
    throw new Error(`Unexpected dependency: ${id}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(mockedRequire, module, module.exports);
  return module.exports;
}
function bookingDb() {
  return {
    classSchedule: { findUnique: async () => ({ id: 's', classId: 'c', status: 'SCHEDULED', startTime: new Date('2099-01-01'), endTime: new Date('2099-01-02'), class: { classType: 'REGULAR', capacity: 1, isActive: true } }) },
    membershipSubscription: { findFirst: async () => ({ tier: 'PREMIUM' }) },
    enrollment: { count: async () => 0, findUnique: async () => null, findFirst: async () => null, create: async ({ data }) => data },
  };
}
test('BR-04: booking tier lookup omits startDate', async () => {
  const db = bookingDb(); let where;
  db.membershipSubscription.findFirst = async (q) => { where = q.where; return { tier: 'PREMIUM', startDate: new Date('2099-02-01') }; };
  assert.equal((await service('enrollments', db).bookClass('s', 'm', 'MEMBER')).status, 'BOOKED');
  assert.equal(where.startDate, undefined);
});
test('BR-07: cancelled enrollment attempts INSERT again, conflicting with DB unique key', async () => {
  const db = bookingDb();
  db.enrollment.findUnique = async () => ({ status: 'CANCELLED' });
  db.enrollment.create = async () => { throw Object.assign(new Error('unique(memberId,scheduleId)'), { code: 'P2002' }); };
  await assert.rejects(service('enrollments', db).bookClass('s', 'm', 'MEMBER'), { code: 'P2002' });
});
test('BR-06: two requests can pass capacity=1 before either INSERT', async () => {
  const db = bookingDb(); let waiting = []; let inserts = 0;
  db.enrollment.count = () => new Promise(resolve => { waiting.push(resolve); if (waiting.length === 2) waiting.forEach(done => done(0)); });
  db.enrollment.create = async ({ data }) => { inserts++; return data; };
  const api = service('enrollments', db);
  await Promise.all([api.bookClass('s', 'm1', 'MEMBER'), api.bookClass('s', 'm2', 'MEMBER')]);
  assert.equal(inserts, 2);
});
test('BR-09: PATCH accepts end before start and writes invalid schedule', async () => {
  const db = {
    classSchedule: { findUnique: async () => ({ id: 's', classId: 'c', roomId: 'r', status: 'SCHEDULED', startTime: new Date('2099-01-02'), endTime: new Date('2099-01-03') }), findFirst: async () => null, update: async ({ data }) => data },
    classMember: { findMany: async () => [] },
  };
  const result = await service('class-schedules', db).updateSchedule('s', { endTime: '2099-01-01' });
  assert.ok(result.endTime < result.startTime);
});
test('BR-10: reactivating cancelled schedule skips conflict lookup', async () => {
  let checks = 0;
  const db = { classSchedule: { findUnique: async () => ({ status: 'CANCELLED', classId: 'c', roomId: 'r', startTime: new Date('2099-01-01'), endTime: new Date('2099-01-02') }), findFirst: async () => { checks++; return { id: 'conflict' }; }, update: async ({ data }) => data } };
  assert.equal((await service('class-schedules', db).updateSchedule('s', { status: 'SCHEDULED' })).status, 'SCHEDULED');
  assert.equal(checks, 0);
});
test('BR-12: room PATCH isActive=false bypasses upcoming schedule guard', async () => {
  const db = { room: { findUnique: async () => ({ id: 'r' }), update: async ({ data }) => data } };
  assert.equal((await service('rooms', db).updateRoom('r', { isActive: false })).isActive, false);
});
test('BR-13: payment member and subscription owner can differ', async () => {
  const db = {
    memberProfile: { findFirst: async () => ({ id: 'member-A' }) },
    membershipSubscription: { findUnique: async () => ({ id: 'sub-B', memberId: 'member-B' }) },
    payment: { create: async ({ data }) => ({ id: 'pay', ...data }) },
  };
  const result = await service('payments', db).createPayment({ memberId: 'member-A', subscriptionId: 'sub-B', amount: 100, method: 'CASH', status: 'PENDING' }, 'staff');
  assert.equal(result.memberId, 'member-A'); assert.equal(result.subscriptionId, 'sub-B');
});
test('BR-05: failed payment leaves new subscription and old suspended', async () => {
  const writes = [];
  const db = {
    memberProfile: { findFirst: async () => ({ id: 'm' }) },
    membershipPlan: { findUnique: async () => ({ id: 'p', isActive: true, tier: 'MEMBERSHIP', durationDays: 30, price: 100 }) },
    membershipSubscription: { updateMany: async () => writes.push('suspend-old'), create: async () => { writes.push('create-new'); return { id: 'new' }; } },
    payment: { create: async () => { throw new Error('payment failure'); } },
  };
  await assert.rejects(service('subscriptions', db).createSubscription({ memberId: 'm', planId: 'p', paymentMethod: 'CASH' }, 'staff'), /payment failure/);
  assert.deepEqual(writes, ['suspend-old', 'create-new']);
});
test('BR-03: COACH may cancel unrelated member enrollment', async () => {
  const db = { enrollment: { findUnique: async () => ({ status: 'BOOKED', member: { userId: 'other-member' }, schedule: { startTime: new Date('2099-01-01') } }), update: async ({ data }) => data } };
  assert.equal((await service('enrollments', db).cancelEnrollment('e', 'unassigned-coach', 'COACH')).status, 'CANCELLED');
});
test('BR-14: REFUNDED -> SUCCESS leaves existing invoice CANCELLED', async () => {
  const invoice = { id: 'inv', status: 'CANCELLED' }; let invoiceWrites = 0;
  const db = { payment: { findUnique: async () => ({ id: 'p', status: 'REFUNDED', invoice }), update: async ({ data }) => data }, invoice: { update: async () => { invoiceWrites++; }, create: async () => { invoiceWrites++; } } };
  await service('payments', db).updatePaymentStatus('p', 'SUCCESS');
  assert.equal(invoiceWrites, 0); assert.equal(invoice.status, 'CANCELLED');
});
