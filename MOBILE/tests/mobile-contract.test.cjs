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
  // Coach không còn gửi /leave-requests (BE chỉ cho lễ tân) — đổi HLV theo buổi qua /coach-change-requests
  await load('services/coachChangeService').createCoachChange({ scheduleId: 'session-b', reason: 'Bận công tác' });
  assert.deepEqual(requests.map((r) => r.body), [{ method: 'QR' }, { scheduleId: 'session-a' }, { title: 'Support', description: 'Need assistance' }, { scheduleId: 'session-b', reason: 'Bận công tác' }]);
  assert.deepEqual(requests.map((r) => r.path).slice(-1), ['/api/v1/coach-change-requests']);
  assert.ok(!requests.some((r) => r.path.endsWith('/leave-requests')));
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

test('navigation: 5 tabs per role, every tab file registered, shortcuts and account menu never duplicate a tab', () => {
  const app = loadApp('http://localhost/api/v1');
  const tabs = app.load('navigation/tabConfig'); const quick = app.load('navigation/quickAccessConfig');
  const menu = app.load('navigation/accountMenuConfig'); const { ROUTES, canAccessRoute } = app.load('navigation/routes');
  const visible = (role) => tabs.getTabConfigForRole(role).filter((t) => t.visible).map((t) => t.name);
  assert.deepEqual(visible('MEMBER'), ['index', 'classes', 'schedule', 'chat', 'account']);
  assert.deepEqual(visible('COACH'), ['index', 'schedule', 'coach-attendance', 'chat', 'account']);
  const files = fs.readdirSync(path.resolve(__dirname, '../app/(tabs)')).filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx').map((f) => f.replace('.tsx', '')).sort();
  for (const role of ['MEMBER', 'COACH']) {
    assert.deepEqual(tabs.getTabConfigForRole(role).map((t) => t.name).sort(), files, role + ' must register every (tabs) route');
    const tabRoutes = visible(role).map((name) => name === 'index' ? ROUTES.home : '/(tabs)/' + name).concat(ROUTES.notifications);
    for (const item of quick.getQuickAccessForRole(role)) assert.ok(!tabRoutes.includes(item.route), role + ' shortcut duplicates a tab: ' + item.label);
    assert.ok(quick.getQuickAccessForRole(role).length <= 4);
    const items = menu.getAccountMenuForRole(role).flatMap((g) => g.items);
    assert.equal(new Set(items.map((i) => JSON.stringify(i.route))).size, items.length, role + ' account menu has duplicate routes');
    for (const item of items) {
      const segments = String(item.route).split('/').filter(Boolean);
      assert.ok(canAccessRoute(role, segments), role + ' cannot open ' + item.label);
    }
  }
});

test('home formatters: greeting by Vietnam hour and "starts in" labels', () => {
  const f = loadApp('http://localhost/api/v1').load('lib/format');
  assert.equal(f.greetingFor(new Date('2026-10-20T01:00:00Z')), 'Chào buổi sáng');   // 08:00 VN
  assert.equal(f.greetingFor(new Date('2026-10-20T12:00:00Z')), 'Chào buổi tối');    // 19:00 VN
  const now = new Date('2026-10-20T03:00:00Z'); // 10:00 VN
  assert.equal(f.formatStartsIn('2026-10-20T03:25:00Z', '2026-10-20T04:25:00Z', now), 'Bắt đầu sau 25 phút');
  assert.equal(f.formatStartsIn('2026-10-20T02:30:00Z', '2026-10-20T03:30:00Z', now), 'Đang diễn ra');
  assert.equal(f.formatStartsIn('2026-10-20T11:00:00Z', '2026-10-20T12:30:00Z', now), 'Hôm nay, 18:00');
  assert.equal(f.formatStartsIn('2026-10-20T23:30:00Z', '2026-10-21T00:30:00Z', now), 'Ngày mai, 06:30');
  assert.equal(f.formatStartsIn('2026-10-22T11:00:00Z', '2026-10-22T12:00:00Z', now), 'T5, 22/10/2026 · 18:00');
});

test('class sessions are view-only like the web: status labels and waitlist only when full', () => {
  const app = loadApp('http://localhost/api/v1');
  const plan = app.load('lib/classPlan'); const quick = app.load('navigation/quickAccessConfig'); const { ROUTES } = app.load('navigation/routes');
  const s = (over) => ({ id: 's', startTime: '2099-01-01T10:00:00Z', endTime: '2099-01-01T11:00:00Z', status: 'SCHEDULED', remainingSlots: 3, isFull: false, isBookable: true, canBook: true, myEnrollmentStatus: null, conflictWith: null, ...over });
  assert.deepEqual(plan.sessionStatusLabel(s({ myEnrollmentStatus: 'BOOKED' })), { text: 'Đã đặt', tone: 'booked' });
  assert.deepEqual(plan.sessionStatusLabel(s({ myEnrollmentStatus: 'COMPLETED' })), { text: 'Đã hoàn thành', tone: 'completed' });
  assert.deepEqual(plan.sessionStatusLabel(s({ isFull: true })), { text: 'Hết chỗ', tone: 'full' });
  assert.deepEqual(plan.sessionStatusLabel(s({ conflictWith: { className: 'Yoga' } })), { text: 'Trùng giờ với Yoga', tone: 'conflict' });
  assert.deepEqual(plan.sessionStatusLabel(s({})), { text: 'Chưa đặt', tone: 'none' });
  assert.equal(plan.canJoinSessionWaitlist(s({ isFull: true })), true);
  assert.equal(plan.canJoinSessionWaitlist(s({ isFull: true, myEnrollmentStatus: 'BOOKED' })), false);
  assert.equal(plan.canJoinSessionWaitlist(s({ isFull: true, startTime: '2000-01-01T00:00:00Z' })), false);
  assert.equal(plan.canJoinSessionWaitlist(s({})), false);
  // Thẻ gói trên Trang chủ đã mở Gói thành viên → không có lối tắt trùng
  assert.ok(!quick.getQuickAccessForRole('MEMBER').some((i) => i.route === ROUTES.membershipPlans));
});

test('coach change per session replaces coach leave: reason rules, filters, menus and notification routes', async () => fixture(async ({ load, requests, handle }) => {
  const rules = load('lib/coachChange'); const { ROUTES } = load('navigation/routes');
  assert.equal(rules.coachChangeReasonError(''), null);
  assert.match(rules.coachChangeReasonError(' ab '), /ít nhất 3/);
  assert.match(rules.coachChangeReasonError('x'.repeat(1001)), /tối đa 1000/);
  assert.equal(rules.canSubmitCoachChange('', 'Bận công tác'), false);
  assert.equal(rules.canSubmitCoachChange('s1', '  ab  '), false);
  assert.equal(rules.canSubmitCoachChange('s1', 'Bận công tác'), true);
  const rows = [{ id: 'a', status: 'PENDING' }, { id: 'b', status: 'APPROVED' }, { id: 'c', status: 'REJECTED' }];
  assert.deepEqual(rules.filterCoachChanges(rows, 'ALL').map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(rules.filterCoachChanges(rows, 'APPROVED').map((r) => r.id), ['b']);
  assert.equal(rules.formatSessionWindow('2026-10-29T01:00:00Z', '2026-10-29T02:30:00Z'), 'T5, 29/10/2026 · 08:00–09:30');
  // Menu + lối tắt của Coach mở màn mới, không còn đường dẫn nghỉ phép
  const menu = load('navigation/accountMenuConfig').getAccountMenuForRole('COACH').flatMap((g) => g.items);
  assert.ok(menu.some((i) => i.route === ROUTES.coachChanges));
  assert.ok(load('navigation/quickAccessConfig').getQuickAccessForRole('COACH').some((i) => i.route === ROUTES.coachChanges));
  assert.equal(ROUTES.coachLeave, undefined);
  const route = load('navigation/notificationRoute').resolveNotificationRoute;
  const n = (type, metadata) => ({ id: 'n', userId: 'u', type, title: '', body: '', isRead: false, createdAt: '', metadata });
  assert.deepEqual(route(n('COACH_CHANGE_APPROVED', { scheduleId: 's1' })), ROUTES.scheduleDetail('s1'));
  assert.equal(route(n('COACH_CHANGE_REJECTED', { scheduleId: 's1' })), ROUTES.coachChanges);
  assert.equal(route(n('PAYMENT_FAILED')), ROUTES.payments);
  // API: danh sách + buổi có thể yêu cầu gửi kèm cơ sở hiện tại
  const api = load('lib/api'); await api.saveTokens('coach-token', 'refresh'); await api.setFacilityId('facility-c');
  handle(() => ({ data: [] })); const service = load('services/coachChangeService');
  await service.getMyCoachChanges(); await service.getRequestableSessions();
  assert.deepEqual(requests.map((r) => r.method + ' ' + r.path), ['GET /api/v1/coach-change-requests', 'GET /api/v1/coach-change-requests/sessions']);
  assert.ok(requests.every((r) => r.headers['x-facility-id'] === 'facility-c'));
}));

test('enrollment quota banner: FREE or no plan is locked like the web, otherwise available or full', () => {
  const plan = loadApp('http://localhost/api/v1').load('lib/classPlan');
  assert.equal(plan.quotaBannerKind({ hasActiveSubscription: true, limit: 0, remaining: 0 }), 'locked');
  assert.equal(plan.quotaBannerKind({ hasActiveSubscription: false, limit: 2, remaining: 2 }), 'locked');
  assert.equal(plan.quotaBannerKind({ hasActiveSubscription: true, limit: 2, remaining: 1 }), 'available');
  assert.equal(plan.quotaBannerKind({ hasActiveSubscription: true, limit: 2, remaining: 0 }), 'full');
});

test('late term registration: a plan with at least 50% of its purchased days left still enrolls after the deadline', () => {
  const app = loadApp('http://localhost/api/v1');
  const t = app.load('lib/termRegistration'); const { LATE_REGISTRATION_MIN_REMAINING_RATIO } = app.load('constants/terms');
  const DAY = 86_400_000; const now = Date.parse('2026-11-10T05:00:00Z');
  const iso = (ms) => new Date(ms).toISOString();
  const term = (over) => ({ name: 'Kỳ Thu 2026', status: 'IN_PROGRESS', endDate: iso(now + 60 * DAY), registrationStartDate: iso(now - 40 * DAY), registrationEndDate: iso(now - 5 * DAY), ...over });
  // Gói 180 ngày: còn ≥ 90 ngày thì đủ, 89 thì không (ví dụ của yêu cầu)
  const plan = (daysLeft, over) => ({ tier: 'MEMBERSHIP', startDate: iso(now - (180 - daysLeft) * DAY), endDate: iso(now + daysLeft * DAY), durationDaysSnapshot: 180, ...over });
  assert.equal(LATE_REGISTRATION_MIN_REMAINING_RATIO, 0.5);
  assert.deepEqual(t.lateRegistration(plan(90), now), { allowed: true, remainingDays: 90, totalDays: 180, requiredDays: 90 });
  assert.equal(t.lateRegistration(plan(120), now).allowed, true);
  assert.equal(t.lateRegistration(plan(89), now).allowed, false);
  assert.equal(t.lateRegistration(plan(0), now).allowed, false);
  // Số ngày hiển thị và phép so sánh dùng chung một con số (còn 89,5 ngày hiển thị 90 → đủ)
  assert.equal(t.lateRegistration(plan(89.5), now).allowed, true);
  // Tổng thời hạn: snapshot lúc mua > thời hạn gói > khoảng ngày; số lẻ làm tròn lên (gói 45 ngày cần ≥ 23)
  assert.equal(t.purchasedDays({ ...plan(10), durationDaysSnapshot: undefined, plan: { durationDays: 30 } }), 30);
  assert.equal(t.purchasedDays({ startDate: iso(now), endDate: iso(now + 45 * DAY) }), 45);
  assert.equal(t.lateRegistration({ startDate: iso(now - 22 * DAY), endDate: iso(now + 23 * DAY), tier: 'MEMBERSHIP' }, now).requiredDays, 23);
  // Gói FREE / chưa có gói không có thời hạn đã mua → không đủ điều kiện
  assert.equal(t.lateRegistration(plan(150, { tier: 'FREE' }), now), null);
  assert.equal(t.lateRegistration(null, now), null);

  // Giai đoạn đăng ký khớp web MemberTermBanner
  assert.equal(t.termPhase(term({ status: 'CLOSED' }), now), 'ended');
  assert.equal(t.termPhase(term({ status: 'PLANNING' }), now), 'planning');
  assert.equal(t.termPhase(term({ registrationStartDate: iso(now + DAY) }), now), 'upcoming');
  assert.equal(t.termPhase(term({ registrationEndDate: iso(now + 3 * DAY) }), now), 'open');
  assert.equal(t.termPhase(term(), now), 'closed');
  assert.match(t.termNotice(term({ registrationEndDate: iso(now + 3 * DAY) }), null, now).message, /còn 3 ngày/);

  // Quá hạn + gói đủ 50% → "Đăng ký muộn"; chưa đủ hoặc chưa có gói → cảnh báo + gợi ý xem gói, và giải thích thay dòng chặn của BE
  const ok = t.termNotice(term(), plan(100), now); // Khám phá: chưa xét khóa cụ thể
  assert.deepEqual([ok.late, ok.tone, ok.suggestPlans], [true, 'success', false]); assert.match(ok.message, /100\/180 ngày/);
  const low = t.termNotice(term(), plan(40), now, true);
  assert.deepEqual([low.late, low.tone, low.suggestPlans, low.coversBlocker], [false, 'warning', true, true]); assert.match(low.message, /cần còn ít nhất 90 ngày/);
  const none = t.termNotice(term(), null, now, true);
  assert.deepEqual([none.late, none.suggestPlans, none.coversBlocker], [false, true, true]);
  // BE là nguồn chính thức: BE chặn thì không báo "vẫn đăng ký được" (giữ lý do của BE); BE cho phép thì tin BE
  const blocked = t.termNotice(term(), plan(100), now, true);
  assert.deepEqual([blocked.late, blocked.tone, blocked.coversBlocker], [false, 'warning', false]);
  const allowed = t.termNotice(term(), plan(40), now, false);
  assert.deepEqual([allowed.late, allowed.tone], [true, 'success']);
  assert.equal(t.termNotice(term({ status: 'CLOSED' }), plan(100), now, true).phase, 'ended');

  // Gợi ý ở thẻ gói đang dùng
  assert.match(t.lateRegistrationHint(t.lateRegistration(plan(100), now)).text, /đủ điều kiện — còn 100\/180 ngày, cần ≥ 90/);
  assert.equal(t.lateRegistrationHint(t.lateRegistration(plan(40), now)).tone, 'warning');
  assert.equal(t.lateRegistrationHint(null), null);

  // Nút cố định dưới đáy: đủ khóa > đăng ký > xem gói (thiếu gói hoặc hết hạn đăng ký kỳ học) > chưa thể
  const { courseFooterKind } = app.load('lib/classPlan'); const base = { isFullyRegistered: false, eligible: false, needsMembership: false, termSuggestsPlans: false };
  assert.equal(courseFooterKind({ ...base, isFullyRegistered: true, eligible: true }), 'registered');
  assert.equal(courseFooterKind({ ...base, eligible: true }), 'enroll');
  assert.equal(courseFooterKind({ ...base, needsMembership: true }), 'plans');
  assert.equal(courseFooterKind({ ...base, termSuggestsPlans: true }), 'plans');
  assert.equal(courseFooterKind(base), 'blocked');
});

test('FREE plan has no cancel action: only paid subscriptions can be self-cancelled', () => {
  const rules = loadApp('http://localhost/api/v1').load('lib/businessRules');
  assert.equal(rules.isFreeSubscription({ tier: 'FREE' }), true);
  assert.equal(rules.isFreeSubscription({ plan: { tier: 'FREE' } }), true); // thiếu tier trên subscription → lấy tier của gói
  assert.equal(rules.isFreeSubscription({ tier: 'MEMBERSHIP', plan: { tier: 'FREE' } }), false); // tier trên subscription được ưu tiên
  assert.equal(rules.isFreeSubscription({}), false);
  assert.equal(rules.isFreeSubscription(null), false);
  assert.equal(rules.canSelfCancelSubscription({ tier: 'FREE' }), false);
  assert.equal(rules.canSelfCancelSubscription(null), false);
  assert.equal(rules.canSelfCancelSubscription(undefined), false);
  assert.equal(rules.canSelfCancelSubscription({ tier: 'MEMBERSHIP' }), true);
  assert.equal(rules.canSelfCancelSubscription({ tier: 'PREMIUM' }), true);
  assert.equal(rules.canSelfCancelSubscription({}), true); // chưa rõ hạng → để BE quyết định
});

test('horizontal scrollers lock flexGrow: 0 so chips never stretch into giant ovals inside a flex-1 column', () => {
  const root = path.resolve(__dirname, '..'); const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name)) {
        const source = fs.readFileSync(full, 'utf8');
        if (/\bhorizontal\b/.test(source) && !/flexGrow:\s*0/.test(source)) offenders.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, 'app')); walk(path.join(root, 'components'));
  assert.deepEqual(offenders, []);
});

test('tabs hidden from the bar stay navigable: Expo Router 58 turns href: null into hidden: true, which redirects to Home', () => {
  const layout = fs.readFileSync(path.resolve(__dirname, '..', 'app/(tabs)/_layout.tsx'), 'utf8');
  const code = layout.replace(/\/\/.*$/gm, ''); // bỏ chú thích, chỉ xét code
  // Bản cũ viết `href: tab.visible ? undefined : null` → mọi cách đặt href trong layout đều bị coi là ẩn tab
  assert.ok(!/\bhref\s*:/.test(code), 'href: null (kể cả dạng điều kiện) làm Hồ sơ, Thông báo… không mở được, tự về Trang chủ');
  assert.ok(!/hidden:\s*true/.test(code));
  assert.match(code, /tabBarItemStyle:\s*\{\s*display:\s*'none'/); // ẩn bằng cách thu gọn khung nút tab
  // Các màn con vẫn khai báo trong Tabs cho cả hai vai trò mobile
  const { getTabConfigForRole } = loadApp('http://localhost/api/v1').load('navigation/tabConfig');
  for (const role of ['MEMBER', 'COACH']) {
    const names = getTabConfigForRole(role).map((t) => t.name);
    for (const name of ['profile', 'notifications']) assert.ok(names.includes(name), `${role} thiếu màn ${name}`);
    assert.equal(getTabConfigForRole(role).filter((t) => t.visible).length, 5);
  }
});

test('class of another facility: BE FORBIDDEN_SCOPE keeps its code, the owning facility is found and explained', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh'); await api.setFacilityId('fac-q1');
  const q7 = { id: 'fac-q7', name: 'SCMS Quận 7' }; const q2 = { id: 'fac-q2', name: 'SCMS Quận 2' };
  // BE thật: header cơ sở không khớp cơ sở của lớp → 403 FORBIDDEN_SCOPE; đúng cơ sở → dữ liệu
  handle((req) => req.headers['x-facility-id'] === 'fac-q7' ? { data: { id: 'class-q7' } } : { status: 403, message: 'FORBIDDEN_SCOPE' });
  await assert.rejects(api.apiRequest('/classes/class-q7', 'GET'), (e) => api.isWrongFacilityError(e) && e.code === 'FORBIDDEN_SCOPE' && /không thuộc cơ sở/.test(e.message));
  assert.equal(api.isWrongFacilityError(new api.ApiError('x', 403)), false); // 403 khác (không có mã) không bị nhầm
  assert.equal(api.isWrongFacilityError(new api.ApiError('x', 500, [], 'FORBIDDEN_SCOPE')), false);

  const { findOwningFacility } = load('services/facilityService');
  requests.length = 0;
  assert.equal((await findOwningFacility('/classes/class-q7', [q2, q7])).id, 'fac-q7');
  // dò đúng đường dẫn, mỗi cơ sở ứng viên một lần, không gửi lại cơ sở đang chọn
  assert.deepEqual(requests.map((r) => r.headers['x-facility-id']).sort(), ['fac-q2', 'fac-q7']);
  assert.ok(requests.every((r) => r.path.endsWith('/classes/class-q7')));

  // Không cơ sở nào là chủ (hoặc lớp đã xóa → 404) → null; lỗi máy chủ thì ném ra để báo thử lại
  handle(() => ({ status: 403, message: 'FORBIDDEN_SCOPE' }));
  assert.equal(await findOwningFacility('/classes/x', [q2, q7]), null);
  handle(() => ({ status: 404, message: 'Class not found' }));
  assert.equal(await findOwningFacility('/classes/x', [q2, q7]), null);
  handle(() => ({ status: 500, message: 'boom' }));
  await assert.rejects(findOwningFacility('/classes/x', [q2, q7]), (e) => e.status === 500);
  assert.equal(await findOwningFacility('/classes/x', []), null);
}));

test('wrong-facility card copy: probing, owner found, nowhere to be found', () => {
  const { wrongFacilityBody } = loadApp('http://localhost/api/v1').load('lib/facilityScope');
  const input = { subject: 'lớp học', currentName: 'SCMS Quận 1', ownerName: null, probing: false };
  assert.match(wrongFacilityBody({ ...input, probing: true }), /Đang tìm cơ sở của lớp học này/);
  assert.match(wrongFacilityBody({ ...input, ownerName: 'SCMS Quận 7' }), /^Lớp học này thuộc cơ sở SCMS Quận 7, còn bạn đang xem cơ sở SCMS Quận 1/);
  assert.match(wrongFacilityBody(input), /không có ở cơ sở nào khác/);
  assert.match(wrongFacilityBody({ ...input, subject: 'buổi học', currentName: null }), /^Buổi học này không thuộc cơ sở bạn đang chọn/);
});

test('coach profile in class detail: full profile wins, class data fills the gaps, copy matches the web dialog', () => {
  const app = loadApp('http://localhost/api/v1'); const p = app.load('lib/coachProfile');
  assert.deepEqual(p.splitSpecialties('HIIT Cardio, Boxing cơ bản; hiit cardio ,'), ['HIIT Cardio', 'Boxing cơ bản']);
  assert.deepEqual(p.splitSpecialties(null), []); assert.deepEqual(p.splitSpecialties('  '), []);
  assert.equal(p.coachCardRole(true), 'HUẤN LUYỆN VIÊN CHÍNH'); assert.equal(p.coachCardRole(false), 'HUẤN LUYỆN VIÊN HỖ TRỢ');
  const assigned = { coachId: 'cp-1', isPrimary: true, coach: { id: 'cp-1', user: { id: 'u-1', fullName: 'Võ Ngọc Ánh', email: 'a@x' }, specialization: 'Yoga Flow', experienceYears: 6, bio: 'Bio của lớp' } };
  // Chưa tải được hồ sơ đầy đủ → hiện ngay dữ liệu đã có trong lớp
  const quick = p.coachProfileView(assigned, null);
  assert.deepEqual([quick.name, quick.avatarUrl, quick.specialties, quick.experience, quick.bio, quick.roleLine], ['Võ Ngọc Ánh', null, ['Yoga Flow'], '6 năm huấn luyện', 'Bio của lớp', 'Huấn luyện viên chính của lớp']);
  // Hồ sơ đầy đủ từ GET /coaches/:userId ghi đè (giống web: profile?.bio ?? coach.bio)
  const full = p.coachProfileView({ ...assigned, isPrimary: false }, { id: 'u-1', fullName: 'Ánh Võ', avatarUrl: 'https://x/a.png', coachProfile: { id: 'cp-1', bio: 'Bio mới', specialization: 'Yoga, Pilates', experienceYears: 0 } });
  assert.deepEqual([full.name, full.avatarUrl, full.specialties, full.experience, full.bio, full.roleLine], ['Ánh Võ', 'https://x/a.png', ['Yoga', 'Pilates'], '0 năm huấn luyện', 'Bio mới', 'Huấn luyện viên hỗ trợ của lớp']);
  // Thiếu dữ liệu → câu mặc định của web
  const empty = p.coachProfileView({ coachId: 'c', isPrimary: false, coach: { id: 'c', user: { id: 'u', fullName: '', email: '' } } }, null);
  assert.deepEqual([empty.name, empty.specialties, empty.experience, empty.bio, empty.hasBio, empty.hasExperience], ['Huấn luyện viên', [], 'Chưa cập nhật kinh nghiệm.', 'Huấn luyện viên chưa cập nhật phần giới thiệu.', false, false]);
});

test('class card shows the class own term and its registration phase (no stray banner in the list)', () => {
  const app = loadApp('http://localhost/api/v1'); const t = app.load('lib/termRegistration'); const DAY = 86_400_000; const now = Date.parse('2026-10-27T08:00:00Z');
  const term = (over) => ({ name: 'Kỳ Mùa Đông 2026', status: 'OPEN_REGISTRATION', endDate: new Date(now + 90 * DAY).toISOString(), registrationStartDate: new Date(now - 5 * DAY).toISOString(), registrationEndDate: new Date(now + 19 * DAY).toISOString(), ...over });
  assert.deepEqual(t.termTag(term(), now), { name: 'Kỳ Mùa Đông 2026', label: 'Đang mở đăng ký', tone: 'success' });
  // Đã quá hạn chỉ nêu "Đã đóng đăng ký" — đăng ký muộn chỉ nói ở chi tiết lớp (BE xác nhận), tránh hứa nhầm trên thẻ
  assert.deepEqual([t.termTag(term({ registrationEndDate: new Date(now - DAY).toISOString() }), now).label, t.termTag(term({ registrationEndDate: new Date(now - DAY).toISOString() }), now).tone], ['Đã đóng đăng ký', 'warning']);
  assert.equal(t.termTag(term({ registrationStartDate: new Date(now + DAY).toISOString() }), now).label, 'Sắp mở đăng ký');
  assert.equal(t.termTag(term({ status: 'PLANNING' }), now).tone, 'info');
  assert.deepEqual([t.termTag(term({ status: 'CLOSED' }), now).label, t.termTag(term({ status: 'CLOSED' }), now).tone], ['Đã kết thúc', 'muted']);
  const explore = fs.readFileSync(path.resolve(__dirname, '..', 'components/classes/ClassesExploreView.tsx'), 'utf8');
  assert.ok(!/TermNoticeCard/.test(explore), 'Khám phá không còn thẻ kỳ học đứng riêng giữa danh sách lớp');
});

test('pull-to-refresh spinner shows only for the user pull, never for silent background refetches', () => {
  const p = loadApp('http://localhost/api/v1').load('lib/pullRefresh');
  // Làm mới ngầm (không kéo): không bao giờ bật vòng xoay
  assert.deepEqual(p.pullBusyChanged(p.IDLE_PULL, true), p.IDLE_PULL); assert.deepEqual(p.pullBusyChanged(p.IDLE_PULL, false), p.IDLE_PULL);
  // Người dùng kéo → vòng xoay tới khi từng bận rồi hết bận
  let state = p.startPull(false); assert.equal(state.pulling, true);
  state = p.pullBusyChanged(state, false); assert.equal(state.pulling, true); // chưa thấy bận → chưa kết thúc
  state = p.pullBusyChanged(state, true); assert.equal(state.sawBusy, true);
  state = p.pullBusyChanged(state, false); assert.deepEqual(state, p.IDLE_PULL);
  // Kéo khi đang có refetch ngầm: kết thúc ngay khi refetch xong
  state = p.startPull(true); assert.equal(state.sawBusy, true); assert.deepEqual(p.pullBusyChanged(state, false), p.IDLE_PULL);
  // Màn không báo bận → tự tắt khi hết thời gian chờ; đang bận thì không bị tắt sớm
  assert.deepEqual(p.pullIdleTimedOut(p.startPull(false)), p.IDLE_PULL); assert.equal(p.pullIdleTimedOut(p.startPull(true)).pulling, true);
});

test('class detail opens instantly from the class already loaded in the Explore list (no second loading)', () => {
  const { findClassInLists } = loadApp('http://localhost/api/v1').load('lib/classCache');
  const a = { id: 'a', name: 'Yoga' }; const b = { id: 'b', name: 'HIIT' };
  const entries = [[['classes', undefined], undefined], [['classes', 'yoga'], { data: [a] }], [['classes', 'hiit'], { data: [b] }]];
  assert.equal(findClassInLists(entries, 'b'), b); assert.equal(findClassInLists(entries, 'a'), a);
  assert.equal(findClassInLists(entries, 'zzz'), undefined); assert.equal(findClassInLists([], 'a'), undefined);
});

test('month calendar helpers follow Vietnam time: month bounds, week rows, month shifts', () => {
  const d = loadApp('http://localhost/api/v1').load('lib/date'); const iso = (x) => x.toISOString();
  const oct = new Date('2026-10-15T05:00:00Z');
  assert.equal(iso(d.startOfMonth(oct)), '2026-09-30T17:00:00.000Z'); // 00:00 VN mùng 1/10
  assert.equal(iso(d.endOfMonth(oct)), '2026-10-31T16:59:59.999Z'); // 23:59:59.999 VN 31/10
  // Tháng 10/2026: mùng 1 là thứ năm, 31 là thứ bảy → 5 hàng, từ T2 28/09 tới CN 01/11
  const weeks = d.monthWeeks(oct);
  assert.equal(weeks.length, 5); assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(d.dayKey(weeks[0][0]), '2026-09-28'); assert.equal(d.dayKey(weeks[4][6]), '2026-11-01');
  // Tháng 2/2027 bắt đầu thứ hai và có 28 ngày = 4 hàng; tháng 8/2026 bắt đầu thứ bảy, kết thúc thứ hai = 6 hàng
  assert.equal(d.monthWeeks(new Date('2027-02-10T05:00:00Z')).length, 4); assert.equal(d.monthWeeks(new Date('2026-08-10T05:00:00Z')).length, 6);
  assert.equal(d.dayKey(d.shiftMonth(new Date('2026-12-20T05:00:00Z'), 1)), '2027-01-01'); assert.equal(d.dayKey(d.shiftMonth(new Date('2026-01-05T05:00:00Z'), -1)), '2025-12-01');
  // Khóa ngày theo giờ VN: 17:30Z ngày 27 đã là 00:30 ngày 28
  assert.equal(d.dayKey(new Date('2026-10-27T17:30:00Z')), '2026-10-28');
  assert.equal(d.isSameMonth(new Date('2026-10-31T16:59:00Z'), new Date('2026-10-01T00:00:00Z')), true);
  assert.equal(d.isSameMonth(new Date('2026-10-31T17:00:00Z'), new Date('2026-10-15T00:00:00Z')), false); // 00:00 VN ngày 1/11
});

test('shared calendar: period, navigation, titles, full weekday names and day grouping', () => {
  const app = loadApp('http://localhost/api/v1'); const c = app.load('lib/calendar'); const dt = app.load('lib/date');
  const tue = new Date('2026-10-27T05:00:00Z'); const now = tue; const key = dt.dayKey;
  const week = c.calendarPeriod('week', tue);
  assert.deepEqual([week.weeks.length, key(week.start), key(week.end)], [1, '2026-10-26', '2026-11-01']);
  const month = c.calendarPeriod('month', tue);
  assert.deepEqual([month.weeks.length, key(month.start), key(month.end)], [5, '2026-10-01', '2026-10-31']);
  assert.equal(c.inPeriod(month, new Date('2026-10-31T10:00:00Z')), true); assert.equal(c.inPeriod(month, new Date('2026-09-30T10:00:00Z')), false);
  // Tuần: ±7 ngày, ngày chọn đi theo. Tháng: ±1 tháng; về tháng hiện tại thì chọn hôm nay, tháng khác thì chọn mùng 1
  const cursor = { anchor: tue, selected: tue };
  const nextWeek = c.shiftCursor('week', cursor, 1, now); assert.deepEqual([key(nextWeek.anchor), key(nextWeek.selected)], ['2026-11-03', '2026-11-03']);
  const nextMonth = c.shiftCursor('month', cursor, 1, now); assert.deepEqual([key(nextMonth.anchor), key(nextMonth.selected)], ['2026-11-01', '2026-11-01']);
  const back = c.shiftCursor('month', nextMonth, -1, now); assert.deepEqual([key(back.anchor), key(back.selected)], ['2026-10-01', '2026-10-27']);
  // Tháng → Tuần hiện tuần chứa ngày đang chọn; Tuần → Tháng giữ nguyên
  const picked = c.switchCursor('week', { anchor: dt.shiftMonth(tue, 1), selected: new Date('2026-11-12T05:00:00Z') }); assert.equal(key(picked.anchor), '2026-11-12');
  assert.equal(c.switchCursor('month', cursor), cursor);
  assert.equal(c.isCurrentPeriod('week', new Date('2026-10-26T05:00:00Z'), now), true); assert.equal(c.isCurrentPeriod('week', new Date('2026-11-02T05:00:00Z'), now), false);
  assert.equal(c.isCurrentPeriod('month', new Date('2026-10-01T05:00:00Z'), now), true); assert.equal(c.isCurrentPeriod('month', new Date('2026-11-05T05:00:00Z'), now), false);
  assert.equal(c.periodTitle('week', tue), '26/10 – 01/11/2026'); assert.equal(c.periodTitle('month', tue), 'Tháng 10/2026');
  // Thứ viết đủ chữ (không "T2"), tính theo giờ VN
  assert.equal(c.weekdayLong(new Date('2026-10-26T05:00:00Z')), 'Thứ hai'); assert.equal(c.weekdayLong(new Date('2026-11-01T05:00:00Z')), 'Chủ nhật');
  assert.equal(c.weekdayLong(new Date('2026-10-25T17:30:00Z')), 'Thứ hai'); assert.equal(c.dayHeading(new Date('2026-10-26T05:00:00Z')), 'Thứ hai, 26/10/2026');
  // Gom theo ngày VN, trong ngày xếp theo giờ
  const groups = c.groupByDay([{ id: 'b', startTime: '2026-10-27T11:00:00Z' }, { id: 'a', startTime: '2026-10-27T01:00:00Z' }, { id: 'c', startTime: '2026-10-27T17:30:00Z' }], (i) => i.startTime);
  assert.deepEqual(groups.get('2026-10-27').map((i) => i.id), ['a', 'b']); assert.deepEqual(groups.get('2026-10-28').map((i) => i.id), ['c']); assert.equal(groups.size, 2);
});

test('member calendar: booked and completed sessions only, past ones labelled, cancel only for upcoming booked', () => {
  const m = loadApp('http://localhost/api/v1').load('lib/memberSchedule'); const now = Date.parse('2026-10-27T05:00:00Z');
  const enroll = (id, status, start, end) => ({ id, scheduleId: 's' + id, status, memberId: 'm', bookedAt: '', createdAt: '', schedule: start ? { id: 's' + id, classId: 'c', roomId: 'r', startTime: start, endTime: end, status: 'SCHEDULED' } : undefined });
  const upcoming = enroll('1', 'BOOKED', '2026-10-28T01:00:00Z', '2026-10-28T02:00:00Z'); const cancelled = enroll('2', 'CANCELLED', '2026-10-29T01:00:00Z', '2026-10-29T02:00:00Z');
  const done = enroll('3', 'COMPLETED', '2026-10-20T01:00:00Z', '2026-10-20T02:00:00Z'); const noSchedule = enroll('4', 'BOOKED'); const past = enroll('5', 'BOOKED', '2026-10-26T01:00:00Z', '2026-10-26T02:00:00Z');
  assert.deepEqual(m.memberCalendarEvents([upcoming, cancelled, done, noSchedule, past]).map((e) => [e.id, e.startTime]), [['1', upcoming.schedule.startTime], ['3', done.schedule.startTime], ['5', past.schedule.startTime]]);
  assert.equal(m.memberSessionBadge(upcoming, now).label, 'Đã đặt'); assert.equal(m.memberSessionBadge(past, now).label, 'Đã diễn ra'); assert.equal(m.memberSessionBadge(done, now).label, 'Hoàn thành');
  assert.deepEqual([m.canCancelSession(upcoming, now), m.canCancelSession(past, now), m.canCancelSession(done, now)], [true, false, false]);
});

test('Member and Coach schedules share one calendar frame (no per-role calendar markup)', () => {
  const read = (f) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
  for (const f of ['components/member/MemberScheduleView.tsx', 'components/coach/CoachScheduleView.tsx']) {
    const src = read(f);
    assert.match(src, /<ScheduleCalendar\b/, f + ' dùng khung lịch chung'); assert.match(src, /<ScheduleEventCard\b/, f + ' dùng thẻ buổi chung');
    assert.ok(!/WEEKDAY_LABELS|'T2'/.test(src), f + ' không tự dựng nhãn thứ riêng');
  }
  assert.match(read('hooks/coach/useCoachScheduleScreen.ts'), /useScheduleCalendar\(/);
  // Danh sách dưới lịch viết đủ thứ ("Thứ hai"), nhãn ngắn T2…CN chỉ ở đầu cột của lưới
  const agenda = read('components/schedule/DayAgenda.tsx'); assert.match(agenda, /weekdayLong/); assert.ok(!/WEEKDAY_SHORT/.test(agenda));
  assert.match(read('components/schedule/CalendarGrid.tsx'), /WEEKDAY_SHORT_FROM_MONDAY/);
  // Hội viên không còn chế độ "Danh sách" lặp với "Lớp của tôi"
  assert.ok(!/Danh sách/.test(read('components/member/MemberScheduleView.tsx')));
});

test('screen headers show the title only: no subtitle line under it', () => {
  const root = path.resolve(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  assert.ok(!/subtitle/.test(read('components/shared/ScreenHeader.tsx')), 'ScreenHeader không còn thuộc tính chữ phụ');
  assert.ok(!/subtitle/.test(read('components/shared/WorkflowScreen.tsx')), 'WorkflowScreen không còn chuyển chữ phụ vào header');
  // Không màn nào truyền chữ phụ cho header (ListRow.subtitle ở menu Tài khoản là dòng mô tả của một mục, không phải header)
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name) && /subtitle=/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(root, full));
    }
  };
  walk(path.join(root, 'app')); walk(path.join(root, 'components'));
  assert.deepEqual(offenders.map((p) => p.split(path.sep).join('/')), ['components/account/AccountHubView.tsx']);
  // Mã đơn từng nằm ở chữ phụ của header thanh toán → phải hiện trong thân màn chờ chuyển khoản (banner dặn giữ mã đơn)
  assert.match(read('components/member/payment/SepayCheckoutPanel.tsx'), /label="Mã đơn hàng" value=\{checkout\.orderCode\}/);
});
