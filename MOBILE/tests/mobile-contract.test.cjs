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

test('missing member profile never falls back to the account id and the BE error is shown in Vietnamese', async () => fixture(async ({ load, handle }) => {
  const rules = load('lib/businessRules');
  assert.equal(rules.memberProfileIdOf({ id: 'user-1', memberProfile: { id: 'profile-1' } }), 'profile-1');
  // Thiếu hồ sơ → null, KHÔNG dùng tạm user.id (BE sẽ trả "Member not found")
  assert.equal(rules.memberProfileIdOf({ id: 'user-1', memberProfile: null }), null);
  assert.equal(rules.memberProfileIdOf({ id: 'user-1' }), null);
  assert.equal(rules.memberProfileIdOf(null), null);
  const api = load('lib/api');
  handle(() => ({ status: 404, message: 'Member not found' }));
  await assert.rejects(api.api.get('/subscriptions/member/x'), (e) => e.status === 404 && /hồ sơ hội viên/.test(e.message));
  // Không màn nào được dùng lại kiểu "memberProfile?.id ?? user?.id"
  const root = path.resolve(__dirname, '..');
  const offenders = [];
  const walk = (dir) => { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(name) && /memberProfile\?\.id\s*\?\?\s*user\??\.id/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(root, p)); } };
  for (const dir of ['app', 'components', 'hooks']) walk(path.join(root, dir));
  assert.deepEqual(offenders, []);
}));

test('profile chips round-trip the free-text fields BE stores without losing legacy notes', () => {
  const f = loadApp('http://localhost/api/v1').load('lib/profileFields');
  const goals = ['Tăng cơ', 'Giảm cân', 'Tăng sức bền'];
  assert.deepEqual(f.splitChoiceText('giảm cân, Tăng cơ; đau gối nhẹ', goals), { selected: ['Tăng cơ', 'Giảm cân'], note: 'đau gối nhẹ' });
  assert.deepEqual(f.splitChoiceText('Tăng cơ giảm mỡ', goals), { selected: [], note: 'Tăng cơ giảm mỡ' });
  assert.deepEqual(f.splitChoiceText(null, goals), { selected: [], note: '' });
  assert.equal(f.joinChoiceText({ selected: ['Giảm cân', 'Tăng cơ'], note: '  đau gối  ' }, goals), 'Tăng cơ, Giảm cân, đau gối');
  assert.equal(f.joinChoiceText({ selected: [], note: '' }, goals), '');
  assert.deepEqual(f.toggleChoice(['Sáng'], 'Tối'), ['Sáng', 'Tối']);
  assert.deepEqual(f.toggleChoice(['Sáng', 'Tối'], 'Sáng'), ['Tối']);
  assert.equal(f.toIsoDate({ year: 2001, month: 2, day: 31 }), '2001-02-28');
  assert.equal(f.toIsoDate({ year: 2000, month: 2, day: 29 }), '2000-02-29');
  assert.equal(f.parseIsoDate('2001-02-30'), null);
  assert.equal(f.formatIsoDate('2000-01-05T00:00:00.000Z'), '05/01/2000');
  assert.equal(f.formatIsoDate(''), '');
});

test('date of birth is limited to ages 12-80 in Vietnam time, including birthdays and leap days', () => {
  const app = loadApp('http://localhost/api/v1');
  const f = app.load('lib/profileFields'); const rules = app.load('lib/businessRules');
  const today = { year: 2026, month: 10, day: 13 };
  assert.deepEqual(f.birthDateBounds(today, 12, 80), { min: { year: 1945, month: 10, day: 14 }, max: { year: 2014, month: 10, day: 13 } });
  assert.equal(f.ageOn({ year: 2014, month: 10, day: 13 }, today), 12);
  assert.equal(f.ageOn({ year: 2014, month: 10, day: 14 }, today), 11);
  assert.equal(f.birthDateError('2014-10-13', today, 12, 80), null);
  assert.match(f.birthDateError('2014-10-14', today, 12, 80), /từ 12 đến 80/);
  assert.equal(f.birthDateError('1945-10-14', today, 12, 80), null);
  assert.match(f.birthDateError('1945-10-13', today, 12, 80), /từ 12 đến 80/);
  assert.equal(f.birthDateError('', today, 12, 80), null);
  assert.equal(f.birthDateError('2001-02-30', today, 12, 80), 'Ngày sinh không hợp lệ');
  assert.deepEqual(f.birthDateBounds({ year: 2028, month: 2, day: 29 }, 12, 80).max, { year: 2016, month: 2, day: 29 });
  assert.deepEqual(f.birthDateBounds({ year: 2027, month: 2, day: 28 }, 12, 80).max, { year: 2015, month: 2, day: 28 });
  // 23:30 UTC ngày 12 = 06:30 ngày 13 giờ Việt Nam → sinh ngày 13/10/2014 đã đủ 12 tuổi
  assert.equal(rules.memberBirthDateError('2014-10-13', new Date('2026-10-12T23:30:00Z')), null);
  assert.match(rules.memberBirthDateError('2014-10-13', new Date('2026-10-12T16:30:00Z')), /từ 12 đến 80/);
});

test('password fields restore what iOS wipes when the user returns to a secure input', () => {
  const { restoreSecureText } = loadApp('http://localhost/api/v1').load('lib/secureText');
  assert.equal(restoreSecureText('123', '4'), '1234');     // iOS xoá sạch khi gõ tiếp
  assert.equal(restoreSecureText('123', ''), '12');        // iOS xoá sạch khi bấm xoá
  assert.equal(restoreSecureText('123', '1234'), '1234');  // không bị xoá → giữ nguyên
  assert.equal(restoreSecureText('12', '1'), '1');         // xoá bình thường 1 ký tự
  assert.equal(restoreSecureText('1', ''), '');
  assert.equal(restoreSecureText('', 'a'), 'a');
  assert.equal(restoreSecureText('123', 'MatKhauDan!'), 'MatKhauDan!'); // dán / tự điền → thay toàn bộ
});

test('Vietnamese phone numbers always start with 0 and have 10-11 digits', () => {
  const rules = loadApp('http://localhost/api/v1').load('lib/businessRules');
  assert.equal(rules.normalizeVnPhoneInput('9'), '09');
  assert.equal(rules.normalizeVnPhoneInput('090 123-4567'), '0901234567');
  assert.equal(rules.normalizeVnPhoneInput('+84901234567'), '0901234567');
  assert.equal(rules.normalizeVnPhoneInput('0901234567899'), '09012345678');
  assert.equal(rules.normalizeVnPhoneInput('abc'), '');
  assert.equal(rules.vnPhoneError(''), null);
  assert.equal(rules.vnPhoneError('0901234567'), null);
  assert.equal(rules.vnPhoneError('09012345678'), null);
  assert.match(rules.vnPhoneError('090123456'), /bắt đầu bằng 0 và có 10–11/);
  assert.match(rules.vnPhoneError('9901234567'), /bắt đầu bằng 0/);
  assert.match(rules.vnPhoneError('090123456789'), /10–11/);
});

test('class cards summarise weekly slots and seat availability from the course plan', () => {
  const plan = loadApp('http://localhost/api/v1').load('lib/classPlan');
  const slot = (weekday, startTime, roomName = 'Phòng Yoga') => ({ weekday, weekdayLabel: `Thứ ${weekday + 1}`, startTime, endTime: '19:30', durationMinutes: 90, roomId: roomName, roomName, sessionCount: 4 });
  assert.equal(plan.formatSlot(slot(1, '18:00')), 'Thứ 2 · 18:00–19:30');
  assert.equal(plan.formatSlot(slot(1, '18:00'), true), 'Thứ 2 · 18:00–19:30 · Phòng Yoga');
  const preview = plan.previewSlots([slot(1, '18:00'), slot(3, '18:00'), slot(5, '07:00')], 2);
  assert.equal(preview.shown.length, 2); assert.equal(preview.hiddenCount, 1);
  assert.deepEqual(plan.previewSlots(undefined, 2), { shown: [], hiddenCount: 0 });
  const course = (fullSessionCount, minRemainingSlots, totalSessions = 8) => ({ totalSessions, availability: { fullSessionCount, minRemainingSlots, isFullyBookable: fullSessionCount === 0 } });
  assert.deepEqual(plan.courseAvailability(course(8, 0), 3), { text: 'Đã kín chỗ', tone: 'full' });
  assert.deepEqual(plan.courseAvailability(course(2, 0), 3), { text: '2/8 buổi đã kín chỗ', tone: 'limited' });
  assert.deepEqual(plan.courseAvailability(course(0, 3), 3), { text: 'Sắp kín · còn 3 chỗ', tone: 'limited' });
  assert.deepEqual(plan.courseAvailability(course(0, 10), 3), { text: 'Còn 10 chỗ trống', tone: 'open' });
});

test('plan switching follows the BE purchase matrix: renew chains, upgrade now or scheduled, downgrade after expiry', () => {
  const p = loadApp('http://localhost/api/v1').load('lib/planSwitch');
  const premium = { tier: 'PREMIUM', durationDaysSnapshot: 90, endDate: '2026-11-20T09:13:00.000Z' };
  // Loại đổi gói (khớp detectPlanSwitchType của web)
  assert.equal(p.detectPlanSwitchType(null, { tier: 'PREMIUM', durationDays: 30 }), 'NEW');
  assert.equal(p.detectPlanSwitchType({ tier: 'FREE' }, { tier: 'MEMBERSHIP', durationDays: 30 }), 'NEW');
  assert.equal(p.detectPlanSwitchType(premium, { tier: 'PREMIUM', durationDays: 30 }), 'RENEW_SAME_TIER');
  assert.equal(p.detectPlanSwitchType({ plan: { tier: 'MEMBERSHIP' } }, { tier: 'PREMIUM', durationDays: 30 }), 'UPGRADE');
  assert.equal(p.detectPlanSwitchType(premium, { tier: 'MEMBERSHIP', durationDays: 90 }), 'DOWNGRADE');
  // Hạ cấp / gói ngắn hơn KHÔNG còn bị chặn — chỉ giải thích
  const now = new Date('2026-10-20T03:00:00.000Z'); // 10:00 20/10 giờ VN
  assert.equal(p.planSwitchHint(premium, { tier: 'MEMBERSHIP', durationDays: 90 }, now), 'Gói sẽ kích hoạt sau ngày 20/11/2026.');
  assert.equal(p.planSwitchHint(premium, { tier: 'PREMIUM', durationDays: 30 }, now), 'Gia hạn tự động nối tiếp sau 20/11/2026. Gói này ngắn hơn gói bạn đang dùng.');
  assert.equal(p.planSwitchHint(null, { tier: 'PREMIUM', durationDays: 30 }, now), '');
  // Khoảng ngày được hẹn (tối đa 60 ngày, giờ VN)
  assert.deepEqual(p.planStartWindow('UPGRADE', premium, 60, now), { min: { year: 2026, month: 10, day: 21 }, max: { year: 2026, month: 12, day: 19 }, initial: { year: 2026, month: 10, day: 21 } });
  assert.deepEqual(p.planStartWindow('DOWNGRADE', premium, 60, now), { min: { year: 2026, month: 11, day: 20 }, max: { year: 2027, month: 1, day: 19 }, initial: { year: 2026, month: 11, day: 20 } });
  assert.equal(p.planStartWindow('RENEW_SAME_TIER', premium, 60, now), null);
  assert.equal(p.planStartWindow('DOWNGRADE', { tier: 'PREMIUM', endDate: '2026-10-01T00:00:00Z' }, 60, now), null);
  assert.equal(p.automaticStartDate('RENEW_SAME_TIER', premium, now), premium.endDate);
  assert.equal(p.automaticStartDate('UPGRADE', premium, now), null);
  // startDate gửi BE: 00:00 giờ VN; hạ cấp chọn đúng ngày hết hạn thì để BE tự nối tiếp đúng giờ
  assert.equal(p.checkoutStartDate('UPGRADE', '2026-10-25', premium), '2026-10-24T17:00:00.000Z');
  assert.equal(p.checkoutStartDate('UPGRADE', undefined, premium), undefined);
  assert.equal(p.checkoutStartDate('DOWNGRADE', '2026-11-20', premium), undefined);
  assert.equal(p.checkoutStartDate('DOWNGRADE', '2026-11-25', premium), '2026-11-24T17:00:00.000Z');
  assert.equal(p.checkoutStartDate('RENEW_SAME_TIER', '2026-11-25', premium), undefined);
});

test('SePay checkout sends startDate only when the member schedules activation', async () => fixture(async ({ load, requests, handle }) => {
  const pay = load('services/paymentService');
  handle(() => ({ data: { paymentId: 'p1' } }));
  await pay.createSepayCheckout('plan-1');
  await pay.createSepayCheckout('plan-2', '2026-11-24T17:00:00.000Z');
  assert.deepEqual(requests.map((r) => r.body), [{ planId: 'plan-1' }, { planId: 'plan-2', startDate: '2026-11-24T17:00:00.000Z' }]);
}));
