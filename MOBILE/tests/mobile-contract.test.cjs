const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the real TS services against an isolated HTTP fixture. Expo-only
// platform/storage bindings are replaced; Axios/interceptors are real.
function loadApp(baseURL) {
  const modules = new Map();
  const stored = { access: '', refresh: '', facility: '' };
  const storage = {
    getAccessToken: async () => stored.access, getRefreshToken: async () => stored.refresh,
    getFacilityId: async () => stored.facility,
    setTokens: async (access, refresh) => Object.assign(stored, { access, refresh }),
    clearTokens: async () => Object.assign(stored, { access: '', refresh: '' }),
    setFacilityId: async (facility) => { stored.facility = facility || ''; },
  };
  function load(file) {
    const filename = path.resolve(__dirname, '..', file.endsWith('.ts') ? file : `${file}.ts`);
    if (filename.endsWith(`${path.sep}lib${path.sep}storage.ts`)) return { storage };
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} }; modules.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = (name) => {
      if (name === 'react-native') return { Platform: { OS: 'web', select: (values) => values.web || values.default } };
      return name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name))) : require(name);
    };
    vm.runInThisContext(`(function(require,module,exports,process){${source}\n})`, { filename })(localRequire, module, module.exports, { env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: baseURL } });
    return module.exports;
  }
  return { load, stored };
}
async function fixture(run) {
  const requests = [];
  let handler = () => ({ data: null });
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const request = { method: req.method, path: new URL(req.url, 'http://localhost').pathname, query: new URL(req.url, 'http://localhost').searchParams, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
    requests.push(request);
    try {
      const response = await handler(request);
      res.writeHead(response.status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: response.status ? response.status < 400 : true, message: '', ...response }));
    } catch { res.writeHead(500); res.end('{}'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const app = loadApp(`http://127.0.0.1:${server.address().port}/api/v1/`);
  try { await run({ ...app, requests, handle: (fn) => { handler = fn; } }); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

test('login uses the deployed web endpoint, requires CAPTCHA and excludes stale credentials', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); const auth = load('services/authService');
  await api.saveTokens('old-access', 'old-refresh'); await api.setFacilityId('old-facility');
  assert.throws(() => auth.loginWithCaptcha('member@example.test', 'secret', ''), /xác minh/);
  assert.equal(requests.length, 0);
  handle(() => ({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } }));
  await auth.loginWithCaptcha(' MEMBER@EXAMPLE.TEST ', 'secret', 'single-use-test-token');
  assert.equal(requests[0].path, '/api/v1/auth/login');
  assert.deepEqual(requests[0].body, { email: 'member@example.test', password: 'secret', turnstileToken: 'single-use-test-token' });
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[0].headers['x-facility-id'], undefined);
}));

test('simultaneous 401 requests refresh once and retry with the rotated token', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('expired', 'refresh'); await api.setFacilityId('facility-a');
  handle(async (req) => {
    if (req.path.endsWith('/auth/refresh-token')) { await new Promise((r) => setTimeout(r, 25)); return { data: { accessToken: 'rotated', refreshToken: 'refresh-next' } }; }
    if (req.headers.authorization === 'Bearer expired') return { status: 401, message: 'Expired' };
    return { data: { ok: true } };
  });
  const responses = await Promise.all([api.api.get('/classes'), api.api.get('/class-schedules')]);
  assert.equal(requests.filter((r) => r.path.endsWith('/auth/refresh-token')).length, 1);
  assert.ok(responses.every((r) => r.data.ok));
  assert.equal(api.getAccessToken(), 'rotated');
  assert.ok(requests.filter((r) => r.headers.authorization === 'Bearer rotated').every((r) => r.headers['x-facility-id'] === 'facility-a'));
}));

test('refresh rejection clears storage and emits session-expired after ApiError conversion', async () => fixture(async ({ load, stored, handle }) => {
  const api = load('lib/api'); let expired = 0;
  load('lib/sessionEvents').onSessionExpired(() => expired++);
  await api.saveTokens('expired', 'revoked');
  handle((req) => ({ status: req.path.endsWith('/auth/refresh-token') ? 403 : 401, message: 'Revoked' }));
  await assert.rejects(api.api.get('/classes'), (e) => e.status === 403);
  assert.equal(api.hasSession(), false); assert.equal(stored.refresh, ''); assert.equal(expired, 1);
}));

test('a delayed refresh cannot restore a session after logout', async () => fixture(async ({ load, handle }) => {
  const api = load('lib/api'); await api.saveTokens('expired', 'refresh');
  let entered; const started = new Promise((r) => { entered = r; });
  let release; const delayed = new Promise((r) => { release = r; });
  handle(async (req) => {
    if (!req.path.endsWith('/auth/refresh-token')) return { status: 401 };
    entered(); await delayed; return { data: { accessToken: 'obsolete', refreshToken: 'obsolete-refresh' } };
  });
  const request = api.api.get('/classes');
  await started; await api.clearTokens(); release();
  await assert.rejects(request, (e) => e.status === 409);
  assert.equal(api.hasSession(), false);
}));

test('allPages loads every page and rejects repeated pages instead of silently duplicating data', async () => fixture(async ({ load, handle }) => {
  handle((req) => ({ data: [{ id: `row-${req.query.get('page')}` }], pagination: { page: Number(req.query.get('page')), totalPages: 3 } }));
  const all = load('lib/pagedApi').allPages;
  assert.deepEqual((await all('/enrollments/my')).data.map((r) => r.id), ['row-1', 'row-2', 'row-3']);
  handle(() => ({ data: [{ id: 'row-1' }], pagination: { page: 1, totalPages: 3 } }));
  await assert.rejects(all('/classes'), /đúng danh sách/);
}));

test('workflow writes follow the web API payloads and facility context', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh'); await api.setFacilityId('facility-b');
  handle(() => ({ data: {} })); const workflow = load('services/workflowService');
  await workflow.checkInFacility(); await workflow.joinWaitlist('session-a'); await workflow.createIssue({ title: 'Support', description: 'Need assistance' });
  await workflow.requestLeave({ startTime: '2026-10-15T01:00:00.000Z', endTime: '2026-10-15T10:00:00.000Z', reason: 'Leave request' });
  assert.deepEqual(requests.map((r) => r.body), [{ method: 'QR' }, { scheduleId: 'session-a' }, { title: 'Support', description: 'Need assistance' }, { startTime: '2026-10-15T01:00:00.000Z', endTime: '2026-10-15T10:00:00.000Z', reason: 'Leave request' }]);
  assert.ok(requests.every((r) => r.headers['x-facility-id'] === 'facility-b'));
}));

test('GMT+7 calendar boundaries and leave validation do not depend on device timezone', () => {
  const app = loadApp('http://localhost/api/v1'); const dates = app.load('lib/date'); const fmt = app.load('lib/format');
  const instant = new Date('2026-10-11T18:30:00Z');
  assert.equal(fmt.formatDate(instant.toISOString()), '12/10/2026'); assert.equal(fmt.formatTime(instant.toISOString()), '01:30');
  assert.equal(dates.startOfWeek(instant).toISOString(), '2026-10-11T17:00:00.000Z');
  assert.equal(dates.endOfDay(instant).toISOString(), '2026-10-12T16:59:59.999Z');
  assert.equal(new Date(dates.parseVietnamDateTime('2026-10-15 08:00')).toISOString(), '2026-10-15T01:00:00.000Z');
  for (const value of ['2026-02-30 08:00', '2026-10-15 25:00', '15/10/2026 08:00']) assert.ok(Number.isNaN(dates.parseVietnamDateTime(value)));
});

test('role guards and membership rules match the web contract', () => {
  const app = loadApp('http://localhost/api/v1'); const auth = app.load('services/authService'); const routes = app.load('navigation/routes'); const rules = app.load('lib/businessRules');
  auth.assertMobileRole({ role: 'MEMBER' }); auth.assertMobileRole({ role: 'COACH' }); assert.throws(() => auth.assertMobileRole({ role: 'MANAGER' }));
  assert.equal(routes.canAccessRoute('COACH', ['member', 'payments']), false); assert.equal(routes.canAccessRoute('MEMBER', ['coach', 'leave']), false);
  assert.equal(routes.canAccessRoute('MEMBER', ['(tabs)', 'coach-attendance']), false);
  assert.equal(rules.downgradeReason({ tier: 'PREMIUM', durationDaysSnapshot: 90 }, { tier: 'MEMBERSHIP', durationDays: 90 }), 'Không thể mua gói thấp hơn hạng hiện tại.');
  assert.equal(rules.downgradeReason({ tier: 'PREMIUM', durationDaysSnapshot: 90 }, { tier: 'PREMIUM', durationDays: 30 }), 'Không thể mua gói ngắn hơn cùng hạng.');
  const now = Date.parse('2026-10-12T00:00:00Z');
  assert.equal(rules.selfCancelRefundEstimate('2026-10-27T00:00:00Z', 100000, now).refundAmount, 0);
  assert.equal(rules.selfCancelRefundEstimate('2026-10-28T00:00:00Z', 100000, now).refundAmount, 30000);
  const session = { status: 'SCHEDULED', startTime: '2026-10-12T01:00:00Z', endTime: '2026-10-12T02:00:00Z' };
  assert.equal(rules.canGenerateAttendanceQr(session, Date.parse('2026-10-12T00:29:59Z')), false);
  assert.equal(rules.canGenerateAttendanceQr(session, Date.parse('2026-10-12T00:30:00Z')), true);
});

test('attachment tokens are never sent to foreign origins or public static file URLs', () => {
  const api = loadApp('https://api.example.test/api/v1').load('lib/api');
  assert.equal(api.attachmentLocation('/api/v1/chat/attachments/file-a?name=photo.png').origin, 'https://api.example.test');
  for (const url of ['https://foreign.example/chat/attachments/file-a', 'https://api.example.test/uploads/file-a', 'https://user:pass@api.example.test/api/v1/chat/attachments/file-a', '/api/v1/chat/attachments/file-a/nested', '/api/v1/chat/attachments/']) assert.equal(api.attachmentLocation(url), null);
});

test('401 retry preserves the original facility and pagination stops when the facility changes', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('expired', 'refresh'); await api.setFacilityId('facility-a');
  handle(async (req) => {
    if (req.path.endsWith('/auth/refresh-token')) { await api.setFacilityId('facility-b'); return { data: { accessToken: 'rotated', refreshToken: 'new-refresh' } }; }
    return req.headers.authorization === 'Bearer expired' ? { status: 401 } : { data: [] };
  });
  await api.api.get('/classes');
  assert.deepEqual(requests.filter((r) => r.path.endsWith('/classes')).map((r) => r.headers['x-facility-id']), ['facility-a', 'facility-a']);
  handle(async () => { await api.setFacilityId('facility-c'); return { data: [{ id: 'row' }], pagination: { page: 1, totalPages: 2 } }; });
  await assert.rejects(load('lib/pagedApi').allPages('/enrollments/my'), (e) => e.status === 409);
}));

test('subscription cancellation and whole-course enrollment use the current web result contracts', async () => fixture(async ({ load, handle, requests }) => {
  handle((req) => req.path.endsWith('/enrollments/bulk') ? { data: { classId: 'class-a', className: 'Yoga', summary: { totalSessions: 8, enrolledNow: 6, alreadyBooked: 2, totalRegistered: 8 }, sessions: [] } } : { data: { subscriptionId: 'subscription-a', status: 'CANCELLED', daysLeft: 20, refundAmount: 30000 } });
  const result = await load('services/enrollmentService').enrollWholeCourse('class-a');
  assert.equal(result.data.summary.totalRegistered, 8);
  await load('services/membershipService').cancelSubscription('subscription-a', 'Test reason');
  assert.deepEqual(requests.map((r) => [r.method, r.body]), [['POST', { classId: 'class-a' }], ['PATCH', { reason: 'Test reason' }]]);
}));
