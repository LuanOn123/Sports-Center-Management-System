const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the real TS services against an isolated HTTP fixture. Expo-only
// platform/storage bindings are replaced; Axios/interceptors are real.
function loadApp(baseURL, stubs = {}) {
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
      // Module native/Expo thay thế theo từng bài test: giá trị là hàm tạo (hàm có thể ném lỗi để giả lập "thiếu module")
      if (Object.hasOwn(stubs, name)) return stubs[name]();
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
  // Mỗi file .tsx và mỗi thư mục (tab chứa Stack bên trong, vd. account/) trong app/(tabs) là một tab phải được khai báo
  const files = fs.readdirSync(path.resolve(__dirname, '../app/(tabs)'), { withFileTypes: true }).filter((e) => e.name !== '_layout.tsx' && (e.isDirectory() || e.name.endsWith('.tsx'))).map((e) => e.name.replace('.tsx', '')).sort();
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

test('50% membership rule: a plan with at least half its duration left can enroll a term that outlasts the plan', () => {
  const app = loadApp('http://localhost/api/v1');
  const t = app.load('lib/termRegistration'); const c = app.load('constants/terms');
  const DAY = 86_400_000; const now = Date.parse('2026-11-10T05:00:00Z');
  const iso = (ms) => new Date(ms).toISOString();
  // Gói 180 ngày bắt đầu cách đây (180 - daysLeft) ngày; còn ≥ 90 ngày là đủ (ví dụ của yêu cầu)
  const plan = (daysLeft, over) => ({ tier: 'MEMBERSHIP', status: 'ACTIVE', startDate: iso(now - (180 - daysLeft) * DAY), endDate: iso(now + daysLeft * DAY), ...over });
  assert.equal(c.TERM_MEMBERSHIP_MIN_REMAINING_RATIO, 0.5);
  assert.equal(c.TERM_MEMBERSHIP_POLICY, 'HALF_REMAINING_TERM_V1');

  // Tỷ lệ tính theo mili-giây như BE: đúng 50% đạt, thiếu 1 ms thì không
  assert.equal(t.membershipRemainingRatio(plan(90), now), 0.5);
  assert.ok(t.membershipRemainingRatio({ ...plan(90), endDate: iso(now + 90 * DAY - 1) }, now) < 0.5);
  assert.ok(t.membershipRemainingRatio(plan(120), now) > 0.5);
  // Gói chưa bắt đầu / đã hết hạn / không còn hiệu lực / ngày sai → 0 (BE: remainingMembershipRatio)
  assert.equal(t.membershipRemainingRatio(plan(0), now), 0);
  assert.equal(t.membershipRemainingRatio({ ...plan(90), startDate: iso(now + DAY) }, now), 0);
  assert.equal(t.membershipRemainingRatio({ ...plan(90), status: 'CANCELLED' }, now), 0);
  assert.equal(t.membershipRemainingRatio({ ...plan(90), endDate: 'không phải ngày' }, now), 0);
  assert.equal(t.membershipRemainingRatio({ tier: 'MEMBERSHIP', startDate: iso(now), endDate: iso(now) }, now), 0);

  // Dòng giải thích ở thẻ gói đang dùng: phần trăm làm tròn xuống, không bao giờ báo đủ khi chưa đủ
  const enough = t.membershipHalfHint(plan(100), now);
  assert.deepEqual([enough.enough, enough.tone, enough.percent], [true, 'success', 55]);
  assert.match(enough.text, /^Còn 55% thời hạn gói — đủ điều kiện \(≥ 50%\) đăng ký trọn kỳ học/);
  const short = t.membershipHalfHint(plan(40), now);
  assert.deepEqual([short.enough, short.tone, short.percent], [false, 'warning', 22]);
  assert.match(short.text, /cần còn ít nhất 50% để đăng ký trọn kỳ học vượt hạn gói/);
  const edge = t.membershipHalfHint({ ...plan(90), endDate: iso(now + 90 * DAY - 1) }, now);
  assert.deepEqual([edge.enough, edge.percent], [false, 49]);
  assert.equal(t.membershipHalfHint(plan(150, { tier: 'FREE' }), now), null); // FREE không có thời hạn mua
  assert.equal(t.membershipHalfHint(null, now), null);

  // Banner khi BE xác nhận quyền học trọn kỳ: cùng lời với web, ngày theo giờ Việt Nam
  const coverage = { policy: 'HALF_REMAINING_TERM_V1', validUntil: '2027-01-15T16:59:59.000Z', qualifiedAt: iso(now), subscriptionEndDate: '2026-12-20T16:59:59.000Z' };
  const note = t.membershipCoverageNotice(coverage);
  assert.equal(note.title, 'Đủ điều kiện thời hạn cho trọn kỳ');
  assert.equal(note.message, 'Gói còn ít nhất 50% thời hạn tại thời điểm xét đăng ký. Quyền học áp dụng cho lớp trong kỳ này đến 15/01/2027, kể cả khi gói hết hạn ngày 20/12/2026. Ngày hết hạn gói không thay đổi.');
  assert.equal(t.membershipCoverageNotice(null), null);
  assert.equal(t.membershipCoverageNotice({ ...coverage, policy: 'OTHER_POLICY' }), null);

  // Giai đoạn đăng ký khớp web MemberTermBanner; hết hạn đăng ký là hết — gói còn bao nhiêu cũng không nới được
  const term = (over) => ({ name: 'Kỳ Thu 2026', status: 'IN_PROGRESS', endDate: iso(now + 60 * DAY), registrationStartDate: iso(now - 40 * DAY), registrationEndDate: iso(now - 5 * DAY), ...over });
  assert.equal(t.termPhase(term({ status: 'CLOSED' }), now), 'ended');
  assert.equal(t.termPhase(term({ status: 'PLANNING' }), now), 'planning');
  assert.equal(t.termPhase(term({ registrationStartDate: iso(now + DAY) }), now), 'upcoming');
  assert.equal(t.termPhase(term({ registrationEndDate: iso(now + 3 * DAY) }), now), 'open');
  assert.equal(t.termPhase(term(), now), 'closed');
  const open = t.termNotice(term({ registrationEndDate: iso(now + 3 * DAY) }), now);
  assert.match(open.message, /còn 3 ngày/); assert.equal(open.coversBlocker, false);
  const closed = t.termNotice(term(), now);
  assert.deepEqual([closed.phase, closed.tone, closed.coversBlocker], ['closed', 'warning', true]);
  assert.equal(closed.message, 'Đã hết hạn đăng ký ngày 05/11/2026.');
  assert.ok(!/50%|muộn/i.test(closed.message), 'quá hạn đăng ký không có ngoại lệ theo gói');

  // Chỉ mã theo giai đoạn kỳ học bị ẩn khi thẻ kỳ học đã nói đủ; lý do gói hết hạn trước khóa của BE luôn hiện nguyên văn
  for (const code of ['TERM_REGISTRATION_NOT_OPEN', 'TERM_REGISTRATION_NOT_STARTED', 'TERM_REGISTRATION_CLOSED', 'TERM_CLOSED']) assert.ok(c.TERM_STAGE_BLOCKER_CODES.includes(code), code);
  assert.ok(!c.TERM_STAGE_BLOCKER_CODES.includes('SUBSCRIPTION_ENDS_BEFORE_COURSE_END'));

  // Nút cố định dưới đáy: xem test "enrollment blockers" bên dưới (courseFooter thay cho courseFooterKind cũ dựa trên regex)
  assert.equal(app.load('lib/classPlan').courseFooterKind, undefined, 'không còn đoán lý do chặn bằng regex trên mã BE');
});

test('enrollment blockers: every real BE blocker leads somewhere, like the web (no dead "Chưa thể đăng ký" button)', () => {
  const app = loadApp('http://localhost/api/v1');
  const { blockerGuidance, courseFooter, enrollFailureBlockers, guidanceActions, isFreeQuotaBlocker } = app.load('lib/enrollmentBlockers');
  // Hình dạng thật BE trả (course-plan.registration.blockers và errors.details của 409 COURSE_ENROLLMENT_FAILED)
  const freeQuota = { code: 'CONCURRENT_CLASS_LIMIT_REACHED', message: 'Tài khoản Free chưa bao gồm quyền đăng ký lớp học.', details: { tier: 'FREE', limit: 0, used: 0, remaining: 0 } };
  const fullQuota = { code: 'CONCURRENT_CLASS_LIMIT_REACHED', message: 'Bạn đã đạt giới hạn 3 lớp học song song của gói MEMBERSHIP.', details: { tier: 'MEMBERSHIP', limit: 3, used: 3, remaining: 0 } };
  const premium = { code: 'PREMIUM_REQUIRED', message: 'Khóa học Premium yêu cầu gói tập hạng PREMIUM.' };
  const noPlan = { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'Bạn không có gói tập đang hoạt động.' };
  const endsEarly = { code: 'SUBSCRIPTION_ENDS_BEFORE_COURSE_END', message: 'Gói tập của bạn hết hạn trước buổi cuối của khóa.' };
  const penalty = { code: 'ATTENDANCE_PENALTY_ACTIVE', message: 'Bạn đang bị tạm khoá đặt chỗ lớp này.' };
  const full = { code: 'SESSION_FULL', message: 'Buổi 12:00 đã hết chỗ.', sessionId: 's1', roomName: 'Q1' };

  assert.equal(isFreeQuotaBlocker(freeQuota), true);
  assert.equal(isFreeQuotaBlocker(fullQuota), false);
  assert.equal(isFreeQuotaBlocker({ code: 'CONCURRENT_CLASS_LIMIT_REACHED', message: 'x' }, 'FREE'), true, 'thiếu details.tier thì dùng hạng trong quota (như web)');

  // Hướng dẫn giống blockerActions của web
  assert.deepEqual(blockerGuidance([freeQuota]), { membership: 'plans', heldClasses: false, contactManager: false });
  assert.deepEqual(blockerGuidance([premium, freeQuota]), { membership: 'plans', heldClasses: false, contactManager: false });
  assert.deepEqual(blockerGuidance([premium, fullQuota]), { membership: 'upgrade', heldClasses: true, contactManager: false });
  assert.deepEqual(blockerGuidance([fullQuota]), { membership: null, heldClasses: true, contactManager: false });
  assert.equal(blockerGuidance([noPlan]).membership, 'buy');
  assert.equal(blockerGuidance([endsEarly]).membership, 'renew');
  assert.equal(blockerGuidance([penalty]).contactManager, true);
  assert.deepEqual(blockerGuidance([full]), { membership: null, heldClasses: false, contactManager: false });
  assert.deepEqual(guidanceActions(blockerGuidance([premium, fullQuota])), ['upgrade', 'held']);
  assert.deepEqual(guidanceActions(blockerGuidance([full])), []);

  // Nút dưới đáy: đủ khóa > đăng ký > kỳ học không nhận đăng ký > gói > lớp đang giữ > chưa thể
  const none = blockerGuidance([]);
  const base = { isFullyRegistered: false, eligible: false, totalSessions: 12, termPhase: null, guidance: none };
  assert.deepEqual(courseFooter({ ...base, isFullyRegistered: true, eligible: true }), { kind: 'registered', title: 'Đã đăng ký đủ khóa', disabled: true });
  assert.deepEqual(courseFooter({ ...base, eligible: true }), { kind: 'enroll', title: 'Đăng ký trọn khóa · 12 buổi', disabled: false });
  assert.deepEqual(courseFooter({ ...base, eligible: true, termPhase: 'open' }).kind, 'enroll');
  assert.deepEqual(courseFooter({ ...base, termPhase: 'closed', guidance: blockerGuidance([freeQuota]) }), { kind: 'term', title: 'Đã hết hạn đăng ký', disabled: true });
  assert.equal(courseFooter({ ...base, termPhase: 'planning' }).title, 'Kỳ đang lập kế hoạch');
  assert.equal(courseFooter({ ...base, termPhase: 'upcoming' }).title, 'Chưa mở đăng ký');
  assert.deepEqual(courseFooter({ ...base, guidance: blockerGuidance([freeQuota]) }), { kind: 'membership', title: 'Xem các gói tập', disabled: false, action: 'plans' });
  assert.deepEqual(courseFooter({ ...base, guidance: blockerGuidance([premium, fullQuota]) }), { kind: 'membership', title: 'Nâng cấp gói', disabled: false, action: 'upgrade' });
  assert.deepEqual(courseFooter({ ...base, guidance: blockerGuidance([fullQuota]) }), { kind: 'held', title: 'Xem các lớp đang giữ', disabled: false, action: 'held' });
  assert.deepEqual(courseFooter({ ...base, guidance: blockerGuidance([full]) }), { kind: 'blocked', title: 'Chưa thể đăng ký khóa này', disabled: true });
  assert.deepEqual(courseFooter({ ...base, guidance: blockerGuidance([penalty]) }).kind, 'blocked');

  // 409 COURSE_ENROLLMENT_FAILED: BE đặt blocker ở errors.details (errors là object) — code cũ đọc errors[0].details nên mất lý do
  const errors = { code: 'COURSE_ENROLLMENT_FAILED', classId: 'c1', totalSessions: 12, failedCount: 1, details: [freeQuota] };
  assert.deepEqual(enrollFailureBlockers(errors), [freeQuota]);
  assert.deepEqual(enrollFailureBlockers([{ field: 'classId', message: 'x' }]), [], 'lỗi theo trường không phải blocker');
  assert.deepEqual(enrollFailureBlockers(undefined), []);

  // Không còn đoán lý do bằng regex, không hứa hẹn ở chỗ khác, và lỗi 409 không bị nuốt bởi hộp thoại
  const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  assert.ok(!/MEMBERSHIP_BLOCKER|needsMembership/.test(read('hooks/shared/useClassDetail.ts')));
  assert.ok(!/\.errors as any\)\?\.\[0\]/.test(read('hooks/member/useEnrollments.ts')), 'errors của 409 là object, không phải mảng');
  assert.match(read('components/classes/ClassDetailView.tsx'), /<EnrollmentBlockers/);
});

test('class detail shows the BE membership coverage banner and never promises registration after the deadline', () => {
  const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  // Banner dựa trên registration.membershipCoverage do BE trả (không tự suy ra ở client)
  assert.match(read('hooks/shared/useClassDetail.ts'), /membershipCoverageNotice\(registration\?\.membershipCoverage\)/);
  assert.match(read('components/classes/ClassDetailView.tsx'), /d\.coverage && <MembershipCoverageNotice/);
  assert.match(read('components/member/membership/CurrentMembershipCard.tsx'), /membershipHalfHint\(activeSub\)/);
  // Web/BE không có "đăng ký muộn" sau hạn đăng ký kỳ học nên mobile không được hứa điều đó
  for (const file of ['components/classes/ClassDetailView.tsx', 'components/classes/TermNoticeCard.tsx', 'components/classes/MembershipCoverageNotice.tsx', 'constants/terms.ts', 'lib/termRegistration.ts', 'hooks/member/useEnrollments.ts', 'hooks/shared/useClassDetail.ts']) {
    assert.ok(!/đăng ký muộn/i.test(read(file)), `${file} không hứa đăng ký muộn`);
  }
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
  assert.ok(!/\bhref\s*:/.test(code), 'href: null (kể cả dạng điều kiện) làm tab ẩn không mở được, tự về Trang chủ');
  assert.ok(!/hidden:\s*true/.test(code));
  assert.match(code, /tabBarItemStyle:\s*\{\s*display:\s*'none'/); // ẩn bằng cách thu gọn khung nút tab
  // Tab không có nút trên thanh vẫn khai báo trong Tabs cho từng vai trò (Thông tin cá nhân và Thông báo không còn là tab ẩn:
  // chúng là màn con của Stack nên vuốt quay lại được — xem test "sub-screens are stack screens")
  const { getTabConfigForRole } = loadApp('http://localhost/api/v1').load('navigation/tabConfig');
  const hiddenTabs = { MEMBER: ['coach-attendance', 'enrollments'], COACH: ['classes', 'enrollments'] };
  for (const role of ['MEMBER', 'COACH']) {
    const config = getTabConfigForRole(role);
    assert.deepEqual(config.filter((t) => !t.visible).map((t) => t.name).sort(), hiddenTabs[role], `${role}: các tab ẩn`);
    assert.equal(config.filter((t) => t.visible).length, 5);
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
  // Đã quá hạn chỉ nêu "Đã đóng đăng ký" — gói còn bao nhiêu cũng không nới được hạn đăng ký của kỳ
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

test('member calendar: booked and completed sessions only, past ones labelled', () => {
  const m = loadApp('http://localhost/api/v1').load('lib/memberSchedule'); const now = Date.parse('2026-10-27T05:00:00Z');
  const enroll = (id, status, start, end) => ({ id, scheduleId: 's' + id, status, memberId: 'm', bookedAt: '', createdAt: '', schedule: start ? { id: 's' + id, classId: 'c', roomId: 'r', startTime: start, endTime: end, status: 'SCHEDULED' } : undefined });
  const upcoming = enroll('1', 'BOOKED', '2026-10-28T01:00:00Z', '2026-10-28T02:00:00Z'); const cancelled = enroll('2', 'CANCELLED', '2026-10-29T01:00:00Z', '2026-10-29T02:00:00Z');
  const done = enroll('3', 'COMPLETED', '2026-10-20T01:00:00Z', '2026-10-20T02:00:00Z'); const noSchedule = enroll('4', 'BOOKED'); const past = enroll('5', 'BOOKED', '2026-10-26T01:00:00Z', '2026-10-26T02:00:00Z');
  assert.deepEqual(m.memberCalendarEvents([upcoming, cancelled, done, noSchedule, past]).map((e) => [e.id, e.startTime]), [['1', upcoming.schedule.startTime], ['3', done.schedule.startTime], ['5', past.schedule.startTime]]);
  assert.equal(m.memberSessionBadge(upcoming, now).label, 'Đã đặt'); assert.equal(m.memberSessionBadge(past, now).label, 'Đã diễn ra'); assert.equal(m.memberSessionBadge(done, now).label, 'Hoàn thành');
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

const readSource = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('coach timetable asks the server for the effective coach once, so substitute sessions show and swapped-out ones do not', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('coach-token', 'refresh'); await api.setFacilityId('facility-a');
  const range = { startAfter: '2026-11-02T00:00:00+07:00', startBefore: '2026-11-08T23:59:59.999+07:00' };
  handle(() => ({ data: [{ id: 'late', classId: 'c2', startTime: '2026-11-04T08:00:00.000Z' }, { id: 'early', classId: 'c1', startTime: '2026-11-03T08:00:00.000Z' }], pagination: { page: 1, totalPages: 1 } }));
  const { getCoachSchedules } = load('services/coachService');
  assert.deepEqual((await getCoachSchedules('coach-profile-1', range)).map((s) => s.id), ['early', 'late']); // sắp theo giờ
  // Một lần gọi theo coachId (BE tự tính HLV dạy thay), không còn gọi từng lớp được phân công
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.equal(request.path, '/api/v1/class-schedules');
  assert.equal(request.query.get('coachId'), 'coach-profile-1');
  assert.equal(request.query.get('classId'), null);
  assert.equal(request.query.get('startAfter'), range.startAfter);
  assert.equal(request.query.get('startBefore'), range.startBefore);
  assert.equal(request.query.get('status'), null);
  await getCoachSchedules('coach-profile-1', { ...range, status: 'SCHEDULED' });
  assert.equal(requests[1].query.get('status'), 'SCHEDULED');

  // Bộ lọc lớp gồm lớp được phân công + lớp có buổi dạy thay, không trùng
  const { calendarClasses } = load('lib/coachSchedule');
  const names = calendarClasses([{ id: 'c1', name: 'Yoga' }], [{ class: { id: 'c1', name: 'Yoga (buổi)' } }, { class: { id: 'c9', name: 'Bơi (dạy thay)' } }, {}]).map((c) => c.name);
  assert.deepEqual(names, ['Yoga', 'Bơi (dạy thay)']);

  assert.ok(!/classIds|CLASS_BATCH_SIZE|isSuccess/.test(readSource('hooks/coach/useCoachSchedules.ts')), 'lịch dạy không phụ thuộc danh sách lớp được phân công');
  assert.ok(!/\?\?\s*user\??\.id/.test(readSource('app/(tabs)/schedule.tsx') + readSource('app/(tabs)/coach-attendance.tsx')), 'không dùng id tài khoản thay cho id hồ sơ HLV');
}));

test('pending (SCHEDULED) plan: cancellable with a 100% refund request, purchases blocked meanwhile, refund wording is a request', () => {
  const app = loadApp('http://localhost/api/v1'); const rules = app.load('lib/businessRules'); const c = app.load('constants/membership');
  const DAY = 86_400_000; const now = Date.parse('2026-11-02T00:00:00Z'); const iso = (ms) => new Date(ms).toISOString();
  const active = { status: 'ACTIVE', tier: 'MEMBERSHIP', endDate: iso(now + 40 * DAY), priceSnapshot: '300000', plan: { price: '300000' } };
  const scheduled = { status: 'SCHEDULED', tier: 'PREMIUM', endDate: iso(now + 200 * DAY), priceSnapshot: '1500000', plan: { price: '1500000' } };
  assert.deepEqual([rules.cancelKindOf(active), rules.cancelKindOf(scheduled), rules.cancelKindOf(null)], ['ACTIVE', 'SCHEDULED', 'ACTIVE']);
  // Gói đang dùng: 30% khi còn trên 15 ngày; gói chờ kích hoạt: hoàn 100% khoản gốc
  assert.deepEqual(rules.cancelRefundEstimate(active, now), { daysLeft: 40, refundAmount: 90000, willRefund: true });
  assert.deepEqual(rules.cancelRefundEstimate({ ...active, endDate: iso(now + 10 * DAY) }, now), { daysLeft: 10, refundAmount: 0, willRefund: false });
  assert.deepEqual(rules.cancelRefundEstimate(scheduled, now), { daysLeft: 0, refundAmount: 1500000, willRefund: true });
  assert.equal(rules.cancelRefundEstimate({ ...scheduled, priceSnapshot: undefined, plan: null }, now).willRefund, false);
  assert.equal(rules.canSelfCancelSubscription(scheduled), true);
  assert.equal(rules.canSelfCancelSubscription({ ...scheduled, tier: 'FREE' }), false);

  // Câu chữ khớp web: hoàn tiền là YÊU CẦU, chỉ thu hồi lượt đặt thuộc quyền của gói bị hủy
  const t = c.CANCEL_SUBSCRIPTION_TEXT;
  assert.equal(t.refundRequested('90.000 ₫'), 'Đã yêu cầu hoàn 90.000 ₫. Khoản tiền chỉ được ghi nhận đã hoàn sau khi quầy xác nhận biên nhận thực tế.');
  assert.equal(t.active.done, 'Đã hủy gói và thu hồi các lượt đặt lớp thuộc quyền của gói này.');
  assert.equal(t.scheduled.done, 'Đã hủy gói chờ. Gói đang sử dụng được giữ nguyên.');
  assert.match(t.active.policy(15, 30), /^Còn trên 15 ngày: hoàn 30% khoản thanh toán gốc\. Còn từ 15 ngày trở xuống: không hoàn tiền\.$/);
  assert.match(t.scheduled.policy, /^Gói chưa kích hoạt: yêu cầu hoàn 100% khoản thanh toán gốc\./);
  assert.equal(c.SCHEDULED_SUBSCRIPTION_TEXT.purchaseBlocked, 'Bạn đã có gói chờ kích hoạt. Hãy xử lý gói chờ trước khi mua hoặc gia hạn.');

  const modal = readSource('components/member/membership/CancelSubscriptionModal.tsx');
  assert.ok(!/liên hệ quầy để nhận tiền|các lượt đặt lớp tương lai đã được hủy|hủy toàn bộ lượt đặt lớp/.test(modal), 'không còn câu chữ cũ');
  const view = readSource('components/member/membership/MembershipPlansView.tsx');
  assert.match(view, /disabled=\{screen\.isCreatingCheckout \|\| screen\.purchaseBlocked\}/);
  assert.match(view, /<ScheduledMembershipCard subscription=\{scheduledSub\} onCancel=\{\(\) => cancel\.openModal\(scheduledSub\)\}/);
  assert.match(readSource('hooks/member/useMembershipScreen.ts'), /purchaseBlocked: Boolean\(membership\.scheduledSub\)/);
});

test('password reset OTP: resend only after 60 s, five wrong tries lock the code, only business 400s count as a wrong try', () => {
  const app = loadApp('http://localhost/api/v1'); const p = app.load('lib/passwordReset'); const c = app.load('constants/passwordReset'); const { ApiError } = app.load('lib/api');
  assert.deepEqual([c.OTP_TTL_MS, c.OTP_RESEND_COOLDOWN_MS, c.OTP_MAX_ATTEMPTS], [300000, 60000, 5]);
  const sent = 1_000_000;
  assert.deepEqual(p.otpStatus({ sentAt: null, failedAttempts: 0, now: sent }), { resendWaitMs: 0, validForMs: 0, attemptsLeft: 5, locked: false });
  assert.deepEqual(p.otpStatus({ sentAt: sent, failedAttempts: 0, now: sent + 15_000 }), { resendWaitMs: 45_000, validForMs: 285_000, attemptsLeft: 5, locked: false });
  assert.equal(p.otpStatus({ sentAt: sent, failedAttempts: 0, now: sent + 59_999 }).resendWaitMs, 1);
  assert.equal(p.otpStatus({ sentAt: sent, failedAttempts: 0, now: sent + 60_000 }).resendWaitMs, 0); // đúng 60 giây là gửi lại được
  assert.equal(p.otpStatus({ sentAt: sent, failedAttempts: 0, now: sent + 300_000 }).validForMs, 0);
  assert.equal(p.otpStatus({ sentAt: sent, failedAttempts: 0, now: sent - 5_000 }).resendWaitMs, 60_000); // đồng hồ lệch không làm ra số âm hoặc quá 60 giây
  const four = p.otpStatus({ sentAt: sent, failedAttempts: 4, now: sent }); const five = p.otpStatus({ sentAt: sent, failedAttempts: 5, now: sent });
  assert.deepEqual([four.attemptsLeft, four.locked, five.attemptsLeft, five.locked], [1, false, 0, true]);
  assert.equal(p.otpStatus({ sentAt: sent, failedAttempts: 9, now: sent }).attemptsLeft, 0);
  // Chỉ lỗi 400 nghiệp vụ (mã sai/hết hạn) tính là một lần thử; kiểm tra từng trường, 429 và lỗi khác thì không
  assert.equal(p.countsAsWrongOtp(new ApiError('OTP không hợp lệ hoặc đã hết hạn.', 400)), true);
  assert.equal(p.countsAsWrongOtp(new ApiError('Validation failed', 400, [{ field: 'newPassword', message: 'quá ngắn' }])), false);
  assert.equal(p.countsAsWrongOtp(new ApiError('Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.', 429)), false);
  assert.equal(p.countsAsWrongOtp(new Error('x')), false);

  // Màn hình dùng các quy tắc này, không còn tự đặt lại đồng hồ 5 phút mỗi lần gửi lại (route → View → hook)
  const screen = ['app/auth/forgot-password.tsx', 'components/auth/ForgotPasswordView.tsx', 'hooks/shared/useForgotPassword.ts'].map(readSource).join('\n');
  assert.match(screen, /useOtpStatus\(/); assert.match(screen, /otpInfo\.resendWaitMs > 0/); assert.ok(!/setExpiresAt|OTP_TTL_MS/.test(screen));
  assert.equal(c.PASSWORD_RESET_TEXT.validFor('04:32', 3), 'Mã có hiệu lực trong 04:32 · còn 3/5 lần nhập');
});

test('coach review form only opens after a session of this class already took place, like the web and BE R-06', () => {
  const app = loadApp('http://localhost/api/v1'); const rules = app.load('lib/businessRules');
  const now = Date.parse('2026-11-02T10:00:00Z'); const past = '2026-11-01T10:00:00Z'; const future = '2026-11-05T10:00:00Z';
  const enrollment = (over) => ({ status: 'BOOKED', classId: 'c1', schedule: { startTime: past, class: { id: 'c1', coaches: [{ coachId: 'coach-1' }] } }, ...over });
  const target = { coachId: 'coach-1', classId: 'c1' };
  assert.equal(rules.canReviewCoach([enrollment()], target, now), true);
  assert.equal(rules.canReviewCoach([enrollment({ status: 'COMPLETED' })], target, now), true);
  // Mới đặt buổi tương lai, đã hủy, hoặc thiếu giờ buổi → chưa được đánh giá
  assert.equal(rules.canReviewCoach([enrollment({ schedule: { startTime: future, class: { id: 'c1' } } })], target, now), false);
  assert.equal(rules.canReviewCoach([enrollment({ status: 'CANCELLED' })], target, now), false);
  assert.equal(rules.canReviewCoach([enrollment({ schedule: undefined })], target, now), false);
  assert.equal(rules.canReviewCoach([], target, now), false);
  // Đúng lớp này: học lớp khác của cùng HLV chưa đủ; đánh giá chung (không lớp) thì tính lớp nào có HLV đó
  const other = enrollment({ classId: 'c2', schedule: { startTime: past, class: { id: 'c2', coaches: [{ coachId: 'coach-1' }] } } });
  assert.equal(rules.canReviewCoach([other], target, now), false);
  assert.equal(rules.canReviewCoach([other], { coachId: 'coach-1' }, now), true);
  assert.equal(rules.canReviewCoach([other], { coachId: 'coach-9' }, now), false);
  // Khớp qua schedule.class.id khi enrollment không có classId
  assert.equal(rules.canReviewCoach([enrollment({ classId: undefined })], target, now), true);

  const text = app.load('constants/coachProfile').COACH_PROFILE_TEXT;
  assert.equal(text.reviewNotEligible, 'Bạn có thể viết đánh giá sau khi đã tham gia ít nhất một buổi của lớp này do huấn luyện viên dạy.');
  const rating = readSource('components/shared/CoachRating.tsx');
  assert.match(rating, /canReviewCoach\(enrollmentList\.data\?\.data \?\? \[\], \{ coachId, classId \}\)/);
  assert.match(rating, /COACH_PROFILE_TEXT\.reviewNotEligible/);
});

// ─── Đăng ký theo BE mới (số điện thoại bắt buộc), mục tiêu & tiến độ khóa học, thông báo ───────────────────────────

test('registration follows the new BE contract: phone is required, empty optional fields are omitted, the 12-80 age rule stays', () => {
  const app = loadApp('http://localhost/api/v1');
  const rules = app.load('lib/businessRules'); const reg = app.load('lib/memberRegistration');
  assert.equal(rules.vnPhoneError('', true), 'Vui lòng nhập số điện thoại.');
  assert.equal(rules.vnPhoneError(undefined, true), 'Vui lòng nhập số điện thoại.');
  assert.equal(rules.vnPhoneError('', false), null, 'hồ sơ cá nhân vẫn cho bỏ trống số điện thoại');
  assert.match(rules.vnPhoneError('09123', true), /bắt đầu bằng 0/);
  assert.equal(rules.vnPhoneError('0912345678', true), null);

  const base = { fullName: ' Nguyễn Văn A ', email: ' A@Mail.com ', password: '123456', confirmPassword: '123456', phone: '0912345678', gender: 'MALE', dateOfBirth: '', fitnessGoals: [], fitnessGoalNote: '' };
  const ok = reg.registerSchema.safeParse(base);
  assert.equal(ok.success, true);
  assert.deepEqual(reg.toRegisterPayload(ok.data), { email: 'A@Mail.com', password: '123456', fullName: 'Nguyễn Văn A', phone: '0912345678', gender: 'MALE' });

  const noPhone = reg.registerSchema.safeParse({ ...base, phone: '' });
  assert.equal(noPhone.success, false);
  assert.ok(noPhone.error.issues.some((i) => i.path[0] === 'phone' && i.message === 'Vui lòng nhập số điện thoại.'));
  assert.equal(reg.registerSchema.safeParse({ ...base, confirmPassword: 'khác' }).success, false);

  const full = reg.registerSchema.parse({ ...base, gender: undefined, dateOfBirth: '2000-05-20', fitnessGoals: ['Tăng cơ', 'Giảm cân'], fitnessGoalNote: 'đau gối nhẹ' });
  assert.deepEqual(reg.toRegisterPayload(full), { email: 'A@Mail.com', password: '123456', fullName: 'Nguyễn Văn A', phone: '0912345678', dateOfBirth: '2000-05-20', fitnessGoal: 'Tăng cơ, Giảm cân, đau gối nhẹ' });

  // Quy tắc tuổi 12–80 giữ ở mobile (BE chỉ chặn ngày tương lai và quá 120 năm)
  const now = new Date('2026-11-08T00:00:00Z');
  assert.ok(rules.memberBirthDateError('2020-01-01', now)); assert.ok(rules.memberBirthDateError('1940-01-01', now));
  assert.equal(rules.memberBirthDateError('2000-01-01', now), null); assert.equal(rules.memberBirthDateError('', now), null);

  const google = reg.googleRegisterSchema.safeParse({ phone: '0912345678', gender: 'FEMALE', dateOfBirth: '', fitnessGoals: [], fitnessGoalNote: '' });
  assert.equal(google.success, true);
  assert.deepEqual(reg.toGoogleRegisterPayload('id-token', google.data), { credential: 'id-token', phone: '0912345678', gender: 'FEMALE' });
  assert.equal(reg.googleRegisterSchema.safeParse({ ...google.data, phone: '' }).success, false);
});

test('BE validation errors show the first field message and the business code of a 404 stays readable', async () => fixture(async ({ load, handle }) => {
  const api = load('lib/api');
  handle(() => ({ status: 400, message: 'Validation failed', errors: [{ field: 'phone', message: 'Vui lòng nhập số điện thoại.' }] }));
  await assert.rejects(api.api.publicPost('/auth/register', {}), (e) => e.status === 400 && e.message === 'Vui lòng nhập số điện thoại.' && e.code === 'Validation failed');
  handle(() => ({ status: 400, message: 'Validation failed' }));
  await assert.rejects(api.api.publicPost('/auth/register', {}), (e) => /kiểm tra lại/.test(e.message));
  handle(() => ({ status: 404, message: 'Tài khoản Google này chưa được đăng ký trong hệ thống.', errors: { code: 'ACCOUNT_NOT_REGISTERED' } }));
  await assert.rejects(api.api.publicPost('/auth/google-login', { credential: 'x' }), (e) => e.status === 404 && api.businessCodeOf(e) === 'ACCOUNT_NOT_REGISTERED');
  // Danh sách lỗi theo trường (mảng) không phải mã nghiệp vụ
  handle(() => ({ status: 400, message: 'Validation failed', errors: [{ field: 'x', message: 'y' }] }));
  await assert.rejects(api.api.get('/x'), (e) => api.businessCodeOf(e) === undefined);
  assert.equal(api.businessCodeOf(new Error('khác')), undefined);
}));

test('goal target calls follow the BE routes and the whole-course body matches the web (goal, health notes, save to profile)', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh'); await api.setFacilityId('facility-a');
  handle((req) => (req.path.endsWith('/my-goal') ? { data: null } : { data: {} }));
  const goals = load('services/goalService'); const enroll = load('services/enrollmentService'); const opts = load('lib/enrollOptions');
  assert.equal((await goals.getMyClassGoal('class/a')).data, null);
  await goals.getScheduleEvaluations('session-a');
  await goals.saveScheduleEvaluation('session-a', { memberId: 'member-a', progress: 45, description: null });
  await enroll.enrollWholeCourse('class-a', opts.toEnrollOptions({ goal: '  Bơi 50m  ', healthNotes: '  đau gối ', saveToProfile: true }));
  await enroll.enrollWholeCourse('class-b', opts.toEnrollOptions({ goal: '   ', healthNotes: '   ', saveToProfile: false }));
  assert.deepEqual(requests.map((r) => [r.method, r.path, r.body]), [
    ['GET', '/api/v1/attendance/classes/class%2Fa/my-goal', undefined],
    ['GET', '/api/v1/attendance/schedules/session-a/evaluations', undefined],
    ['POST', '/api/v1/attendance/schedules/session-a/evaluations', { memberId: 'member-a', progress: 45, description: null }],
    ['POST', '/api/v1/enrollments/bulk', { classId: 'class-a', healthNotes: 'đau gối', saveToProfile: true, goal: 'Bơi 50m' }],
    ['POST', '/api/v1/enrollments/bulk', { classId: 'class-b', healthNotes: null, saveToProfile: false }],
  ]);
  assert.ok(requests.every((r) => r.headers['x-facility-id'] === 'facility-a'));
  // Mục tiêu cố định sau khi đăng ký (BE luôn từ chối sửa) → mobile không có hàm sửa mục tiêu
  assert.ok(!/patch/i.test(readSource('services/goalService.ts').replace(/^\s*\/\/.*$|\/\*\*[\s\S]*?\*\//gm, '')));
}));

test('Google sign-in sends only the ID token without session headers, and the register call carries the phone like the web', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('old-access', 'old-refresh'); await api.setFacilityId('old-facility');
  handle(() => ({ data: { accessToken: 'a', refreshToken: 'r' } }));
  const auth = load('services/authService');
  await auth.loginWithGoogleCredential('google-id-token');
  await auth.registerWithGoogleCredential({ credential: 'google-id-token', phone: '0912345678', gender: 'MALE' });
  assert.deepEqual(requests.map((r) => [r.method, r.path, r.body]), [
    ['POST', '/api/v1/auth/google-login', { credential: 'google-id-token' }],
    ['POST', '/api/v1/auth/google-register', { credential: 'google-id-token', phone: '0912345678', gender: 'MALE' }],
  ]);
  assert.ok(requests.every((r) => r.headers.authorization === undefined && r.headers['x-facility-id'] === undefined));
}));

test('goal progress levels, stepping and evaluation drafts follow the web (levels at 20 and 70, step 5)', () => {
  const app = loadApp('http://localhost/api/v1'); const g = app.load('lib/goalProgress'); const c = app.load('constants/goals');
  assert.deepEqual([0, 19, 20, 69, 70, 100].map((p) => g.progressLevel(p).key), ['low', 'low', 'mid', 'mid', 'high', 'high']);
  assert.deepEqual([-5, 120, Number.NaN, 42.6].map((p) => g.clampProgress(p)), [0, 100, 0, 43]);
  assert.deepEqual([[42, 1], [42, -1], [45, 1], [45, -1], [100, 1], [0, -1], [98, 1]].map(([p, d]) => g.stepProgress(p, d)), [45, 40, 50, 40, 100, 0, 100]);
  assert.equal(g.formatProgressDiff(15), '+15%'); assert.equal(g.formatProgressDiff(-5), '-5%'); assert.equal(g.formatProgressDiff(0), '0%');
  assert.equal(g.progressDiff(45, 60), 15);
  assert.equal(g.evaluationNoteOrNull('   '), null); assert.equal(g.evaluationNoteOrNull(' Giữ nhịp thở '), 'Giữ nhịp thở');
  // Chưa đánh giá buổi này: bắt đầu từ tiến độ hiện tại; đã đánh giá: lấy kết quả buổi đó và mốc trước của nó
  assert.deepEqual(g.evaluationDraft({ currentProgress: 30, evaluation: null }), { progress: 30, previousProgress: 30, note: '', results: '' });
  const done = { id: 'e', previousProgress: 40, newProgress: 60, description: 'Tốt', results: 'Squat 3 hiệp × 10 lần', createdAt: '', updatedAt: '' };
  assert.deepEqual(g.evaluationDraft({ currentProgress: 60, evaluation: done }), { progress: 60, previousProgress: 40, note: 'Tốt', results: 'Squat 3 hiệp × 10 lần' });
  assert.deepEqual(g.evaluationDraft(undefined), { progress: 0, previousProgress: 0, note: '', results: '' });
  // Giới hạn độ dài khớp BE (enrollments.schema, attendance.schema)
  assert.deepEqual([c.GOAL_MAX_LENGTH, c.EVALUATION_NOTE_MAX_LENGTH, c.HEALTH_NOTES_MAX_LENGTH, c.PROGRESS_STEP], [500, 1000, 1000, 5]);
});

test('coach roster search and health notes follow the web, whole-course results use the web wording', () => {
  const app = loadApp('http://localhost/api/v1'); const roster = app.load('lib/coachRoster'); const plan = app.load('lib/classPlan');
  const rows = [
    { id: 'e1', member: { user: { fullName: 'Nguyễn Văn An', email: 'an@mail.com' } }, healthNotes: ' Đau cổ chân ' },
    { id: 'e2', member: { user: { fullName: 'Lê Bình', email: 'binh@mail.com' }, healthNotes: 'Hen suyễn' } },
    { id: 'e3', member: { user: { fullName: 'Trần Cường' } } },
  ];
  assert.deepEqual(roster.filterRoster(rows, '  nguyễn ').map((r) => r.id), ['e1']);
  assert.deepEqual(roster.filterRoster(rows, 'BINH@').map((r) => r.id), ['e2']);
  assert.equal(roster.filterRoster(rows, '').length, 3); assert.equal(roster.filterRoster(rows, 'zzz').length, 0);
  assert.deepEqual(rows.map((r) => roster.rosterHealthNotes(r)), ['Đau cổ chân', 'Hen suyễn', '']);

  const result = (enrolledNow) => ({ className: 'Yoga', summary: { totalSessions: 8, enrolledNow, alreadyBooked: 8 - enrolledNow, totalRegistered: 8, firstSessionStart: '', lastSessionEnd: '' } });
  assert.equal(plan.wholeCourseEnrollmentMessage(result(6)), 'Bạn đã đăng ký 6 buổi của khóa "Yoga". Hiện đã có 8/8 buổi trong khóa của bạn.');
  assert.equal(plan.wholeCourseEnrollmentMessage(result(0)), 'Bạn đã đăng ký đủ 8 buổi của khóa này trước đó.');
  const slot = (weekdayLabel) => ({ weekdayLabel, startTime: '18:00', endTime: '19:30', roomName: 'Phòng A' });
  assert.deepEqual(
    plan.enrollSummaryOf({ name: 'Yoga', sports: [{ name: 'Yoga' }, { name: 'Pilates' }], coaches: [{ coach: { user: { fullName: 'HLV Lan' } } }] }, { totalSessions: 8, slots: [slot('Thứ 2'), slot('Thứ 4')] }),
    { name: 'Yoga', sport: 'Yoga · Pilates', sessions: 8, coach: 'HLV Lan', room: 'Phòng A', time: 'Thứ 2 18:00–19:30; Thứ 4 18:00–19:30' },
  );
});

test('notifications: goal progress opens the class, subscription notices open the plans, the learner route carries the session', () => {
  const app = loadApp('http://localhost/api/v1'); const route = app.load('navigation/notificationRoute').resolveNotificationRoute; const routes = app.load('navigation/routes').ROUTES;
  const note = (type, metadata) => ({ id: 'n', userId: 'u', type, title: '', body: '', isRead: false, createdAt: '', metadata });
  assert.deepEqual(route(note('GOAL_PROGRESS_UPDATED', { classId: 'class-1', scheduleId: 's1' })), routes.classDetail('class-1'));
  assert.equal(route(note('GOAL_PROGRESS_UPDATED', {})), null);
  for (const type of ['SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_CANCELLED']) assert.equal(route(note(type)), routes.membershipPlans);
  assert.deepEqual(routes.coachMember('m1', 's1'), { pathname: '/coach/member/[id]', params: { id: 'm1', scheduleId: 's1' } });
  assert.deepEqual(routes.coachMember('m1'), { pathname: '/coach/member/[id]', params: { id: 'm1' } });
  assert.match(readSource('constants/notifications.ts'), /GOAL_PROGRESS_UPDATED: 'trending-up'/); // biểu tượng của loại thông báo này
  assert.match(readSource('lib/types.ts'), /\| 'GOAL_PROGRESS_UPDATED'/);
});

test('coach learner screen only shows what BE gives a coach: no email/phone/preference from the trimmed profile, health notes from the roster', () => {
  const view = readSource('components/coach/LearnerProfileView.tsx'); const hook = readSource('hooks/coach/useLearnerProfile.ts'); const route = readSource('app/coach/member/[id].tsx');
  assert.ok(!/trainingPreference/.test(view + hook + route), 'BE không trả sở thích tập cho HLV');
  assert.ok(!/learner\??\.user\??\.(email|phone)/.test(view), 'email/điện thoại lấy từ danh sách học viên của buổi, không phải hồ sơ rút gọn');
  assert.match(hook, /rosterHealthNotes|enrollment\?\.healthNotes/); assert.match(hook, /\['schedule-enrollments', scheduleId\]/);
  assert.match(route, /LearnerProfileView/); assert.ok(!/useQuery|apiRequest/.test(route), 'route chỉ render một View');
  const attendance = readSource('components/coach/CoachRosterView.tsx');
  assert.match(attendance, /ROUTES\.coachMember\(item\.memberId, selected\.id\)/); assert.match(attendance, /EvaluationSheet/);
});

// ─── Google sign-in: không bao giờ làm sập app khi thiếu module native (Expo Go, bản cài cũ, web) ──────────────────────

const WEB_CLIENT = '1111-web.apps.googleusercontent.com';
const IOS_CLIENT = '2222-ios.apps.googleusercontent.com';

// Nạp lib/googleSignIn với môi trường giả lập: ExecutionEnvironment của Expo, biến môi trường, registry module native của React Native
// và thư viện Google. `registered`: bản đang chạy đã gắn module native RNGoogleSignin (mặc định: có khi test đưa module giả vào).
// `loads.count` đếm số lần thư viện Google bị nạp: khi module native chưa gắn, require() của thư viện KHÔNG ném lỗi cho try/catch —
// Metro (guardedLoadModule) báo thẳng là lỗi nghiêm trọng (màn đỏ "Uncaught Error" khi đăng xuất trong Expo Go) — nên không được nạp.
function loadGoogle({ environment = 'standalone', webClientId = WEB_CLIENT, iosClientId = '', native, registered = native !== undefined, loads = { count: 0 } } = {}) {
  const saved = { web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID };
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = webClientId; process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = iosClientId;
  try {
    const stubs = {
      'expo-constants': () => ({ __esModule: true, default: { executionEnvironment: environment }, ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' } }),
      'react-native': () => ({
        Platform: { OS: 'web', select: (values) => values.web || values.default },
        TurboModuleRegistry: { get: (name) => (registered && name === 'RNGoogleSignin' ? {} : null) },
      }),
      '@react-native-google-signin/google-signin': () => {
        loads.count += 1;
        if (!native) throw new Error("TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found");
        return native();
      },
    };
    return loadApp('http://localhost/api/v1', stubs).load('lib/googleSignIn');
  } finally {
    for (const [key, name] of [['web', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'], ['ios', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID']]) {
      if (saved[key] === undefined) delete process.env[name]; else process.env[name] = saved[key];
    }
  }
}

function fakeGoogleModule(overrides = {}) {
  const calls = { configure: [], signOut: 0, order: [] };
  const codes = { SIGN_IN_CANCELLED: 'CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'NO_PLAY' };
  const module = () => ({
    GoogleSignin: {
      configure: (options) => calls.configure.push(options),
      hasPlayServices: async () => true,
      signIn: async () => { calls.order.push('signIn'); return overrides.response ?? { type: 'success', data: { idToken: 'google-id-token', user: { email: 'an@gmail.com', name: 'Nguyễn An', photo: null } } }; },
      signOut: async () => { calls.signOut += 1; calls.order.push('signOut'); if (overrides.signOutError) throw overrides.signOutError; },
    },
    statusCodes: codes,
    isErrorWithCode: (error) => typeof error === 'object' && error !== null && 'code' in error,
  });
  return { module, calls, codes };
}

test('Google sign-in explains why it is unavailable instead of crashing: Expo Go, missing config, missing native module, web', async () => {
  // Expo Go không có module native → lý do 'expo-go'. Không hàm nào được nạp thư viện Google, kể cả đăng xuất:
  // đăng xuất trong Expo Go từng báo "Uncaught Error: 'RNGoogleSignin' could not be found" vì require() thư viện bị Metro coi là lỗi nghiêm trọng
  const expoGo = { count: 0 };
  const inExpoGo = loadGoogle({ environment: 'storeClient', loads: expoGo });
  assert.equal(inExpoGo.googleSignInUnavailableReason(), 'expo-go');
  await assert.rejects(inExpoGo.signInWithGoogle(), /Expo Go/);
  await assert.doesNotReject(inExpoGo.signOutOfGoogle());
  assert.match(inExpoGo.googleErrorMessage(new Error('Lỗi khác')), /Lỗi khác/);
  assert.equal(expoGo.count, 0, 'Expo Go: không được nạp thư viện Google');
  // Thiếu Web client ID → chưa cấu hình
  assert.equal(loadGoogle({ webClientId: '' }).googleSignInUnavailableReason(), 'not-configured');
  // Development build cũ chưa gắn module native Google: registry không có RNGoogleSignin → báo cần build lại và không nạp thư viện
  const oldBuild = { count: 0 };
  const withoutNative = loadGoogle({ loads: oldBuild });
  assert.equal(withoutNative.googleSignInUnavailableReason(), 'native-module-missing');
  await assert.rejects(withoutNative.signInWithGoogle(), /build lại/);
  await assert.doesNotReject(withoutNative.signOutOfGoogle());
  assert.equal(oldBuild.count, 0, 'thiếu module native: không được nạp thư viện Google');
  // Đã gắn module native → dùng được (registry được hỏi đúng tên RNGoogleSignin)
  assert.equal(loadGoogle({ native: fakeGoogleModule().module }).googleSignInUnavailableReason(), null);
  // Mọi thông điệp đều có tiếng Việt và nêu hướng xử lý
  const text = loadApp('http://localhost/api/v1').load('constants/auth').GOOGLE_TEXT;
  assert.deepEqual(Object.keys(text.unavailable).sort(), ['expo-go', 'native-module-missing', 'not-configured', 'web']);
  assert.ok(Object.values(text.unavailable).every((message) => /email và mật khẩu|build lại/.test(message)));
  // Bản web dùng tệp riêng, không bao giờ import thư viện native
  const web = readSource('lib/googleSignIn.web.ts');
  assert.ok(!/google-signin/.test(web.replace(/^\s*\/\/.*$/gm, '')), 'bản web không nạp thư viện Google');
  assert.match(web, /return 'web'/);
  // Thư viện chỉ được nạp bằng require lười trong hàm, không import ở đầu tệp
  assert.ok(!/^import .*google-signin/m.test(readSource('lib/googleSignIn.ts')));
});

test('Google sign-in returns the ID token, configures the Web client ID, and maps library errors to Vietnamese', async () => {
  const fake = fakeGoogleModule();
  const google = loadGoogle({ native: fake.module, iosClientId: IOS_CLIENT });
  const result = await google.signInWithGoogle();
  assert.deepEqual(result, { status: 'success', idToken: 'google-id-token', email: 'an@gmail.com', name: 'Nguyễn An', photo: null });
  assert.deepEqual(fake.calls.configure, [{ webClientId: WEB_CLIENT, iosClientId: IOS_CLIENT }]);
  await google.signInWithGoogle();
  assert.equal(fake.calls.configure.length, 1, 'chỉ cấu hình một lần');
  // Mỗi lần bấm Google đều quên tài khoản cũ trước khi mở bảng chọn: tài khoản bị từ chối (vd. Quản lý) không bị nhớ lại
  assert.deepEqual(fake.calls.order, ['signOut', 'signIn', 'signOut', 'signIn']);
  await google.signOutOfGoogle(); assert.equal(fake.calls.signOut, 3);
  // Chưa từng đăng nhập Google (signOut ném lỗi) vẫn mở được bảng chọn
  const fresh = fakeGoogleModule({ signOutError: { code: 'SIGN_IN_REQUIRED' } });
  assert.equal((await loadGoogle({ native: fresh.module }).signInWithGoogle()).status, 'success');

  // Không có iOS client ID thì không gửi iosClientId (Android)
  const android = fakeGoogleModule(); await loadGoogle({ native: android.module }).signInWithGoogle();
  assert.deepEqual(android.calls.configure, [{ webClientId: WEB_CLIENT }]);

  // Người dùng đóng bảng chọn tài khoản → cancelled; ID token null (Web client ID sai loại) → báo cấu hình
  const cancelled = fakeGoogleModule({ response: { type: 'cancelled', data: null } });
  assert.deepEqual(await loadGoogle({ native: cancelled.module }).signInWithGoogle(), { status: 'cancelled' });
  const noToken = fakeGoogleModule({ response: { type: 'success', data: { idToken: null, user: { email: 'x@y.z', name: null, photo: null } } } });
  await assert.rejects(loadGoogle({ native: noToken.module }).signInWithGoogle(), /Web client ID/);
  // Thiếu cấu hình/Expo Go: ném lỗi tiếng Việt thay vì gọi thư viện
  await assert.rejects(loadGoogle({ environment: 'storeClient' }).signInWithGoogle(), /Expo Go/);
  await assert.doesNotReject(loadGoogle().signOutOfGoogle());

  const errors = loadGoogle({ native: fakeGoogleModule().module });
  assert.equal(errors.googleErrorMessage({ code: 'CANCELLED' }), null);
  assert.equal(errors.googleErrorMessage({ code: 'IN_PROGRESS' }), null);
  assert.match(errors.googleErrorMessage({ code: 'NO_PLAY' }), /Google Play Services/);
  assert.match(errors.googleErrorMessage(new Error('Lỗi khác')), /Lỗi khác/);
  assert.match(errors.googleErrorMessage('???'), /Không đăng nhập được bằng Google/);
});

test('Google registration holds the account in memory only, and the iOS URL scheme comes from the iOS client ID', () => {
  const app = loadApp('http://localhost/api/v1'); const held = app.load('lib/googleRegistration');
  assert.equal(held.peekGoogleAccount(), null);
  const account = { idToken: 'tok', email: 'an@gmail.com', name: null, photo: null };
  held.holdGoogleAccount(account); assert.deepEqual(held.peekGoogleAccount(), account);
  held.clearGoogleAccount(); assert.equal(held.peekGoogleAccount(), null);
  assert.ok(!/AsyncStorage|SecureStore|storage/.test(readSource('lib/googleRegistration.ts').replace(/^\s*\/\/.*$/gm, '')), 'ID token không ghi ra máy');
  assert.ok(!/idToken|credential/i.test(readSource('navigation/routes.ts')), 'ID token không đi qua tham số URL');

  const config = require('../app.config.js');
  assert.equal(config.iosUrlSchemeOf('2222-ios.apps.googleusercontent.com'), 'com.googleusercontent.apps.2222-ios');
  assert.equal(config.iosUrlSchemeOf(''), ''); assert.equal(config.iosUrlSchemeOf('khong-dung-dang'), '');
  // Không có iOS client ID thì không thêm plugin (plugin dạng không tùy chọn đòi tệp Firebase và làm hỏng build)
  const base = { name: 'Pulse', plugins: ['expo-router'] };
  const saved = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  try {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    assert.deepEqual(config({ config: base }).plugins, ['expo-router']);
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = IOS_CLIENT;
    assert.deepEqual(config({ config: base }).plugins, ['expo-router', ['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.2222-ios' }]]);
  } finally { if (saved === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID; else process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = saved; }
  const appJson = JSON.parse(readSource('app.json')); assert.ok(!JSON.stringify(appJson.expo.plugins).includes('google-signin'), 'plugin Google chỉ thêm qua app.config.js');
});

test('login and register screens keep routes thin and put the Google button under the main button like the web', () => {
  for (const route of ['app/auth/login.tsx', 'app/auth/register.tsx', 'app/auth/google-register.tsx']) {
    const source = readSource(route);
    assert.ok(source.split('\n').length < 15, `${route} chỉ render một View`); assert.ok(!/useForm|useState|useQuery|api\./.test(source), `${route} không chứa logic`);
  }
  const login = readSource('components/auth/LoginForm.tsx'); const register = readSource('components/auth/RegisterForm.tsx');
  assert.ok(login.indexOf('TEXT.submit}</Text>') < login.indexOf('<GoogleSignInSection mode="login"'), 'nút Google nằm dưới nút Đăng nhập');
  assert.ok(login.indexOf('<GoogleSignInSection mode="login"') < login.indexOf('TEXT.registerNow'), 'liên kết đăng ký nằm dưới nút Google');
  assert.ok(register.indexOf('TEXT.submit}</Text>') < register.indexOf('<GoogleSignInSection mode="register"'), 'nút Google nằm dưới nút Đăng ký');
  const section = readSource('hooks/shared/useGoogleAuth.ts');
  assert.match(section, /businessCodeOf\(e\) !== ACCOUNT_NOT_REGISTERED_CODE/); assert.match(section, /ROUTES\.googleRegister/);
  assert.match(readSource('context/AuthContext.tsx'), /signOutOfGoogle\(\)/);
});

// ─── Chính sách sử dụng, đánh giá trong chi tiết buổi, luồng đăng ký lớp theo web ────────────────────────────────

test('policies screen is reachable for both roles from the account menu and keeps the web rules', () => {
  const app = loadApp('http://localhost/api/v1'); const menus = app.load('navigation/accountMenuConfig');
  for (const role of ['MEMBER', 'COACH']) {
    const routes = menus.getAccountMenuForRole(role).flatMap((group) => group.items).map((item) => item.route);
    assert.equal(routes.filter((route) => route === '/policies').length, 1, `${role}: đúng một lối vào Chính sách sử dụng`);
  }
  const policies = app.load('constants/policies');
  assert.deepEqual(policies.POLICY_SECTIONS.map((section) => section.title), [
    'Gói hội viên & đăng ký lớp', 'Lịch học & điểm danh', 'Chuyên cần', 'Thanh toán & quyền lợi', 'Tài khoản & thông tin cá nhân',
  ]);
  const text = JSON.stringify(policies.POLICY_SECTIONS);
  assert.match(text, /hoàn 30% khoản gốc khi còn trên 15 ngày/); assert.match(text, /vắng tối đa 20% tổng số buổi/); assert.match(text, /ít nhất 50% tổng thời hạn/);
  assert.ok(policies.POLICY_SECTIONS.every((section) => section.paragraphs.length > 0));
  const route = readSource('app/policies.tsx'); assert.match(route, /PoliciesView/); assert.ok(!/useState|useQuery|api\./.test(route));
  assert.equal(app.load('navigation/routes').canAccessRoute('COACH', ['policies']), true);
  assert.equal(app.load('navigation/routes').canAccessRoute('MEMBER', ['policies']), true);
});

test('member session detail shows the coach evaluation of that exact session, also once the session is completed', () => {
  const actions = readSource('components/member/MemberScheduleActions.tsx');
  assert.equal((actions.match(/<SessionEvaluationCard/g) || []).length, 2, 'buổi đã hoàn thành và buổi còn lên lịch đều có thẻ đánh giá');
  assert.ok(actions.indexOf("s.status === 'CANCELLED'") < actions.indexOf('<SessionEvaluationCard'), 'buổi đã hủy không hiện đánh giá');
  const card = readSource('components/member/SessionEvaluationCard.tsx');
  assert.match(card, /evaluation\.scheduleId === scheduleId/); assert.match(card, /useMyClassGoal\(classId\)/); assert.match(card, /if \(!entry\) return null/);
});

test('class detail follows the web enroll flow: confirm sheet with goal and health notes, goal card right after the class info', () => {
  const view = readSource('components/classes/ClassDetailView.tsx'); const hook = readSource('hooks/member/useEnrollments.ts');
  assert.match(view, /onPress=\{d\.enrollSheet\.open\}/); assert.ok(!/handleEnrollWholeCourse/.test(view + hook), 'không còn hộp xác nhận Có/Không cũ');
  const card = view.indexOf('<ClassGoalCard');
  assert.ok(card > view.indexOf('{/* 1. Thông tin lớp */}') && card < view.indexOf('{/* 2. Lịch học & địa điểm (hội viên) */}'), 'thẻ tiến độ nằm ngay sau thẻ thông tin lớp như web');
  assert.match(hook, /'my-class-goal'/, 'đăng ký xong thì làm mới thẻ tiến độ');
  const sheet = readSource('components/member/EnrollConfirmSheet.tsx');
  for (const part of ['TEXT.goalLabel', 'TEXT.healthLabel', 'TEXT.saveToProfile', 'TEXT.initialProgressValue']) assert.ok(sheet.includes(part), part);
  const text = loadApp('http://localhost/api/v1').load('constants/goals').GOAL_TEXT;
  assert.equal(text.enrollTitle, 'Xác nhận đăng ký & Lưu ý thể trạng'); assert.equal(text.enrollConfirm, 'Xác nhận đăng ký trọn khóa');
  assert.equal(text.goalLabel, 'Mục tiêu của bạn trong khóa học này'); assert.equal(text.initialProgressValue, '0% (Bắt đầu)');
  assert.equal(text.healthLabel, 'Bạn có chấn thương hoặc vấn đề sức khỏe cần HLV lưu ý không?');
  assert.equal(text.saveToProfile, 'Lưu thông tin này vào hồ sơ sức khỏe cá nhân của tôi');
  // Mục tiêu và lưu ý sức khỏe được điền sẵn từ hồ sơ như web
  const detail = readSource('hooks/shared/useClassDetail.ts');
  assert.match(detail, /user\?\.memberProfile\?\.fitnessGoal/); assert.match(detail, /user\?\.memberProfile\?\.healthNotes/);
});

test('members follow the web: no self-service cancel or session transfer, My Classes only offers "Xem lớp" plus the reception note', () => {
  const myClasses = readSource('components/member/enrollments/MyClassesView.tsx'); const schedule = readSource('components/member/MemberScheduleView.tsx');
  const enrollHooks = readSource('hooks/member/useEnrollments.ts'); const enrollService = readSource('services/enrollmentService.ts');
  assert.ok(!/Hủy đặt chỗ|Đổi buổi|useCancelEnrollment|useTransferEnrollment|transfer-schedules/.test(myClasses + schedule), 'không còn nút hủy / đổi buổi');
  assert.ok(!/cancelEnrollment|transferEnrollment|enrollSchedule|useBookSchedule|showConfirm/.test(enrollHooks + enrollService), 'không còn hàm hủy / đổi / đặt lẻ buổi');
  assert.ok(!/canCancelSession|Hủy buổi học/.test(schedule + readSource('lib/memberSchedule.ts')), 'lịch chỉ để xem');
  const text = loadApp('http://localhost/api/v1').load('constants/classes').MY_CLASSES_TEXT;
  assert.equal(text.viewClass, 'Xem lớp'); assert.equal(text.supportNote, 'Nếu cần hỗ trợ về lịch học, vui lòng liên hệ lễ tân cơ sở.');
  assert.match(myClasses, /MY_CLASSES_TEXT\.viewClass/); assert.match(myClasses, /ROUTES\.classDetail\(classId\)/);
  assert.match(myClasses, /ListFooterComponent=\{activeTab === 'upcoming' \? <SupportNote \/> : undefined\}/, 'dòng liên hệ lễ tân chỉ dưới tab Sắp tới như web');
  // Chính sách cũng nói như web: không xin nghỉ / đổi buổi / hủy đặt chỗ trên giao diện hội viên
  assert.match(JSON.stringify(loadApp('http://localhost/api/v1').load('constants/policies').POLICY_SECTIONS), /Giao diện hội viên không cung cấp xin nghỉ, đổi buổi hoặc hủy đặt chỗ/);
  // Rời danh sách chờ vẫn còn (web: Waitlist)
  assert.match(readSource('services/workflowService.ts'), /leaveWaitlist/);
});

// ─── Trợ lý AI: chat, Markdown, bong bóng nổi ────────────────────────────────────

test('AI chat: reasoning blocks never reach the user, drafts are validated, the history holds answered turns inside the window', () => {
  const app = loadApp('http://localhost/api/v1'); const chat = app.load('lib/aiChat'); const text = app.load('constants/assistant');
  assert.equal(chat.stripThinking('<think>\nNgười dùng hỏi gói tập.\n</think>\n\nDạ, có **2 gói**.'), 'Dạ, có **2 gói**.');
  assert.equal(chat.stripThinking('Suy nghĩ dở\n</think>\nTrả lời'), 'Trả lời');
  assert.equal(chat.stripThinking('Trả lời<think>bị cắt giữa chừng'), 'Trả lời');
  assert.equal(chat.stripThinking('<think>chỉ có suy nghĩ</think>'), '');
  assert.equal(chat.normalizeReply(undefined), ''); assert.equal(chat.normalizeReply('  Xin chào  '), 'Xin chào');

  assert.deepEqual(chat.checkDraft('   '), { ok: false, reason: 'empty' });
  assert.deepEqual(chat.checkDraft('  Chào  '), { ok: true, text: 'Chào' });
  assert.deepEqual(chat.checkDraft('a'.repeat(text.ASSISTANT_MAX_MESSAGE_LENGTH + 1)), { ok: false, reason: 'too-long' });
  assert.equal(chat.checkDraft('a'.repeat(text.ASSISTANT_MAX_MESSAGE_LENGTH)).ok, true);
  assert.equal(chat.counterLabel(100), null); assert.equal(chat.counterLabel(900), '900/1000');

  const turn = (i) => [{ id: `u${i}`, role: 'user', content: `hỏi ${i}`, status: 'sent' }, { id: `a${i}`, role: 'assistant', content: `đáp ${i}` }];
  const many = Array.from({ length: 15 }, (_, i) => turn(i)).flat();
  const history = chat.buildHistory(many);
  assert.equal(history.length, text.ASSISTANT_HISTORY_LIMIT); assert.equal(history[0].role, 'user');
  assert.deepEqual(history.at(-1), { role: 'assistant', content: 'đáp 14' });
  assert.deepEqual(Object.keys(history[0]).sort(), ['content', 'role'], 'BE chỉ nhận role + content');
  // cửa sổ cắt giữa một cặp hỏi–đáp: bỏ câu trả lời mồ côi đứng đầu để lịch sử luôn mở đầu bằng người dùng
  const odd = chat.buildHistory(many.slice(0, 29));
  assert.equal(odd.length, text.ASSISTANT_HISTORY_LIMIT - 1); assert.equal(odd[0].role, 'user');

  const failed = [...turn(0), { id: 'u1', role: 'user', content: 'lỗi mạng', status: 'failed', error: 'x' }];
  assert.deepEqual(chat.buildHistory(failed).map((m) => m.content), ['hỏi 0', 'đáp 0'], 'tin chưa được trả lời không gửi lại cho AI');
  const base = turn(0); const marked = chat.withFailure(base, 'u0', 'Đã dừng trả lời.');
  assert.equal(marked[0].status, 'failed'); assert.equal(marked[0].error, 'Đã dừng trả lời.'); assert.equal(base[0].status, 'sent', 'không sửa danh sách gốc');
  assert.deepEqual(chat.withoutMessage(marked, 'u0').map((m) => m.id), ['a0']);
  assert.notEqual(chat.nextMessageId('user'), chat.nextMessageId('user'));
});

test('AI chat errors are friendly: the BE configuration hint stays hidden, limits and offline are explained', () => {
  const app = loadApp('http://localhost/api/v1'); const { ApiError } = app.load('lib/api'); const chat = app.load('lib/aiChat'); const { ASSISTANT_ERRORS } = app.load('constants/assistant');
  const unconfigured = chat.aiErrorMessage(new ApiError('Tính năng AI hiện chưa được cấu hình (thiếu GROQ_API_KEY).', 503));
  assert.equal(unconfigured, ASSISTANT_ERRORS.unavailable); assert.ok(!/GROQ|API_KEY/.test(unconfigured));
  assert.equal(chat.aiErrorMessage(new ApiError('Lỗi kết nối đến AI Server. Vui lòng thử lại.', 500)), ASSISTANT_ERRORS.unavailable);
  assert.equal(chat.aiErrorMessage(new ApiError('Too Many Requests', 429)), ASSISTANT_ERRORS.tooManyRequests);
  assert.equal(chat.aiErrorMessage(new ApiError('Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.', 0)), 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.');
  assert.equal(chat.aiErrorMessage(new Error('AI chưa trả về nội dung.')), 'AI chưa trả về nội dung.');
  assert.equal(chat.aiErrorMessage('lạ'), ASSISTANT_ERRORS.generic);
  assert.equal(chat.isAbortError({ code: 'ERR_CANCELED' }), true); assert.equal(chat.isAbortError(new Error('x')), false);
});

test('AI chat posts the question (with history when there is one) to /ai/chat and returns the cleaned reply; stopping cancels the request', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh'); await api.setFacilityId('facility-a');
  const ai = load('services/aiService'); const chat = load('lib/aiChat');
  handle(() => ({ data: { reply: '<think>nội bộ</think>\nDạ có 2 gói.' } }));
  assert.equal(await ai.sendAiMessage('Có gói nào?', []), 'Dạ có 2 gói.');
  const history = [{ role: 'user', content: 'Có gói nào?' }, { role: 'assistant', content: 'Dạ có 2 gói.' }];
  await ai.sendAiMessage('Giá bao nhiêu?', history);
  assert.equal(requests[0].method, 'POST'); assert.equal(requests[0].path, '/api/v1/ai/chat');
  assert.deepEqual(requests[0].body, { message: 'Có gói nào?' });
  assert.deepEqual(requests[1].body, { message: 'Giá bao nhiêu?', history });
  assert.equal(requests[1].headers.authorization, 'Bearer member-token'); assert.equal(requests[1].headers['x-facility-id'], 'facility-a');

  handle(() => ({ data: { reply: '<think>chỉ nghĩ</think>' } }));
  assert.equal(await ai.sendAiMessage('?', []), '', 'không có nội dung hiển thị được thì báo rỗng để màn hình báo lỗi');
  handle(() => ({ status: 503, message: 'Tính năng AI hiện chưa được cấu hình (thiếu GROQ_API_KEY).' }));
  await assert.rejects(ai.sendAiMessage('?', []), (e) => e.status === 503);

  handle(async () => { await new Promise((r) => setTimeout(r, 300)); return { data: { reply: 'muộn' } }; });
  const controller = new AbortController(); const slow = ai.sendAiMessage('chậm', [], controller.signal);
  controller.abort();
  await assert.rejects(slow, (e) => chat.isAbortError(e));
}));

test('AI replies render as Markdown like the web: lists, bold, headings, tables, code; HTML is dropped, images and links keep only their text', () => {
  const md = loadApp('http://localhost/api/v1').load('lib/assistantMarkdown'); const backslash = String.fromCharCode(92);
  const reply = [
    'Dạ chào anh/chị, hiện bên em có các gói tập:', '',
    '- **Gói Membership** (Hạng MEMBERSHIP): 500.000 VND | 30 ngày',
    '- **Gói Premium** (Hạng PREMIUM): 900.000 VND | 30 ngày', '',
    '### Lưu ý',
    '1. Lớp Premium cần gói Premium còn hiệu lực.', '',
    '2. Thanh toán qua *QR SePay* hoặc tại quầy.',
    '   - Quét mã trong app',
    '   - Hoặc tiền mặt',
    '3. Có thể đổi cơ sở',
    '   khi cần (dòng nối).', '',
    '> Lưu ý: giá có thể thay đổi', '',
    '---', '',
    '| Gói | Giá | Thời hạn |', '|---|:---:|---:|', '| Membership | 500.000 | 30 ngày |', '| Premium | 900.000 |', '',
    '```', 'const a = 1;', '```', '',
    'Anh/chị cần em tư vấn thêm không ạ?',
  ].join('\n');
  const blocks = md.parseMarkdown(reply);
  assert.deepEqual(blocks.map((b) => b.type), ['paragraph', 'list', 'heading', 'list', 'quote', 'rule', 'table', 'code', 'paragraph']);
  assert.deepEqual(blocks[1].items.map((i) => i.marker), ['•', '•']);
  assert.deepEqual(blocks[1].items[0].spans[0], { text: 'Gói Membership', bold: true });
  assert.equal(blocks[2].level, 3); assert.equal(md.inlineToPlain(blocks[2].spans), 'Lưu ý');
  assert.deepEqual(blocks[3].items.map((i) => i.marker), ['1.', '2.', '◦', '◦', '3.']);
  assert.deepEqual(blocks[3].items.map((i) => i.depth), [0, 0, 1, 1, 0], 'dòng trống giữa các mục không ngắt danh sách, thụt lề thành cấp con');
  assert.equal(md.inlineToPlain(blocks[3].items[4].spans), 'Có thể đổi cơ sở khi cần (dòng nối).');
  assert.deepEqual(blocks[6].header.map(md.inlineToPlain), ['Gói', 'Giá', 'Thời hạn']);
  assert.equal(md.inlineToPlain(blocks[6].rows[1][2]), '', 'hàng thiếu ô được bù ô trống');
  assert.equal(blocks[7].text, 'const a = 1;');

  const spans = md.parseInline('Xin **chào** `A1` ![ảnh](http://a.b/x.png) [liên kết](http://x.y) <b>đậm</b>');
  assert.equal(md.inlineToPlain(spans), 'Xin chào A1 ảnh liên kết đậm');
  assert.ok(spans.some((s) => s.bold && s.text === 'chào') && spans.some((s) => s.code && s.text === 'A1'));
  assert.ok(!JSON.stringify(spans).includes('http'), 'địa chỉ do mô hình sinh ra không hiện và không mở được');
  assert.equal(md.inlineToPlain(md.parseInline(`giá ${backslash}*không${backslash}* đổi`)), 'giá *không* đổi');
  assert.equal(md.inlineToPlain(md.parseInline('**chưa đóng và * lẻ')), '**chưa đóng và * lẻ');
  assert.equal(md.inlineToPlain(md.parseInline('tên_biến_dài và 2 * 3')), 'tên_biến_dài và 2 * 3', 'gạch dưới trong từ và dấu nhân không thành in nghiêng');
  const nested = md.parseInline('*a **b** c*');
  assert.ok(nested.some((s) => s.bold && s.italic && s.text === 'b'));

  const plain = md.markdownToPlainText(reply);
  assert.ok(plain.includes('• Gói Membership (Hạng MEMBERSHIP): 500.000 VND | 30 ngày') && plain.includes('Gói | Giá | Thời hạn'));
  assert.ok(!plain.includes('**') && !plain.includes('###'));
});

test('floating AI bubble: fixed spot on the right, draggable anywhere on screen, back after 10 s when closed with the x', () => {
  const app = loadApp('http://localhost/api/v1'); const bubble = app.load('lib/assistantBubble'); const c = app.load('constants/assistant');
  const phone = { width: 393, height: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 } };
  const home = bubble.defaultPosition(phone);
  assert.equal(c.BUBBLE_DEFAULT_SIDE, 'right');
  assert.equal(home.x, phone.width - c.BUBBLE_EDGE_MARGIN - c.BUBBLE_FOOTPRINT, 'sát mép phải');
  assert.ok(Math.abs(home.y + c.BUBBLE_FOOTPRINT / 2 - phone.height * c.BUBBLE_DEFAULT_CENTER_Y_RATIO) < 1e-9, 'tâm ở tỷ lệ chiều cao đã cấu hình');
  for (const screen of [phone, { width: 360, height: 800, insets: { top: 24, bottom: 24, left: 0, right: 0 } }, { width: 320, height: 568, insets: { top: 20, bottom: 0, left: 0, right: 0 } }]) {
    const spot = bubble.defaultPosition(screen);
    assert.ok(spot.y + c.BUBBLE_FOOTPRINT <= screen.height - (60 + screen.insets.bottom), 'vị trí cố định không đè lên thanh tab');
    assert.deepEqual(bubble.clampPosition(spot, screen), spot, 'vị trí cố định luôn nằm trong màn hình');
  }

  assert.deepEqual(bubble.clampPosition({ x: -500, y: -500 }, phone), { x: c.BUBBLE_EDGE_MARGIN, y: phone.insets.top + c.BUBBLE_EDGE_MARGIN }, 'kéo ra ngoài thì dừng ở mép, không vào tai thỏ');
  const far = bubble.clampPosition({ x: 9999, y: 9999 }, phone);
  assert.equal(far.x, phone.width - c.BUBBLE_EDGE_MARGIN - c.BUBBLE_FOOTPRINT);
  assert.equal(far.y, phone.height - phone.insets.bottom - c.BUBBLE_EDGE_MARGIN - c.BUBBLE_FOOTPRINT);
  assert.deepEqual(bubble.clampPosition({ x: 120, y: 300 }, phone), { x: 120, y: 300 }, 'mọi chỗ bên trong màn hình đều được giữ nguyên (không dính cạnh)');
  const tiny = bubble.clampPosition({ x: 30, y: 30 }, { width: 50, height: 50, insets: { top: 0, bottom: 0, left: 0, right: 0 } });
  assert.ok(tiny.x >= 0 && tiny.y >= 0, 'khung quá nhỏ (chia đôi màn hình, bàn phím) không cho toạ độ âm');

  assert.equal(bubble.isTap({ dx: 2, dy: 1, durationMs: 120 }), true);
  assert.equal(bubble.isTap({ dx: 20, dy: 0, durationMs: 120 }), false, 'nhích xa là kéo');
  assert.equal(bubble.isTap({ dx: 0, dy: 0, durationMs: 900 }), false, 'giữ lâu không phải chạm mở chat');

  assert.equal(c.BUBBLE_RESPAWN_MS, 10_000);
  const backAt = bubble.respawnAt(1_000); assert.equal(backAt, 11_000);
  assert.equal(bubble.isHidden(backAt, 10_999), true); assert.equal(bubble.isHidden(backAt, 11_000), false); assert.equal(bubble.isHidden(null, 0), false);
  assert.equal(bubble.msUntilRespawn(backAt, 4_000), 7_000); assert.equal(bubble.msUntilRespawn(backAt, 20_000), 0); assert.equal(bubble.msUntilRespawn(null, 0), 0);
  assert.match(c.BUBBLE_HINT_TEXT, /10 giây/); assert.match(c.BUBBLE_LABELS.close, /10 giây/);
  assert.equal(bubble.showsBubbleOn(['assistant']), false, 'đang ở màn chat AI thì không cần bong bóng'); assert.equal(bubble.showsBubbleOn(['(tabs)', 'classes']), true);
});

test('AI assistant wiring: thin route, one shared conversation above the navigator, bubble only after login, nothing hard-coded', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const route = readSource('app/assistant.tsx'); assert.match(route, /AssistantChatView/); assert.ok(!/useState|useQuery|apiRequest|api\./.test(strip(route)));
  const layout = readSource('app/_layout.tsx');
  assert.match(layout, /<AuthProvider>\s*<AssistantProvider>/); assert.match(layout, /isAuthenticated \? <AssistantBubble \/> : null/);
  assert.ok(layout.indexOf('<AssistantBubble />') > layout.indexOf('</Stack>'), 'bong bóng nằm trên mọi màn hình của Stack');
  assert.ok(!/\bkey=/.test(strip(readSource('context/AssistantContext.tsx'))), 'đổi tài khoản/cơ sở xóa trạng thái bằng effect, không dựng lại cả cây màn hình bằng key');
  const session = readSource('hooks/shared/useAssistantSession.ts');
  assert.match(session, /abort\(\)/); assert.match(session, /scopeKey/);
  assert.match(readSource('hooks/shared/useBubbleDrag.ts'), /PanResponder/);
  const bubbleCode = strip(['components/assistant/AssistantBubble.tsx', 'hooks/shared/useAssistantBubble.ts', 'hooks/shared/useBubbleDrag.ts'].map(readSource).join('\n'));
  assert.ok(!/10_?000/.test(bubbleCode), 'thời gian hiện lại lấy từ constants/assistant.ts');
  assert.match(bubbleCode, /BUBBLE_LABELS\.close/); assert.match(bubbleCode, /dismiss/);
  const shown = strip(['constants/assistant.ts', 'lib/aiChat.ts', ...fs.readdirSync(path.resolve(__dirname, '..', 'components/assistant')).filter((f) => f.endsWith('.tsx')).map((f) => `components/assistant/${f}`)].map(readSource).join('\n'));
  assert.ok(!/GROQ|API_KEY/.test(shown), 'tên biến cấu hình của BE không bao giờ hiện cho người dùng');
  assert.ok(!/subtitle=/.test(shown));
  const routes = loadApp('http://localhost/api/v1').load('navigation/routes'); assert.equal(routes.ROUTES.aiAssistant, '/assistant');
  assert.equal(routes.canAccessRoute('MEMBER', ['assistant']), true); assert.equal(routes.canAccessRoute('COACH', ['assistant']), true);
});

test('Explore filters follow the web: area type and term go to GET /classes, the term banner reads /terms/current', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh'); await api.setFacilityId('fac-q1');
  handle((req) => req.path.endsWith('/terms/current')
    ? { data: { id: 'term-1', name: 'Kỳ Thu 2026' } }
    : { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
  const classes = load('services/classService'); const terms = load('services/termService');
  await classes.getClasses({ search: 'yoga', areaType: 'POOL', termId: 'term-1', isActive: 'true' });
  const list = requests.at(-1);
  assert.equal(list.path, '/api/v1/classes');
  assert.deepEqual([list.query.get('areaType'), list.query.get('termId'), list.query.get('search'), list.query.get('isActive')], ['POOL', 'term-1', 'yoga', 'true']);
  await terms.getTerms(); assert.equal(requests.at(-1).path, '/api/v1/terms');
  const current = await terms.getCurrentTerm(); assert.equal(requests.at(-1).path, '/api/v1/terms/current'); assert.equal(current.data.id, 'term-1');
  assert.ok(requests.every((r) => r.headers['x-facility-id'] === 'fac-q1'));
  // Bộ lọc rỗng thì không gửi tham số thừa lên BE
  await classes.getClasses({ areaType: undefined, termId: undefined });
  assert.equal(requests.at(-1).query.has('areaType'), false); assert.equal(requests.at(-1).query.has('termId'), false);
}));

test('terms are limited to the selected facility; the banner shows on Home and Explore, the extra filters for members only', () => {
  const t = loadApp('http://localhost/api/v1').load('lib/termRegistration');
  const terms = [{ id: 'a', facilityId: 'q1' }, { id: 'b', facilityId: 'q7' }, { id: 'c', facilityId: null }, { id: 'd' }];
  assert.deepEqual(t.termsForFacility(terms, 'q1').map((x) => x.id), ['a', 'c', 'd']);
  assert.deepEqual(t.termsForFacility(terms, undefined).map((x) => x.id), ['c', 'd']);
  const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  assert.match(read('components/member/MemberHomeView.tsx'), /<TermBanner withAction \/>/);
  const explore = read('components/classes/ClassesExploreView.tsx');
  assert.match(explore, /!isCoach && <TermBanner \/>/);
  assert.match(explore, /<ClassFilterSheet\b[\s\S]*?showRegistrationFilters=\{!isCoach\}/);
  assert.match(read('hooks/shared/useClassesExplore.ts'), /useFacilityTerms\(\{ enabled: !isCoach \}\)/);
  assert.match(read('hooks/shared/useClasses.ts'), /filters\?\.areaType, filters\?\.termId/);
});

// ─── Kiến trúc: route mỏng → View → hook → service ────────────────────────────────────────────────────────────────────

function sourceFilesUnder(...dirs) {
  const root = path.resolve(__dirname, '..'); const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push({ rel: path.relative(root, full).replaceAll('\\', '/'), source: fs.readFileSync(full, 'utf8') });
    }
  };
  for (const dir of dirs) walk(path.join(root, dir));
  return files;
}
// Bỏ chú thích để lời giải thích trong file không bị tính là code
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const API_CALL = /\b(apiRequest|allPages)\s*[<(]|\bapi\.(get|post|patch|put|delete|uploadAvatar)\s*[<(]/;
const QUERY_HOOK = /\b(useQuery|useMutation|useInfiniteQuery|useQueryClient)\s*[<(]/;

test('architecture: routes stay thin, components never fetch, hooks reach the API only through services', () => {
  const offenders = { fatRoutes: [], routeFetch: [], componentFetch: [], hookApi: [] };
  for (const { rel, source } of sourceFilesUnder('app')) {
    const code = stripComments(source);
    // Route chỉ đọc tham số và dựng một View; riêng _layout là nơi khai báo điều hướng nên không giới hạn số dòng
    if (!rel.endsWith('/_layout.tsx') && source.split('\n').length > 40) offenders.fatRoutes.push(rel);
    if (API_CALL.test(code) || QUERY_HOOK.test(code)) offenders.routeFetch.push(rel);
  }
  for (const { rel, source } of sourceFilesUnder('components')) {
    const code = stripComments(source);
    if (API_CALL.test(code) || QUERY_HOOK.test(code)) offenders.componentFetch.push(rel);
  }
  for (const { rel, source } of sourceFilesUnder('hooks')) {
    if (API_CALL.test(stripComments(source))) offenders.hookApi.push(rel);
  }
  assert.deepEqual(offenders, { fatRoutes: [], routeFetch: [], componentFetch: [], hookApi: [] });
});

test('tab role guard comes from canAccessRoute so the tab bar and the routes can never disagree', () => {
  const routes = loadApp('http://localhost/api/v1').load('navigation/routes');
  assert.equal(routes.canAccessRoute('MEMBER', ['(tabs)', 'enrollments']), true);
  assert.equal(routes.canAccessRoute('COACH', ['(tabs)', 'enrollments']), false);
  assert.equal(routes.canAccessRoute('COACH', ['(tabs)', 'coach-attendance']), true);
  assert.equal(routes.canAccessRoute('MEMBER', ['(tabs)', 'coach-attendance']), false);
  assert.equal(routes.canAccessRoute(undefined, ['(tabs)', 'enrollments']), false);
  for (const name of ['index', 'schedule', 'chat', 'account']) {
    for (const role of ['MEMBER', 'COACH']) assert.equal(routes.canAccessRoute(role, ['(tabs)', name]), true, `${role} phải vào được tab ${name}`);
  }
  // Khám phá là tab của hội viên; chi tiết lớp (classes/[id]) dùng chung; HLV có "Lớp phụ trách" riêng trong khu vực coach
  assert.equal(routes.canAccessRoute('MEMBER', ['(tabs)', 'classes']), true); assert.equal(routes.canAccessRoute('COACH', ['(tabs)', 'classes']), false);
  for (const role of ['MEMBER', 'COACH']) assert.equal(routes.canAccessRoute(role, ['classes', '[id]']), true, `${role} xem được chi tiết lớp`);
  assert.equal(routes.canAccessRoute('COACH', ['coach', 'classes']), true); assert.equal(routes.canAccessRoute('MEMBER', ['coach', 'classes']), false);
  // Thông tin cá nhân (trong Stack của tab Tài khoản) và Thông báo (ngoài tabs) mở được cho cả hai vai trò
  for (const role of ['MEMBER', 'COACH']) {
    assert.equal(routes.canAccessRoute(role, ['(tabs)', 'account', 'profile']), true); assert.equal(routes.canAccessRoute(role, ['notifications']), true);
  }
  assert.match(readSource('app/(tabs)/_layout.tsx'), /guard=\{canAccessRoute\(user\?\.role, \['\(tabs\)', tab\.name\]\)\}/);
});

test('services behind the refactored screens call the right endpoints (class detail, class sessions, sports, coach specializations, chat badge)', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh');
  handle((req) => req.path.endsWith('/specializations') ? { data: [{ sportId: 's1' }] }
    : req.path.endsWith('/unread-count') ? { data: { unreadCount: 7 } }
    : { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } });
  const classes = load('services/classService'); const coaches = load('services/coachService'); const chat = load('services/chatService');
  assert.equal(classes.classPath('c 1/x'), '/classes/c%201%2Fx');
  await classes.getClassById('c 1/x'); assert.equal(requests.at(-1).path, '/api/v1/classes/c%201%2Fx');
  await classes.getUpcomingClassSessions('c1');
  const sessions = requests.at(-1);
  assert.equal(sessions.path, '/api/v1/class-schedules');
  assert.deepEqual([sessions.query.get('classId'), sessions.query.get('status')], ['c1', 'SCHEDULED']);
  assert.ok(Date.parse(sessions.query.get('startAfter')) <= Date.now(), 'chỉ lấy buổi từ bây giờ trở đi');
  await classes.getAllSports(); assert.equal(requests.at(-1).path, '/api/v1/sports'); assert.equal(requests.at(-1).query.has('isActive'), false);
  await classes.getSports(); assert.equal(requests.at(-1).query.get('isActive'), 'true');
  const assigned = await coaches.getCoachSpecializations('coach/1');
  assert.equal(requests.at(-1).path, '/api/v1/coaches/coach%2F1/specializations'); assert.deepEqual(assigned.data, [{ sportId: 's1' }]);
  const unread = await chat.getUnreadCount();
  assert.equal(requests.at(-1).path, '/api/v1/chat/messages/unread-count'); assert.equal(unread.data.unreadCount, 7);
}));

test('coach specializations: sport ids become names, an id missing from the catalogue keeps a placeholder', () => {
  const coach = loadApp('http://localhost/api/v1').load('lib/coachProfile');
  const sports = [{ id: 's1', name: 'Yoga' }, { id: 's2', name: 'Bơi' }];
  assert.deepEqual(coach.specializationNames([{ sportId: 's1' }, { sportId: 'gone' }, { sportId: 's2' }], sports), ['Yoga', 'Bộ môn chưa xác định', 'Bơi']);
  assert.deepEqual(coach.specializationNames([], sports), []);
});

test('my classes tabs: upcoming soonest first, completed and cancelled latest first, a booked class that already ended is completed', () => {
  const m = loadApp('http://localhost/api/v1').load('lib/myClasses');
  const now = Date.parse('2026-11-15T12:00:00Z');
  const item = (id, status, start, end) => ({ id, status, bookedAt: '2026-11-01T00:00:00Z', schedule: start ? { startTime: start, endTime: end } : undefined });
  const all = [
    item('later', 'BOOKED', '2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z'),
    item('soon', 'BOOKED', '2026-11-16T10:00:00Z', '2026-11-16T11:00:00Z'),
    item('ended', 'BOOKED', '2026-11-14T10:00:00Z', '2026-11-14T11:00:00Z'),
    item('done', 'COMPLETED', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z'),
    item('cancelled-old', 'CANCELLED', '2026-11-05T10:00:00Z', '2026-11-05T11:00:00Z'),
    item('cancelled-new', 'CANCELLED', '2026-11-12T10:00:00Z', '2026-11-12T11:00:00Z'),
    item('no-schedule', 'BOOKED'), // chưa có buổi → chưa kết thúc, xếp theo lúc đặt
  ];
  const groups = m.groupEnrollments(all, now);
  assert.deepEqual(groups.upcoming.map((x) => x.id), ['no-schedule', 'soon', 'later']);
  assert.deepEqual(groups.completed.map((x) => x.id), ['ended', 'done']);
  assert.deepEqual(groups.cancelled.map((x) => x.id), ['cancelled-new', 'cancelled-old']);
  assert.equal(all[0].id, 'later', 'không sắp xếp lại mảng gốc');
  assert.equal(m.isSchedulePast(undefined, now), false);
  assert.equal(m.isSchedulePast('2026-11-15T11:59:59Z', now), true);
  assert.equal(m.isSchedulePast('2026-11-15T12:00:00Z', now), false);
});

test('shared date formatters use Vietnam time (weekday long style, chat separators, notification and review ages)', () => {
  const f = loadApp('http://localhost/api/v1').load('lib/format');
  const iso = '2026-11-14T17:30:00Z'; // 00:30 ngày 15/11/2026 (Chủ Nhật) theo giờ Việt Nam
  assert.equal(f.formatDateTime(iso), '15/11/2026 00:30');
  assert.equal(f.formatWeekdayDate(iso, 'long'), 'Chủ Nhật, 15/11/2026');
  assert.equal(f.formatWeekdayDate(iso), 'CN, 15/11/2026');
  assert.equal(f.formatDateSeparator(iso), 'Chủ Nhật, 15/11');
  assert.equal(f.isSameVietnamDay(iso, '2026-11-15T16:00:00Z'), true); // 23:00 cùng ngày 15/11
  assert.equal(f.isSameVietnamDay(iso, '2026-11-14T16:59:00Z'), false); // 23:59 ngày 14/11
  const at = (ms) => Date.parse(iso) + ms; const minute = 60_000; const hour = 60 * minute; const day = 24 * hour;
  assert.deepEqual([30_000, 5 * minute, 3 * hour, 2 * day].map((ms) => f.timeAgo(iso, at(ms))), ['Vừa xong', '5 phút trước', '3 giờ trước', '2 ngày trước']);
  assert.deepEqual([12 * hour, 3 * day, 29 * day, 40 * day].map((ms) => f.formatReviewAge(iso, at(ms))), ['Hôm nay', '3 ngày trước', '29 ngày trước', '15/11/2026']);
});

test('chat inbox follows the web: unread first, then newest, then name; only people already chatted with until you search', () => {
  const chat = loadApp('http://localhost/api/v1').load('lib/chat');
  const person = (id, fullName, email) => ({ id, fullName, email });
  const an = person('a', 'An Nguyễn', 'an@mail.com'); const binh = person('b', 'Bình Lê', 'binh@mail.com'); const cuong = person('c', 'Cường Trần'); const dung = person('d', 'Dũng Phạm', 'dung@mail.com');
  const former = person('old', 'Người cũ'); // không còn trong danh sách liên hệ nhưng vẫn có cuộc trò chuyện
  const msg = (createdAt, senderId = 'x') => ({ senderId, content: 'hi', createdAt });
  const conversations = [
    { user: an, latestMessage: msg('2026-11-01T10:00:00Z'), unreadCount: 2 }, // cũ nhất nhưng chưa đọc → lên đầu
    { user: binh, latestMessage: msg('2026-11-02T10:00:00Z'), unreadCount: 0 },
    { user: former, latestMessage: msg('2026-11-03T10:00:00Z'), unreadCount: 0 },
  ];
  const rows = chat.buildInboxRows([an, binh, cuong, dung], conversations);
  assert.deepEqual(rows.map((r) => r.user.id), ['a', 'old', 'b', 'c', 'd'], 'chưa đọc, rồi mới nhắn gần nhất, rồi theo tên (Cường trước Dũng)');
  assert.deepEqual(rows[3], { user: cuong, latestMessage: null, unreadCount: 0 });

  // Chưa tìm: chỉ người đã nhắn với mình; đang tìm: mọi liên hệ theo tên / email để bắt đầu cuộc trò chuyện mới
  assert.deepEqual(chat.visibleInboxRows(rows, '').map((r) => r.user.id), ['a', 'old', 'b']);
  assert.deepEqual(chat.visibleInboxRows(rows, '   ').map((r) => r.user.id), ['a', 'old', 'b']);
  assert.deepEqual(chat.visibleInboxRows(rows, 'dung@').map((r) => r.user.id), ['d'], 'tìm ra cả người chưa nhắn lần nào');
  assert.deepEqual(chat.visibleInboxRows(rows, '  BINH@ ').map((r) => r.user.id), ['b']);
  assert.deepEqual(chat.visibleInboxRows(rows, 'nguyễn').map((r) => r.user.id), ['a']);
  assert.equal(chat.visibleInboxRows(rows, 'zzz').length, 0);
  assert.equal(chat.filterInboxRows(rows, '   ').length, 5);

  // Dòng xem trước như web: "Bạn: …" cho tin của mình, tệp đính kèm, tin trống, chưa có tin
  const preview = (latestMessage) => chat.inboxPreview({ user: an, latestMessage, unreadCount: 0 }, 'me');
  assert.equal(preview({ senderId: 'x', content: 'chào', createdAt: '' }), 'chào');
  assert.equal(preview({ senderId: 'me', content: 'chào', createdAt: '' }), 'Bạn: chào');
  assert.equal(preview({ senderId: 'me', content: '', fileUrl: '/f', createdAt: '' }), 'Bạn: Đã gửi tệp đính kèm');
  assert.equal(preview({ senderId: 'x', content: '', createdAt: '' }), 'Tin nhắn mới');
  assert.equal(preview(null), 'Chưa có tin nhắn — bấm để bắt đầu');

  // Trực tuyến: tập mới chỉ tạo khi có thay đổi, không sửa tập cũ
  const base = new Set(['a']);
  assert.equal(chat.applyPresence(base, 'a', true), base);
  assert.deepEqual([...chat.applyPresence(base, 'b', true)], ['a', 'b']);
  assert.deepEqual([...chat.applyPresence(base, 'a', false)], []);
  assert.deepEqual([...base], ['a']);
});

test('password forms: reset checks OTP, then length, then confirmation; change-password schema reports the same rules per field', () => {
  const app = loadApp('http://localhost/api/v1'); const reset = app.load('lib/passwordReset').resetFormError; const { passwordChangeSchema } = app.load('lib/passwordChange');
  const good = { otp: '123456', newPassword: 'secret1', confirmPassword: 'secret1' };
  assert.equal(reset(good), null);
  assert.equal(reset({ ...good, otp: ' 123456 ' }), null, 'khoảng trắng hai đầu mã OTP được bỏ');
  assert.equal(reset({ ...good, otp: '12345' }).message, 'Mã OTP gồm 6 chữ số.');
  assert.equal(reset({ ...good, newPassword: '12345', confirmPassword: '12345' }).message, 'Mật khẩu mới ít nhất 6 ký tự.');
  const mismatch = reset({ ...good, confirmPassword: 'other12' });
  assert.deepEqual([mismatch.title, mismatch.message], ['Lỗi', 'Mật khẩu xác nhận không khớp.']);
  assert.equal(reset({ otp: '', newPassword: '1', confirmPassword: '2' }).message, 'Mã OTP gồm 6 chữ số.', 'sai nhiều chỗ thì báo mã OTP trước');

  const problems = (input) => { const r = passwordChangeSchema.safeParse(input); return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`); };
  assert.deepEqual(problems({ currentPassword: 'old', newPassword: 'secret1', confirmPassword: 'secret1' }), []);
  assert.deepEqual(problems({ currentPassword: '', newPassword: 'secret1', confirmPassword: 'secret1' }), ['currentPassword: Nhập mật khẩu hiện tại']);
  assert.deepEqual(problems({ currentPassword: 'old', newPassword: '12345', confirmPassword: '12345' }), ['newPassword: Mật khẩu mới ít nhất 6 ký tự']);
  assert.deepEqual(problems({ currentPassword: 'old', newPassword: 'secret1', confirmPassword: 'secret2' }), ['confirmPassword: Mật khẩu xác nhận không khớp']);
});

test('workflow helpers: unknown statuses keep their code, system attendance reports are recognised', () => {
  const w = loadApp('http://localhost/api/v1').load('lib/workflow');
  assert.equal(w.workflowStatus('WAITING'), 'Đang chờ');
  assert.equal(w.workflowStatus('SOMETHING_NEW'), 'SOMETHING_NEW');
  assert.equal(w.isAttendanceReport('{"type":"ATTENDANCE_VIOLATION","rate":0.5}'), true);
  assert.equal(w.isAttendanceReport('Tôi cần hỗ trợ đổi lịch tập'), false);
});

// ─── Phase 3: huấn luyện viên (ghi chú điểm danh, mã QR, tổng quan buổi dạy, thẻ lớp phụ trách) ─────────────────────────

test('coach attendance note is optional, trimmed and capped like the web; the service sends it only when present', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('coach-token', 'refresh');
  const note = load('lib/attendanceNote'); const c = load('constants/attendance');
  assert.equal(c.ATTENDANCE_NOTE_MAX_LENGTH, 1000);
  assert.equal(note.attendanceNoteForSave('   '), undefined); assert.equal(note.attendanceNoteForSave(undefined), undefined);
  assert.equal(note.attendanceNoteForSave('  Đến muộn 5 phút  '), 'Đến muộn 5 phút');
  assert.equal(note.attendanceNoteForSave('x'.repeat(1500)).length, 1000);
  // Ghi chú trên bản ghi: mã hệ thống đổi thành câu đọc được, ghi chú khác giữ nguyên chữ BE trả
  assert.equal(note.displayAttendanceNote(null), null); assert.equal(note.displayAttendanceNote('  '), null);
  assert.equal(note.displayAttendanceNote('SYSTEM_NO_SHOW'), c.COACH_ATTENDANCE_TEXT.systemNoShow);
  assert.equal(note.displayAttendanceNote(' Điểm danh bằng mã dự phòng (nhập tay) '), 'Điểm danh bằng mã dự phòng (nhập tay)');

  handle(() => ({ status: 201, data: { id: 'a1' } }));
  const service = load('services/attendanceService');
  await service.createAttendance({ scheduleId: 's1', memberId: 'm1', status: 'LATE', note: note.attendanceNoteForSave(' đến muộn ') });
  assert.equal(requests.at(-1).path, '/api/v1/attendance');
  assert.deepEqual(requests.at(-1).body, { scheduleId: 's1', memberId: 'm1', status: 'LATE', note: 'đến muộn' });
  await service.createAttendance({ scheduleId: 's1', memberId: 'm2', status: 'PRESENT', note: note.attendanceNoteForSave('') });
  assert.deepEqual(requests.at(-1).body, { scheduleId: 's1', memberId: 'm2', status: 'PRESENT' }, 'ghi chú trống thì không gửi');
  // Hộp chọn kết quả có ô ghi chú và truyền xuống hook; bản ghi đã lưu hiện ghi chú
  assert.match(readSource('components/coach/AttendanceStatusPicker.tsx'), /onSelect\(status, note\)/);
  assert.match(readSource('hooks/coach/useCoachAttendance.ts'), /note: attendanceNoteForSave\(note\)/);
  assert.match(readSource('components/coach/RosterRow.tsx'), /displayAttendanceNote\(record\?\.note\)/);
}));

test('QR attendance countdown runs from the moment the request was sent and never goes below zero', () => {
  const q = loadApp('http://localhost/api/v1').load('lib/qrAttendance');
  const credential = q.toQrCredential({ qrToken: 'jwt', expiresIn: 600, manualCode: 'K7M2QP', manualCodeExpiresIn: 90 }, 1_000_000);
  assert.deepEqual(credential, { token: 'jwt', manualCode: 'K7M2QP', qrExpiresAt: 1_600_000, manualCodeExpiresAt: 1_090_000 });
  assert.deepEqual(q.qrCountdown(credential, 1_002_000), { qrSeconds: 598, manualSeconds: 88, qrExpired: false, manualExpired: false });
  assert.equal(q.qrCountdown(credential, 1_089_001).manualSeconds, 1, 'còn 0,999 giây vẫn hiện 1');
  const late = q.qrCountdown(credential, 1_091_000); // mã dự phòng (90 giây) hết trước mã QR (600 giây)
  assert.deepEqual([late.manualSeconds, late.manualExpired, late.qrExpired], [0, true, false]);
  assert.deepEqual(q.qrCountdown(credential, 9_999_999), { qrSeconds: 0, manualSeconds: 0, qrExpired: true, manualExpired: true });
  assert.deepEqual(q.qrCountdown(null, 5), { qrSeconds: 0, manualSeconds: 0, qrExpired: false, manualExpired: false }, 'chưa có mã thì chưa phải hết hạn');
  assert.equal(q.secondsLeft(5_000, 4_001), 1); assert.equal(q.secondsLeft(5_000, 6_000), 0);
  // Làm mới định kỳ 55 giây như web, nhỏ hơn hạn 90 giây của mã dự phòng
  const c = loadApp('http://localhost/api/v1').load('constants/attendance');
  assert.equal(c.QR_REFRESH_MS, 55_000); assert.ok(c.QR_REFRESH_MS < 90_000);
  // Mã QR của HLV phải có viền trắng (quiet zone) trên nền trắng: thiếu viền, mép đen dính vào nền tối của app nên
  // máy hội viên không tìm ra ô định vị. JWT ~280 ký tự ≈ 65 ô/cạnh → viền ≥ 4 ô và mỗi ô ≥ 3px.
  const modules = 65;
  const modulePx = (c.QR_CODE_SIZE - 2 * c.QR_CODE_QUIET_ZONE) / modules;
  assert.ok(modulePx >= 3, `mỗi ô QR ${modulePx.toFixed(2)}px quá nhỏ`);
  assert.ok(c.QR_CODE_QUIET_ZONE >= 4 * modulePx, 'viền trắng phải rộng ít nhất 4 ô');
  assert.ok(c.QR_CODE_SIZE <= 280, 'mã QR phải vừa modal trên máy rộng 360px');
  const modal = stripComments(readSource('components/coach/AttendanceQrModal.tsx'));
  assert.match(modal, /<QRCode[\s\S]*quietZone=\{QR_CODE_QUIET_ZONE\}[\s\S]*backgroundColor="#FFFFFF"[\s\S]*\/>/);
});

test('teaching summary matches the web dashboard: cancelled sessions only count in the totals, charts use non-cancelled sessions', () => {
  const a = loadApp('http://localhost/api/v1').load('lib/scheduleAnalytics');
  const yoga = { id: 'c1', name: 'Yoga' }; const hiit = { id: 'c2', name: 'HIIT' }; const roomA = { id: 'r1', name: 'Phòng A' }; const roomB = { id: 'r2', name: 'Phòng B' };
  const row = (id, status, startTime, cls, room) => ({ id, status, startTime, endTime: startTime, classId: cls.id, class: cls, roomId: room?.id, room });
  const rows = [
    row('1', 'COMPLETED', '2026-11-15T17:30:00Z', yoga, roomA), // 00:30 Thứ Hai 16/11 theo giờ Việt Nam
    row('2', 'SCHEDULED', '2026-11-16T10:00:00Z', yoga, roomA), // Thứ Hai 17:00
    row('3', 'SCHEDULED', '2026-11-18T10:00:00Z', hiit, roomB), // Thứ Tư
    row('4', 'CANCELLED', '2026-11-18T12:00:00Z', hiit, roomB), // Thứ Tư nhưng đã hủy → không tính vào biểu đồ
    row('5', 'COMPLETED', '2026-11-20T02:00:00Z', hiit, undefined), // Thứ Sáu 09:00, chưa có phòng
  ];
  const s = a.summarizeSchedules(rows);
  assert.deepEqual([s.total, s.scheduled, s.completed, s.cancelled, s.active], [5, 2, 2, 1, 4]);
  assert.deepEqual(s.classes, [{ id: 'c1', name: 'Yoga', count: 2 }, { id: 'c2', name: 'HIIT', count: 2 }], 'hòa số buổi thì giữ thứ tự xuất hiện');
  assert.deepEqual(s.rooms.map((r) => [r.name, r.count]), [['Phòng A', 2], ['Phòng B', 1], ['Chưa phân loại', 1]]);
  assert.deepEqual(s.weekdays.map((d) => [d.label, d.total, d.completed]), [['T2', 2, 1], ['T3', 0, 0], ['T4', 1, 0], ['T5', 0, 0], ['T6', 1, 1], ['T7', 0, 0], ['CN', 0, 0]]);

  // Phần trăm giống ô chỉ số của web: không có mẫu hoặc số liệu vô lý thì không hiện %
  assert.deepEqual([[2, 4], [1, 3], [2, 3], [0, 4]].map(([p, t]) => a.percentOf(p, t)), [50, 33, 67, 0]);
  assert.deepEqual([[0, 0], [5, 4], [-1, 4], [Number.NaN, 4]].map(([p, t]) => a.percentOf(p, t)), [null, null, null, null]);
  const empty = a.summarizeSchedules([]);
  assert.deepEqual([empty.total, empty.active, empty.classes, empty.rooms], [0, 0, [], []]);
  assert.equal(empty.weekdays.length, 7);
  // Tổng quan có đủ bốn chỉ số, đồng hồ tiến độ, phòng tập và chế độ tháng như web
  const card = readSource('components/coach/TeachingSummaryCard.tsx');
  for (const key of ['total', 'scheduled', 'completed', 'cancelled']) assert.match(card, new RegExp(`TEXT\\.kpi\\.${key}`));
  assert.match(card, /TEXT\.progressTitle/); assert.match(card, /TEXT\.roomsTitle/); assert.match(card, /CALENDAR_MODES/);
});

test('coach class cards: own card with type, capacity and status, and a link to the schedule filtered by that class', () => {
  const routes = loadApp('http://localhost/api/v1').load('navigation/routes').ROUTES;
  assert.deepEqual(routes.coachScheduleFor('c1'), { pathname: '/(tabs)/schedule', params: { classId: 'c1' } });
  const card = readSource('components/coach/CoachClassCard.tsx');
  assert.ok(!/useCoursePlan|course-plan/.test(card), 'HLV không tải kế hoạch khóa / chỗ trống dành cho hội viên');
  assert.match(card, /TEXT\.inactive/); assert.match(card, /TEXT\.capacity\(item\.capacity\)/);
  assert.match(readSource('components/classes/ClassesExploreView.tsx'), /isCoach \? \([\s\S]*?<CoachClassCard[\s\S]*?ROUTES\.coachScheduleFor\(item\.id\)/);
  // Lịch dạy áp bộ lọc lớp từ tham số route rồi xoá tham số để lần sau chọn lại đúng lớp đó vẫn áp được
  assert.match(readSource('app/(tabs)/schedule.tsx'), /initialClassId=\{classId\}/);
  assert.match(readSource('hooks/coach/useCoachScheduleScreen.ts'), /if \(initialClassId\) setClassFilter\(initialClassId\)/);
  assert.match(readSource('components/coach/CoachScheduleView.tsx'), /router\.setParams\(\{ classId: '' \}\)/);
});

// ─── Phase 4: thông báo (phân trang, lọc chưa đọc, nút hành động) và tin nhắn (trực tuyến, đang nhập) ──────────────────

test('notifications load one page of 20 at a time, the BE filters unread, pages merge without duplicates', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh');
  const n = load('lib/notifications'); const c = load('constants/notifications');
  assert.equal(c.NOTIFICATION_PAGE_SIZE, 20); // như trang Thông báo của web
  const page = (p, totalPages, ids) => ({ data: ids.map((id) => ({ id, body: 'x' })), pagination: { page: p, limit: 20, total: 45, totalPages } });
  assert.equal(n.nextNotificationPage(page(1, 3, [])), 2);
  assert.equal(n.nextNotificationPage(page(3, 3, [])), undefined, 'trang cuối thì hết');
  assert.equal(n.nextNotificationPage({ data: [] }), undefined, 'BE không trả phân trang thì coi như một trang');
  assert.deepEqual(n.mergeNotificationPages([page(1, 2, ['a', 'b', 'c']), page(2, 2, ['c', 'd'])]).map((x) => x.id), ['a', 'b', 'c', 'd'], 'thông báo mới chen vào làm trang sau lặp lại dòng cuối trang trước');
  assert.equal(n.isLongNotification('x'.repeat(110)), false); assert.equal(n.isLongNotification('x'.repeat(111)), true);

  // Service: đúng MỘT trang mỗi lần gọi (không lặp qua mọi trang như allPages), lọc chưa đọc do BE làm
  handle(() => ({ data: [], pagination: { page: 2, limit: 20, total: 45, totalPages: 3 } }));
  const service = load('services/notificationService');
  const result = await service.getNotificationsPage({ page: '2', limit: '20', isRead: 'false' });
  assert.equal(requests.length, 1); assert.equal(requests[0].path, '/api/v1/notifications');
  assert.deepEqual([requests[0].query.get('page'), requests[0].query.get('limit'), requests[0].query.get('isRead')], ['2', '20', 'false']);
  assert.equal(result.pagination.totalPages, 3);
  await service.getNotificationsPage({ page: '1', limit: '20' });
  assert.equal(requests.at(-1).query.has('isRead'), false, 'xem tất cả thì không gửi isRead');

  const hook = readSource('hooks/shared/useNotifications.ts');
  assert.match(hook, /useInfiniteQuery/); assert.ok(!/allPages/.test(hook + readSource('services/notificationService.ts')), 'không tải hết lịch sử thông báo');
  assert.match(readSource('components/notifications/NotificationsView.tsx'), /onEndReached=\{n\.loadMore\}/);
  assert.match(readSource('components/notifications/NotificationCard.tsx'), /TEXT\.reason\(item\.reason!\)/);
}));

test('notification action buttons: label and target per type; leave requests follow the coach-change page like the web', () => {
  const app = loadApp('http://localhost/api/v1'); const nav = app.load('navigation/notificationRoute'); const { ROUTES } = app.load('navigation/routes');
  const note = (type, metadata) => ({ id: 'n', userId: 'u', type, title: '', body: '', isRead: false, createdAt: '', metadata });
  const action = (type, metadata, role) => { const target = nav.resolveNotificationTarget(note(type, metadata), role); return target && [target.kind, nav.notificationActionLabel(target.kind, role)]; };
  assert.deepEqual(action('CHAT_MESSAGE', { senderId: 'u2' }, 'MEMBER'), ['chat', 'Mở tin nhắn']);
  assert.deepEqual(action('SCHEDULE_UPDATED', { scheduleId: 's1' }, 'MEMBER'), ['schedule', 'Xem lịch tập']);
  assert.deepEqual(action('SCHEDULE_UPDATED', { scheduleId: 's1' }, 'COACH'), ['schedule', 'Xem lịch dạy']);
  assert.deepEqual(action('UPCOMING_CLASS', { classId: 'c1' }, 'MEMBER'), ['class', 'Xem lớp học']);
  assert.deepEqual(action('SUBSCRIPTION_EXPIRING', undefined, 'MEMBER'), ['plans', 'Xem gói tập']);
  assert.deepEqual(action('ATTENDANCE_WARNING', undefined, 'MEMBER'), ['attendance', 'Xem chuyên cần']);
  assert.deepEqual(action('PAYMENT_SUCCESS', undefined, 'MEMBER'), ['payments', 'Xem thanh toán']);
  assert.deepEqual(action('COACH_CHANGE_REJECTED', undefined, 'COACH'), ['coachChanges', 'Xem yêu cầu đổi HLV']);
  assert.deepEqual(action('COACH_CHANGE_APPROVED', { scheduleId: 's9' }, 'COACH'), ['schedule', 'Xem lịch dạy']);
  // Đơn nghỉ: HLV được đưa tới trang đổi HLV (web: /coach/leave chuyển tiếp tới /coach/coach-changes); hội viên không có màn đích
  for (const type of ['LEAVE_REQUEST_SUBMITTED', 'LEAVE_REQUEST_APPROVED', 'LEAVE_REQUEST_REJECTED']) {
    assert.deepEqual(action(type, undefined, 'COACH'), ['leave', 'Xem đơn nghỉ của tôi']);
    assert.equal(nav.resolveNotificationRoute(note(type), 'COACH'), ROUTES.coachChanges);
    assert.equal(nav.resolveNotificationRoute(note(type), 'MEMBER'), null);
    assert.equal(nav.resolveNotificationRoute(note(type)), null);
  }
  // Thiếu dữ liệu để mở, hoặc loại không có màn đích: không có nút (bấm vào chỉ đánh dấu đã đọc)
  assert.equal(action('CHAT_MESSAGE', {}, 'MEMBER'), null);
  assert.equal(action('TRAINING_PLAN_ASSIGNED', undefined, 'MEMBER'), null);
  assert.equal(action('GENERAL', undefined, 'MEMBER'), null);
  assert.deepEqual(nav.resolveNotificationRoute(note('PAYMENT_FAILED')), ROUTES.payments, 'cách gọi cũ (không vai trò) vẫn đúng');
});

test('chat shows who is online and who is typing like the web, and the tab badge updates when a message arrives', () => {
  const c = loadApp('http://localhost/api/v1').load('constants/chat');
  assert.equal(c.CHAT_TYPING_IDLE_MS, 1600); // web: tắt "đang nhập" sau 1,6 giây không gõ
  assert.ok(c.CHAT_TYPING_EXPIRE_MS > c.CHAT_TYPING_IDLE_MS);
  const presence = readSource('hooks/shared/usePresence.ts');
  assert.match(presence, /presence:list/); assert.match(presence, /presenceChanged/); assert.match(presence, /socket\.on\('disconnect', cleared\)/);
  const typing = readSource('hooks/shared/useTyping.ts');
  assert.match(typing, /socket\.emit\('typing', \{ receiverId: partnerId, isTyping \}\)/); assert.match(typing, /userId !== partnerId/);
  const thread = readSource('components/chat/ChatThreadView.tsx');
  assert.match(thread, /useTyping\(userId, !isGeneral\)/, 'phòng chung không có "đang nhập"');
  assert.match(thread, /typing\.notify\(value\)/); assert.match(thread, /typing\.stop\(\)/);
  assert.match(readSource('components/chat/ChatInboxView.tsx'), /inbox\.online\.has\(item\.user\.id\)/);
  assert.match(readSource('hooks/shared/useChatUnreadCount.ts'), /socket\.on\('newMessage', refresh\)/);
  // Mở cuộc trò chuyện xong thì số chưa đọc đổi ngay
  assert.match(readSource('hooks/shared/useChat.ts'), /invalidateQueries\(\{ queryKey: \['chat-unread-count'\] \}\)/);
});

// ─── Phase 5: hướng dẫn sử dụng ───────────────────────────────────────────────────────────────────────────────────────

test('help guide: topics per role follow the web HelpPanel, the steps match the real screens and every topic opens a screen its role can reach', () => {
  const app = loadApp('http://localhost/api/v1');
  const help = app.load('lib/help'); const c = app.load('constants/help'); const cfg = app.load('navigation/helpConfig');
  const { ROUTES, canAccessRoute } = app.load('navigation/routes'); const menus = app.load('navigation/accountMenuConfig');
  // Web: hội viên 3 chủ đề, HLV 2 (cùng thứ tự); mobile thêm "Điểm danh" cho mỗi vai trò
  assert.deepEqual(c.MEMBER_GUIDES.map((g) => g.id), ['classes', 'membership', 'profile', 'attendance']);
  assert.deepEqual(c.COACH_GUIDES.map((g) => g.id), ['schedule', 'classes', 'attendance']);
  assert.equal(help.guidesForRole('COACH'), c.COACH_GUIDES); assert.equal(help.guidesForRole('MEMBER'), c.MEMBER_GUIDES); assert.equal(help.guidesForRole(undefined), c.MEMBER_GUIDES);
  for (const [role, guides] of [['MEMBER', c.MEMBER_GUIDES], ['COACH', c.COACH_GUIDES]]) {
    for (const guide of guides) {
      assert.equal(guide.steps.length, 3, `${role}/${guide.id}: ba bước như web`);
      const route = cfg.HELP_ROUTE[guide.target];
      assert.ok(route, `${role}/${guide.id} có màn đích`);
      assert.ok(canAccessRoute(role, String(route).split('/').filter(Boolean)), `${role} mở được màn của "${guide.title}"`);
    }
    const entries = menus.getAccountMenuForRole(role).flatMap((group) => group.items).filter((item) => item.route === ROUTES.help);
    assert.equal(entries.length, 1, `${role}: đúng một lối vào Hướng dẫn sử dụng`);
  }
  // Lời dẫn và ô tìm giữ chữ của web
  assert.equal(c.HELP_TEXT.intro, 'Các bước thực hiện những công việc thường dùng trong không gian của bạn.');
  assert.equal(c.HELP_TEXT.searchPlaceholder, 'Ví dụ: lịch, gói, thanh toán…');
  assert.equal(c.HELP_TEXT.noResult, 'Không tìm thấy hướng dẫn. Thử từ khóa khác hoặc xóa nội dung tìm kiếm.');

  // Câu chữ khớp app thật: giờ mở điểm danh, tên nút, tên mục trong menu Tài khoản, giới hạn tệp
  const attendance = app.load('constants/attendance');
  assert.equal(attendance.ATTENDANCE_OPEN_BEFORE_MS, 30 * 60_000);
  assert.match(JSON.stringify(c.MEMBER_GUIDES), /Từ 30 phút trước giờ học/); assert.match(JSON.stringify(c.COACH_GUIDES), /từ 30 phút trước giờ bắt đầu/);
  assert.ok(c.MEMBER_GUIDES[3].steps[1].includes(attendance.MY_ATTENDANCE_TEXT.scan), 'tên nút quét mã khớp màn Chuyên cần');
  assert.match(readSource('components/coach/CoachRosterView.tsx'), /Tạo mã QR/);
  assert.deepEqual(attendance.COACH_ATTENDANCE_STATUSES.map((s) => attendance.ATTENDANCE_STATUS_LABEL[s]), ['Có mặt', 'Đi muộn', 'Vắng mặt']);
  const memberLabels = menus.getAccountMenuForRole('MEMBER').flatMap((group) => group.items).map((item) => item.label);
  for (const label of ['Gói thành viên', 'Thông tin cá nhân & bảo mật', 'Điểm danh & chuyên cần']) assert.ok(memberLabels.includes(label), `menu hội viên có "${label}"`);
  assert.ok(menus.getAccountMenuForRole('COACH').flatMap((group) => group.items).some((item) => item.label === 'Lớp phụ trách'));
  assert.equal(app.load('constants/chat').CHAT_FILE_MAX_BYTES, 10 * 1024 * 1024); assert.match(JSON.stringify(c.HELP_TIPS), /tối đa 10 MB/);

  // Tìm: không phân biệt hoa thường và dấu, tìm cả trong các bước
  const ids = (query) => help.filterGuides(c.MEMBER_GUIDES, query).map((g) => g.id);
  assert.deepEqual(ids(''), ['classes', 'membership', 'profile', 'attendance']); assert.deepEqual(ids('   '), ids(''));
  assert.ok(ids('thanh toan').includes('membership')); assert.ok(ids('THANH TOÁN').includes('membership'));
  assert.deepEqual(ids('qr'), ['attendance']); assert.deepEqual(ids('zzzz'), []);
  assert.equal(help.normalizeSearch('Đặt Lịch'), 'dat lich');

  // Route mỏng, mở được cho cả hai vai trò
  const route = readSource('app/help.tsx'); assert.match(route, /HelpGuideView/); assert.ok(!/useState|useQuery|api\./.test(route));
  assert.equal(canAccessRoute('COACH', ['help']), true); assert.equal(canAccessRoute('MEMBER', ['help']), true);
  const view = readSource('components/account/HelpGuideView.tsx');
  assert.match(view, /TEXT\.openFeature/); assert.match(view, /TEXT\.policies/); assert.match(view, /HELP_TIPS/);
});

// ─── Vuốt từ trái sang phải để quay lại trang trước ──────────────────────────────────────────────────────────────────

test('swipe from left to right goes back on every stack: one shared option set, every Stack layout spreads it, no screen switches it off', () => {
  const { SWIPE_BACK_OPTIONS } = loadApp('http://localhost/api/v1').load('navigation/stackOptions');
  // iOS 18 trở xuống chỉ nhận cử chỉ ở mép trái nếu không bật fullScreenGestureEnabled (iOS 26 trở lên mới mặc định bật)
  assert.deepEqual({ ...SWIPE_BACK_OPTIONS }, { gestureEnabled: true, fullScreenGestureEnabled: true });

  // Mọi layout có <Stack> phải rải SWIPE_BACK_OPTIONS vào screenOptions: Stack gốc và cả Stack lồng nhau (mỗi Stack có bộ nhận cử chỉ riêng)
  const stackLayouts = sourceFilesUnder('app').filter(({ rel, source }) => rel.endsWith('/_layout.tsx') && /<Stack[\s>]/.test(stripComments(source)));
  const scanned = stackLayouts.map(({ rel }) => rel);
  for (const expected of ['app/_layout.tsx', 'app/auth/_layout.tsx', 'app/chat/_layout.tsx', 'app/coach/_layout.tsx', 'app/member/_layout.tsx', 'app/(tabs)/account/_layout.tsx']) {
    assert.ok(scanned.includes(expected), `${expected} phải nằm trong các layout được quét (có <Stack>)`);
  }
  const withoutSwipeBack = stackLayouts.filter(({ source }) => {
    const code = stripComments(source);
    return !/\.\.\.SWIPE_BACK_OPTIONS/.test(code) || !/from '(\.\.\/)+navigation\/stackOptions'/.test(code);
  }).map(({ rel }) => rel);
  assert.deepEqual(withoutSwipeBack, [], 'Stack chưa bật vuốt quay lại: ' + withoutSwipeBack.join(', '));

  // Không màn nào tự tắt cử chỉ (gestureEnabled: false / fullScreenGestureEnabled: false): vuốt quay lại áp dụng cho tất cả
  const switchedOff = sourceFilesUnder('app', 'components', 'hooks', 'navigation')
    .filter(({ source }) => /(?:fullScreenGestureEnabled|gestureEnabled)\s*:\s*false/.test(stripComments(source))).map(({ rel }) => rel);
  assert.deepEqual(switchedOff, []);
  // Các tab là màn đầu của Stack gốc (không có trang trước) và không phải Stack nên không cần cấu hình này
  assert.ok(!/<Stack[\s>]/.test(stripComments(readSource('app/(tabs)/_layout.tsx'))));
});

test('sub-screens are stack screens, not hidden tabs: profile lives in the Account stack, notifications and coach classes are pushed over the tabs', () => {
  const app = loadApp('http://localhost/api/v1'); const { ROUTES } = app.load('navigation/routes'); const tabs = app.load('navigation/tabConfig');
  // Thông tin cá nhân: Stack lồng trong tab Tài khoản → thanh tab vẫn hiện, tab Tài khoản sáng, vuốt quay lại được
  assert.equal(ROUTES.profile, '/(tabs)/account/profile');
  for (const file of ['_layout.tsx', 'index.tsx', 'profile.tsx']) assert.ok(fs.existsSync(path.resolve(__dirname, '../app/(tabs)/account', file)), `app/(tabs)/account/${file}`);
  const layout = readSource('app/(tabs)/account/_layout.tsx');
  assert.match(stripComments(layout), /<Stack[\s>]/); assert.match(layout, /unstable_settings = \{ anchor: 'index' \}/);
  // Không còn tab ẩn cho màn con; tab Tài khoản về menu khi rời tab
  for (const role of ['MEMBER', 'COACH']) {
    const config = tabs.getTabConfigForRole(role);
    assert.ok(!config.some((t) => t.name === 'profile' || t.name === 'notifications'), `${role}: Thông tin cá nhân và Thông báo không còn là tab`);
    assert.equal(config.find((t) => t.name === 'account').popToTopOnBlur, true);
  }
  assert.match(readSource('app/(tabs)/_layout.tsx'), /popToTopOnBlur/);
  for (const stale of ['profile.tsx', 'notifications.tsx', 'account.tsx']) assert.ok(!fs.existsSync(path.resolve(__dirname, '../app/(tabs)', stale)), `app/(tabs)/${stale} đã chuyển chỗ`);
  // Thông báo và Lớp phụ trách của HLV: màn đẩy lên trên tabs
  assert.equal(ROUTES.notifications, '/notifications'); assert.equal(ROUTES.coachClasses, '/coach/classes');
  for (const file of ['app/notifications.tsx', 'app/coach/classes.tsx']) assert.ok(fs.existsSync(path.resolve(__dirname, '..', file)), file);
  assert.match(readSource('app/_layout.tsx'), /<Stack\.Screen name="notifications" \/>/);
  // Mọi lối vào "Lớp phụ trách" của HLV dùng route riêng, không còn đi qua tab Khám phá của hội viên
  const menu = app.load('navigation/accountMenuConfig').getAccountMenuForRole('COACH').flatMap((g) => g.items);
  assert.ok(menu.some((i) => i.label === 'Lớp phụ trách' && i.route === ROUTES.coachClasses));
  assert.ok(app.load('navigation/quickAccessConfig').getQuickAccessForRole('COACH').some((i) => i.route === ROUTES.coachClasses));
  assert.equal(app.load('navigation/helpConfig').HELP_ROUTE.coachClasses, ROUTES.coachClasses);
  assert.equal(app.load('constants/help').COACH_GUIDES.find((g) => g.id === 'classes').target, 'coachClasses');
  assert.match(readSource('components/coach/CoachHomeView.tsx'), /router\.push\(ROUTES\.coachClasses\)/);
  assert.match(readSource('components/classes/ClassDetailView.tsx'), /d\.isCoach \? ROUTES\.coachClasses : ROUTES\.classes/);
});

// ─── Lịch tập, thẻ thanh toán ở Trang chủ, khung "Các buổi của khóa" ─────────────────────────────────────────────────────

test('the member schedule tab is named "Lịch tập" everywhere it is shown: tab bar, header, segment and help guide', () => {
  const app = loadApp('http://localhost/api/v1'); const tabs = app.load('navigation/tabConfig');
  assert.equal(tabs.getTabConfigForRole('MEMBER').find((t) => t.name === 'schedule').title, 'Lịch tập');
  assert.equal(tabs.getTabConfigForRole('COACH').find((t) => t.name === 'schedule').title, 'Lịch dạy', 'HLV giữ tên "Lịch dạy"');
  const tab = readSource('components/member/MemberScheduleTabView.tsx');
  assert.match(tab, /label: 'Lịch tập'/); assert.match(tab, /title="Lịch tập"/); assert.ok(!/Lịch học/.test(tab), 'không còn tên cũ "Lịch học"');
  const guides = JSON.stringify(app.load('constants/help').MEMBER_GUIDES);
  assert.match(guides, /tab Lịch tập/); assert.ok(!/tab Lịch học/.test(guides));
});

test('Home shows the payment status card only while the payment time is open (or money waits for review); the plans screen keeps it', () => {
  const { isAwaitingPayment, isPaymentStatusShownOnHome, requiresReview, isConfirmed } = loadApp('http://localhost/api/v1').load('lib/payment');
  const NOW = Date.parse('2026-11-16T10:00:00Z');
  const order = (patch = {}) => ({ paymentId: 'p1', orderCode: 'SC1', amount: 100000, status: 'PENDING', gateway: 'SEPAY', expiresAt: '2026-11-16T10:15:00Z', qrUrl: 'qr', transferContent: 'SC1', ...patch });
  // Còn thời gian chuyển khoản → hiện
  assert.equal(isPaymentStatusShownOnHome(order(), NOW), true);
  assert.equal(isAwaitingPayment(order({ expiresAt: new Date(NOW + 1).toISOString() }), NOW), true);
  // Tới đúng mốc hoặc quá hạn → ẩn (BE chỉ đổi đơn sang FAILED khi job định kỳ chạy, trước đó đơn vẫn PENDING)
  assert.equal(isPaymentStatusShownOnHome(order({ expiresAt: new Date(NOW).toISOString() }), NOW), false);
  assert.equal(isPaymentStatusShownOnHome(order({ expiresAt: '2026-11-16T09:59:59Z' }), NOW), false);
  // Đơn BE đã đóng → ẩn dù hạn còn; hạn không đọc được → ẩn
  for (const status of ['FAILED', 'REFUNDED']) assert.equal(isPaymentStatusShownOnHome(order({ status }), NOW), false);
  assert.equal(isPaymentStatusShownOnHome(order({ expiresAt: 'không phải ngày' }), NOW), false);
  // Tiền đã về nhưng chờ trung tâm đối soát → vẫn hiện dù quá hạn; đơn đã kích hoạt xong không còn là đơn chờ
  const late = '2026-11-16T09:00:00Z';
  assert.equal(requiresReview(order({ status: 'SUCCESS', requiresReview: true })), true);
  assert.equal(isPaymentStatusShownOnHome(order({ status: 'SUCCESS', requiresReview: true, expiresAt: late }), NOW), true);
  assert.equal(isPaymentStatusShownOnHome(order({ status: 'SUCCESS', activationStatus: 'REQUIRES_REVIEW', expiresAt: late }), NOW), true);
  assert.equal(isConfirmed(order({ status: 'SUCCESS' })), true); assert.equal(isPaymentStatusShownOnHome(order({ status: 'SUCCESS', expiresAt: late }), NOW), false);
  // Chỉ Trang chủ ẩn theo hạn, và ẩn đúng lúc hết giờ (hẹn một lần tại mốc hạn, không đếm từng giây)
  const home = readSource('hooks/member/useMemberHome.ts');
  assert.match(home, /useNowUntil\(latestPayment\?\.expiresAt\)/); assert.match(home, /isPaymentStatusShownOnHome\(latestPayment, now\)/);
  assert.ok(!/isPaymentStatusShownOnHome|isAwaitingPayment/.test(readSource('hooks/member/useMembershipScreen.ts')), 'màn Gói thành viên vẫn hiện thẻ để tạo mã mới');
  assert.ok(!/isPaymentStatusShownOnHome|isAwaitingPayment/.test(readSource('hooks/member/usePayment.ts')), 'usePendingPayment vẫn giữ đơn quá hạn');
  const timer = readSource('hooks/shared/useNowUntil.ts'); assert.match(timer, /setTimeout\(arm/); assert.ok(!/setInterval/.test(timer));
});

test('class detail lists the course sessions in a frame of 5 rows and scrolls for the rest', () => {
  const app = loadApp('http://localhost/api/v1');
  const { COURSE_SESSION_LIST } = app.load('constants/classes'); const { framedRowsHeight } = app.load('lib/framedRows');
  assert.equal(COURSE_SESSION_LIST.visibleRows, 5);
  assert.match(COURSE_SESSION_LIST.moreHint(12), /12 buổi/);
  // Khung cao đúng tổng chiều cao ĐÃ ĐO của 5 dòng đầu (dòng có nút danh sách chờ cao hơn); chưa đo đủ thì chưa có số đo
  assert.equal(framedRowsHeight([60, 62, 150, 60, 61, 999], 5), 393);
  assert.equal(framedRowsHeight([60, 62, 150, 60], 5), null);
  assert.equal(framedRowsHeight([60, undefined, 150, 60, 61], 5), null);
  assert.equal(framedRowsHeight([60, 0, 150, 60, 61], 5), null);
  assert.equal(framedRowsHeight([60, 62], 0), null);
  // Màn chi tiết lớp chỉ gọi danh sách có khung; khung cuộn lồng trong trang chạy cả trên Android; chỉ có khung khi nhiều hơn 5 buổi
  const view = readSource('components/classes/ClassDetailView.tsx'); const list = readSource('components/classes/CourseSessionList.tsx');
  assert.match(view, /<CourseSessionList\b/); assert.ok(!/sessionStatusLabel|<WaitlistAction/.test(view), 'các dòng buổi nằm trong CourseSessionList');
  assert.match(list, /nestedScrollEnabled/); assert.match(list, /sessions\.length > visibleRows/); assert.match(list, /COURSE_SESSION_LIST/);
  assert.match(readSource('hooks/shared/useFramedRows.ts'), /framedRowsHeight\(/);
});

// ─── Check-in cơ sở: thẻ QR hội viên (BE: lấy userId làm mã QR, lễ tân quét để check-in) ──────────────────────────────────

test('facility check-in screen shows a member QR card holding the userId and announces a new visit once; the self button stays', () => {
  const app = loadApp('http://localhost/api/v1');
  const { memberCardPayload } = app.load('lib/memberCard'); const { newVisitSince } = app.load('lib/facilityVisit'); const workflow = app.load('constants/workflow');
  // Nội dung mã QR = đúng userId (BE: reception-check-in nhận id hoặc userId của hồ sơ hội viên), cắt khoảng trắng; thiếu thì không có mã
  assert.equal(memberCardPayload('6af9bd0b5bb4acf4009c151d'), '6af9bd0b5bb4acf4009c151d');
  assert.equal(memberCardPayload('  abc  '), 'abc');
  for (const missing of ['', '   ', undefined, null]) assert.equal(memberCardPayload(missing), null);
  // Lượt mới = id khác mốc; lượt đã biết (kể cả check-in trùng, BE trả lại lượt cũ) hoặc chưa có dữ liệu thì không báo
  assert.equal(newVisitSince('a', { id: 'a' }), null);
  assert.deepEqual(newVisitSince('a', { id: 'b' }), { id: 'b' });
  assert.deepEqual(newVisitSince(null, { id: 'first' }), { id: 'first' });
  assert.equal(newVisitSince(null, null), null); assert.equal(newVisitSince('a', undefined), null);
  // Hằng số: hỏi lượt mới đều đặn nhưng không dồn dập; mã đủ lớn cho máy quét; câu chữ có giờ và cơ sở
  assert.ok(workflow.CHECKIN_WATCH_INTERVAL_MS >= 2000 && workflow.CHECKIN_WATCH_INTERVAL_MS <= 10000);
  assert.ok(workflow.CHECKIN_QR_SIZE >= 200 && workflow.CHECKIN_QR_QUIET_ZONE > 0);
  assert.match(workflow.CHECKIN_TEXT.arrivedByReception('17:45', 'Q1'), /Lễ tân.*17:45.*Q1/); assert.match(workflow.CHECKIN_TEXT.arrived('17:45', 'Q1'), /17:45.*Q1/);
  // Nối dây: thẻ QR chỉ khi có hồ sơ hội viên, nội dung mã lấy từ lib (không viết tay), nút tự check-in vẫn còn
  const view = readSource('components/member/CheckInView.tsx'); const card = readSource('components/member/checkin/MemberCardQr.tsx'); const hook = readSource('hooks/member/useCheckIn.ts');
  assert.match(view, /hasProfile && <MemberCardQr/); assert.match(view, /<ArrivedBanner\b/); assert.match(view, /checkIn\.mutate\(\)/);
  assert.match(card, /react-native-qrcode-svg/); assert.match(card, /<QRCode value=\{card\.payload\}/);
  assert.match(hook, /memberCardPayload\(user\?\.id\)/); assert.match(hook, /useCheckInWatcher\(hasProfile\)/);
  // Lượt do chính nút "Check-in" tạo ra không báo lần hai; chỉ hỏi lượt mới khi màn đang hiện
  assert.match(hook, /watcher\.arrived\.id !== checkIn\.data\?\.data\.id/);
  const watcher = readSource('hooks/member/useCheckInWatcher.ts');
  assert.match(watcher, /enabled: enabled && focused/); assert.match(watcher, /refetchInterval: CHECKIN_WATCH_INTERVAL_MS/); assert.match(watcher, /newVisitSince\(baseline\.current, latest\.data\)/);
  // Có lượt mới thì lịch sử vào cửa bên dưới được tải lại ngay (không để "Chưa có lượt vào cửa" cạnh dòng "Đã ghi nhận")
  assert.match(watcher, /invalidateQueries\(\{ queryKey: \['facility-visits'\] \}\)/);
});

// ─── Icon: tab, menu Tài khoản và lối tắt Trang chủ dùng đúng icon lucide mà web dùng cho cùng chức năng ─────────────────

test('mobile tab, account-menu and quick-access icons are the same lucide icons the website uses for the same features', () => {
  const src = readSource('components/shared/Icon.tsx'); const body = src.slice(src.indexOf('const ICON_MAP'), src.indexOf('};', src.indexOf('const ICON_MAP')));
  const lucide = Object.fromEntries([...body.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*([A-Za-z0-9]+),/gm)].map((m) => [m[1], m[2]]));
  const app = loadApp('http://localhost/api/v1'); const tabs = app.load('navigation/tabConfig'); const menu = app.load('navigation/accountMenuConfig'); const quick = app.load('navigation/quickAccessConfig');
  // Thanh tab: web UserLayout (LayoutDashboard, Search, CalendarDays), PortalLayout (MessageCircle), ProfileMenu (UserRound), QuickActions "Điểm danh" (ScanLine)
  const tabIcons = (role) => Object.fromEntries(tabs.getTabConfigForRole(role).filter((t) => t.visible).map((t) => [t.name, lucide[t.iconName]]));
  assert.deepEqual(tabIcons('MEMBER'), { index: 'LayoutDashboard', classes: 'Search', schedule: 'CalendarDays', chat: 'MessageCircle', account: 'UserRound' });
  assert.deepEqual(tabIcons('COACH'), { index: 'LayoutDashboard', schedule: 'CalendarDays', 'coach-attendance': 'ScanLine', chat: 'MessageCircle', account: 'UserRound' });
  // Menu Tài khoản: web UserLayout (CreditCard, Bell), ProfileMenu (ReceiptText, LifeBuoy, UserRound), QuickActions (MapPin, Bot), HelpPanel (CircleHelp), PortalLayout (ShieldCheck).
  // Cố ý KHÔNG theo web: "Danh sách chờ" (web dùng BookOpen trùng "Lớp của tôi") và "Điểm danh & chuyên cần" (web không có mục này trên thanh menu)
  const menuIcons = (role) => Object.fromEntries(menu.getAccountMenuForRole(role).flatMap((g) => g.items).map((i) => [i.label, lucide[i.icon]]));
  assert.deepEqual(menuIcons('MEMBER'), {
    'Gói thành viên': 'CreditCard', 'Thanh toán & hóa đơn': 'ReceiptText', 'Điểm danh & chuyên cần': 'BarChart3', 'Check-in cơ sở': 'MapPin', 'Danh sách chờ': 'Hourglass',
    'Thông báo': 'Bell', 'Yêu cầu hỗ trợ': 'LifeBuoy', 'Trợ lý AI': 'Bot', 'Hướng dẫn sử dụng': 'CircleHelp', 'Chính sách sử dụng': 'ShieldCheck', 'Thông tin cá nhân & bảo mật': 'UserRound',
  });
  // HLV: CoachLayout (BookOpen, ArrowLeftRight); "Đánh giá" giữ Star vì web dùng UserRound trùng icon tab Tài khoản
  assert.deepEqual(menuIcons('COACH'), { 'Lớp phụ trách': 'BookOpen', 'Đổi HLV theo buổi': 'ArrowLeftRight', 'Đánh giá của hội viên': 'Star', 'Thông báo': 'Bell', 'Trợ lý AI': 'Bot', 'Hướng dẫn sử dụng': 'CircleHelp', 'Chính sách sử dụng': 'ShieldCheck', 'Thông tin cá nhân & bảo mật': 'UserRound' });
  const quickIcons = (role) => Object.fromEntries(quick.getQuickAccessForRole(role).map((i) => [i.label, lucide[i.icon]]));
  assert.deepEqual(quickIcons('MEMBER'), { 'Check-in': 'MapPin', 'Chuyên cần': 'BarChart3', 'Hóa đơn': 'ReceiptText', 'Trợ lý AI': 'Bot' });
  assert.deepEqual(quickIcons('COACH'), { 'Lớp phụ trách': 'BookOpen', 'Đổi HLV': 'ArrowLeftRight', 'Đánh giá': 'Star', 'Trợ lý AI': 'Bot' });
  // Bong bóng trợ lý AI nổi: web AIChatBubble dùng Bot; không còn chỗ nào dùng icon cũ 'auto-awesome' (Sparkles) cho trợ lý
  assert.match(readSource('components/assistant/AssistantBubble.tsx'), /<Icon name="smart-toy"/);
  // Chỗ khác có icon tương ứng trên web: dấu tích thành công = CheckCircle2, đăng xuất = LogOut, đính kèm = Paperclip, đọc hết = CheckCheck, khóa = Lock…
  for (const [name, expected] of Object.entries({ 'check-circle': 'CircleCheck', logout: 'LogOut', 'attach-file': 'Paperclip', 'done-all': 'CheckCheck', lock: 'Lock', 'lock-outline': 'Lock', inbox: 'Inbox', email: 'Mail', error: 'CircleAlert', info: 'Info', favorite: 'HeartPulse' })) assert.equal(lucide[name], expected, name);
  // "Lớp của tôi": tab Sắp tới / Hoàn thành / Đã hủy = CalendarCheck / CheckCircle2 / CalendarX như web
  const classesView = readSource('components/member/enrollments/MyClassesView.tsx');
  assert.match(classesView, /id: 'upcoming', label: 'Sắp tới', icon: 'event-available'/); assert.match(classesView, /id: 'completed', label: 'Hoàn thành', icon: 'check-circle'/); assert.match(classesView, /id: 'cancelled', label: 'Đã hủy', icon: 'event-busy'/);
  assert.deepEqual([lucide['event-available'], lucide['event-busy']], ['CalendarCheck', 'CalendarX']);
  // Mọi icon của tab / menu / lối tắt đều có bản lucide (không rơi về bộ MaterialIcons khác nét với web)
  const names = ['MEMBER', 'COACH'].flatMap((role) => [
    ...tabs.getTabConfigForRole(role).map((t) => t.iconName), ...menu.getAccountMenuForRole(role).flatMap((g) => g.items).map((i) => i.icon), ...quick.getQuickAccessForRole(role).map((i) => i.icon),
  ]);
  for (const name of names) assert.ok(lucide[name], `icon "${name}" phải có trong ICON_MAP`);
});

// ─── Khám phá: một hàng công cụ + bảng "Bộ lọc" + chip gỡ được; Lịch: Tuần / Tháng trải đều trong MỘT khung ──────────────────

test('Explore filters: the count and the removable chips follow sport → type → area → term and survive while names are still loading', () => {
  const app = loadApp('http://localhost/api/v1'); const f = app.load('lib/classFilters'); const text = app.load('constants/classes').CLASS_FILTER_TEXT;
  const lookups = { sports: [{ id: 's1', name: 'Boxing cơ bản' }], terms: [{ id: 't1', name: 'Kỳ Thu 2026' }] };
  // Số trên nút "Bộ lọc" = môn + hạng + khu vực + kỳ học; ô tìm kiếm luôn hiện trên màn hình nên không tính
  assert.equal(f.classFilterCount({}), 0); assert.equal(f.classFilterCount({ sportId: undefined, classType: undefined }), 0);
  assert.equal(f.classFilterCount({ sportId: 's1' }), 1); assert.equal(f.classFilterCount({ sportId: 's1', classType: 'PREMIUM', areaType: 'POOL', termId: 't1' }), 4);
  // Chip theo thứ tự cố định bất kể thứ tự gán; hạng lớp và khu vực lấy nhãn tiếng Việt, môn và kỳ học lấy tên từ danh sách
  assert.deepEqual(f.activeClassFilters({}, lookups), []);
  assert.deepEqual(f.activeClassFilters({ termId: 't1', areaType: 'POOL', classType: 'PREMIUM', sportId: 's1' }, lookups), [
    { key: 'sport', label: 'Boxing cơ bản' }, { key: 'type', label: 'Cao cấp' }, { key: 'area', label: 'Hồ bơi' }, { key: 'term', label: 'Kỳ Thu 2026' },
  ]);
  assert.deepEqual(f.activeClassFilters({ classType: 'REGULAR', areaType: 'INDOOR' }, lookups).map((x) => x.label), ['Tiêu chuẩn', 'Trong nhà']);
  // Danh sách môn / kỳ học chưa tải xong: chip vẫn hiện (bằng tên nhóm lọc) để không nhấp nháy rồi biến mất
  assert.deepEqual(f.activeClassFilters({ sportId: 'x', termId: 'y' }, { sports: [], terms: [] }), [{ key: 'sport', label: text.sport }, { key: 'term', label: text.term }]);
  // Mỗi bộ lọc đếm trên nút có đúng một chip
  const all = { sportId: 's1', classType: 'PREMIUM', areaType: 'POOL', termId: 't1' };
  assert.equal(f.activeClassFilters(all, lookups).length, f.classFilterCount(all));
  // Câu chữ của bảng lọc: nút chính theo số lớp, số bộ lọc đang bật, nhãn gỡ chip
  assert.equal(text.apply(3), 'Xem 3 lớp'); assert.equal(text.remove('Cao cấp'), 'Bỏ lọc Cao cấp'); assert.equal(text.active(2), '2 bộ lọc đang bật');
  for (const key of ['button', 'sheetTitle', 'sport', 'type', 'area', 'term', 'all', 'done', 'noResult', 'clear', 'noTerms']) assert.ok(text[key], `CLASS_FILTER_TEXT.${key}`);
});

test('Explore has one toolbar row, a filter sheet for both roles and removable chips — no always-visible rows of sport / type chips', () => {
  const explore = stripComments(readSource('components/classes/ClassesExploreView.tsx'));
  // Màn chính: ô tìm kiếm + nút Bộ lọc (huy hiệu = số bộ lọc) → chip đang bật gỡ được → số kết quả → danh sách
  assert.match(explore, /<ClassSearchBar\b[\s\S]*?filterCount=\{explore\.filterCount\}[\s\S]*?onOpenFilters=\{\(\) => setFilterOpen\(true\)\}/);
  assert.match(explore, /<ActiveFilterChips filters=\{explore\.activeFilters\} onRemove=\{explore\.clearFilter\} \/>/);
  assert.ok(explore.indexOf('<ClassSearchBar') < explore.indexOf('<ActiveFilterChips') && explore.indexOf('<ActiveFilterChips') < explore.indexOf('<FlatList'));
  // Một bảng lọc cho cả hội viên và HLV: khu vực + kỳ học chỉ bật cho hội viên, nút chính hiện số lớp, "Xóa bộ lọc" không đụng ô tìm kiếm
  assert.match(explore, /<ClassFilterSheet\b[\s\S]*?showRegistrationFilters=\{!isCoach\}[\s\S]*?onClear=\{explore\.clearSelectedFilters\}[\s\S]*?resultCount=\{explore\.isLoading \? undefined : classes\.length\}/);
  // Không còn hàng chip môn tập / hạng lớp cuộn ngang, ô nhập riêng hay nút "Bộ lọc" đứng riêng trên màn chính
  assert.doesNotMatch(explore, /\b(FilterChip|ChipRow)\b|horizontal|<TextInput|<Pressable/);
  assert.equal((explore.match(/<ClassFilterSheet\b/g) ?? []).length, 1, 'chỉ một bảng lọc, dùng chung cho hai vai trò');
});

test('the Explore filter sheet: sport + class type for everyone, area + term for members only, live result count on the main button', () => {
  const sheet = stripComments(readSource('components/classes/ClassFilterSheet.tsx'));
  const branch = sheet.indexOf('{showRegistrationFilters && ('); assert.ok(branch > 0, 'nhánh chỉ-hội-viên');
  assert.match(sheet.slice(0, branch), /<FilterSection title=\{TEXT\.sport\}>/); assert.match(sheet.slice(0, branch), /<FilterSection title=\{TEXT\.type\}>/);
  assert.doesNotMatch(sheet.slice(0, branch), /TEXT\.area|TEXT\.term/);
  assert.match(sheet.slice(branch), /<FilterSection title=\{TEXT\.area\}>/); assert.match(sheet.slice(branch), /<FilterSection title=\{TEXT\.term\}>/);
  // Nút chính theo số lớp (đang tải → "Xong"; 0 lớp → "Không có lớp phù hợp"; còn lại → "Xem N lớp"); khung + chân bảng là FilterSheet dùng chung
  assert.match(sheet, /applyLabel=\{applyFilterLabel\(resultCount, TEXT\)\}/); assert.match(sheet, /activeCount=\{activeCount\}[\s\S]*onClear=\{onClear\}/);
  // Nút "Bộ lọc" cạnh ô tìm kiếm: icon tune (lucide SlidersHorizontal), nhãn cho trình đọc màn hình kèm số bộ lọc, huy hiệu chỉ khi có bộ lọc
  const bar = stripComments(readSource('components/classes/ClassSearchBar.tsx'));
  assert.match(bar, /<Icon name="tune"/); assert.match(bar, /TEXT\.active\(filterCount\)/); assert.match(bar, /\{active && \(/); assert.match(bar, /<TextInput\b/);
  assert.match(readSource('components/shared/Icon.tsx'), /\btune: SlidersHorizontal,/);
  // Chip gỡ nhanh: không có bộ lọc thì không dựng gì; mỗi chip có nhãn "Bỏ lọc …" và gỡ đúng bộ lọc của nó
  const chips = stripComments(readSource('components/shared/ActiveFilterChips.tsx'));
  assert.match(chips, /filters\.length === 0\) return null/); assert.match(chips, /accessibilityLabel=\{FILTER_TEXT\.remove\(filter\.label\)\}/); assert.match(chips, /onRemove\(filter\.key\)/);
});

test('useClassesExplore exposes the filter count, the active chips and per-chip / bulk clearing; the sheet clear keeps the typed search', () => {
  const hook = stripComments(readSource('hooks/shared/useClassesExplore.ts'));
  assert.match(hook, /classFilterCount\(filterState\)/); assert.match(hook, /activeClassFilters\(filterState, \{ sports: sportList, terms: facilityTerms\.terms \}\)/);
  assert.match(hook, /hasFilters = Boolean\(search\) \|\| filterCount > 0/);
  // Xóa trong bảng lọc: chỉ bốn bộ lọc, giữ nguyên chữ đang tìm. "Xóa bộ lọc" ngoài màn chính: xóa luôn ô tìm kiếm.
  const clearSelected = hook.slice(hook.indexOf('const clearSelectedFilters'), hook.indexOf('const clearFilters'));
  assert.ok(!/setSearch/.test(clearSelected)); assert.match(clearSelected, /setSportId\(undefined\)[\s\S]*setClassType\(undefined\)[\s\S]*setAreaType\(undefined\)[\s\S]*setTermId\(undefined\)/);
  assert.match(hook.slice(hook.indexOf('const clearFilters'), hook.indexOf('const clearFilter =')), /setSearch\(''\)[\s\S]*clearSelectedFilters\(\)/);
  // Gỡ từng chip: mỗi khóa xóa đúng một bộ lọc
  assert.match(hook, /key === 'sport'\) setSportId\(undefined\)[\s\S]*?key === 'type'\) setClassType\(undefined\)[\s\S]*?key === 'area'\) setAreaType\(undefined\)[\s\S]*?else setTermId\(undefined\)/);
  assert.match(hook, /return \{[\s\S]*filterCount, activeFilters,[\s\S]*clearFilters, clearSelectedFilters, clearFilter,/);
  assert.doesNotMatch(hook, /advancedFilterCount|clearAdvancedFilters/);
  // HLV vẫn không tải kỳ học (không có bộ lọc kỳ)
  assert.match(hook, /useFacilityTerms\(\{ enabled: !isCoach \}\)/);
});

test('the week / month calendar is ONE card: Tuần | Tháng is a full-width control above the period navigation, not a pill in a corner', () => {
  const header = stripComments(readSource('components/schedule/CalendarHeader.tsx')); const frame = stripComments(readSource('components/schedule/ScheduleCalendar.tsx'));
  const grid = stripComments(readSource('components/schedule/CalendarGrid.tsx')); const seg = stripComments(readSource('components/ui/Segmented.tsx'));
  // Bộ chuyển Tuần / Tháng trải hết bề ngang khung (không phải nút nhỏ dồn một góc); tông "soft" vì nằm dưới bộ chuyển chính của màn
  assert.match(header, /<Segmented tone="soft" options=\{CALENDAR_MODES\} value=\{mode\} onChange=\{calendar\.setMode\} \/>/);
  assert.ok(header.indexOf('<Segmented') < header.indexOf('<NavButton'), 'bộ chuyển nằm trên hàng điều hướng kỳ');
  // Điều hướng kỳ: nút tròn hai bên, tiêu đề ở giữa; "Tuần này" / "Về hôm nay" cùng chiều cao nên tiêu đề không nhảy khi đổi kỳ
  assert.match(header, /justify-between/); assert.match(header, /className="h-6 mt-xs justify-center"/); assert.equal((header.match(/<NavButton\b/g) ?? []).length, 2);
  // Bộ chuyển, điều hướng và lưới cùng nằm trong MỘT khung bo góc (thẳng hàng với lề màn hình); lưới không còn viền trên + dưới riêng và lề riêng
  assert.match(frame, /className="mx-xl mt-md bg-bg-surface border border-border rounded-xl p-md gap-md">(?:\s|\{\})*<CalendarHeader calendar=\{calendar\} \/>(?:\s|\{\})*<CalendarGrid\b/);
  assert.doesNotMatch(grid, /border-b\b/); assert.doesNotMatch(grid, /\bpx-xl\b/); assert.match(grid, /border-t border-divider/);
  // Segmented có hai tông; mặc định vẫn là solid nên các màn khác không đổi
  assert.match(seg, /tone\?: 'solid' \| 'soft'/); assert.match(seg, /tone = 'solid'/);
  for (const file of ['components/member/MemberScheduleTabView.tsx', 'components/coach/TeachingSummaryCard.tsx', 'components/coach/CoachChangesView.tsx']) assert.doesNotMatch(readSource(file), /tone="soft"/, file);
});

// ─── Lịch dạy HLV: cùng kiểu bộ lọc với Khám phá (một hàng "Bộ lọc" + bảng lọc + chip gỡ được) ───────────────────────────

test('shared filter pieces: the main button label follows the result count, one text set feeds every filter sheet, one sheet frame', () => {
  const app = loadApp('http://localhost/api/v1'); const { applyFilterLabel } = app.load('lib/filters');
  const classes = app.load('constants/classes').CLASS_FILTER_TEXT; const schedule = app.load('constants/schedule').SCHEDULE_FILTER_TEXT; const shared = app.load('constants/filters').FILTER_TEXT;
  // Đang tải → "Xong"; không có kết quả → câu báo; còn lại → "Xem N …" — mỗi màn dùng đơn vị riêng (lớp / buổi)
  assert.equal(applyFilterLabel(undefined, classes), 'Xong'); assert.equal(applyFilterLabel(0, classes), 'Không có lớp phù hợp'); assert.equal(applyFilterLabel(7, classes), 'Xem 7 lớp');
  assert.equal(applyFilterLabel(undefined, schedule), 'Xong'); assert.equal(applyFilterLabel(0, schedule), 'Không có buổi phù hợp'); assert.equal(applyFilterLabel(12, schedule), 'Xem 12 buổi');
  // Chữ chung (nút, "Tất cả", "Xóa bộ lọc", nhãn gỡ chip, số bộ lọc) chỉ viết ở một chỗ; hai bộ chữ riêng trải nó vào
  for (const text of [classes, schedule]) for (const key of Object.keys(shared)) assert.equal(text[key], shared[key], `chữ chung "${key}" phải lấy từ FILTER_TEXT`);
  assert.equal(shared.remove('Yoga'), 'Bỏ lọc Yoga'); assert.equal(shared.active(1), '1 bộ lọc đang bật');
  // Khung bảng lọc dùng chung: "Xóa bộ lọc" tắt khi chưa bật gì, nút chính đóng bảng; cả hai bảng lọc dựng trên khung đó
  const frame = stripComments(readSource('components/shared/FilterSheet.tsx'));
  assert.match(frame, /title=\{FILTER_TEXT\.clear\} disabled=\{activeCount === 0\} onPress=\{onClear\}/); assert.match(frame, /title=\{applyLabel\} onPress=\{onClose\}/);
  for (const file of ['components/classes/ClassFilterSheet.tsx', 'components/coach/ScheduleFilterSheet.tsx']) {
    const source = stripComments(readSource(file));
    assert.match(source, /<FilterSheet\b/, file); assert.match(source, /applyLabel=\{applyFilterLabel\(resultCount, TEXT\)\}/, file); assert.doesNotMatch(source, /\bBottomSheet\b|<Button\b/, file);
  }
});

test('Coach schedule filters: count, chips and filtering follow the web selects (class + status) and keep a chip while classes load', () => {
  const f = loadApp('http://localhost/api/v1').load('lib/scheduleFilters');
  const classes = [{ id: 'c1', name: 'Yoga Flow' }, { id: 'c2', name: 'Boxing cơ bản' }];
  // Số trên hàng "Bộ lọc" = lớp + trạng thái
  assert.equal(f.scheduleFilterCount({ classId: null, status: null }), 0); assert.equal(f.scheduleFilterCount({ classId: 'c1', status: null }), 1); assert.equal(f.scheduleFilterCount({ classId: 'c1', status: 'COMPLETED' }), 2);
  // Chip: lớp trước, trạng thái sau; tên lớp lấy từ danh sách, trạng thái dùng nhãn như web
  assert.deepEqual(f.activeScheduleFilters({ classId: null, status: null }, classes), []);
  assert.deepEqual(f.activeScheduleFilters({ classId: 'c2', status: 'SCHEDULED' }, classes), [{ key: 'class', label: 'Boxing cơ bản' }, { key: 'status', label: 'Đã lên lịch' }]);
  assert.deepEqual(f.activeScheduleFilters({ classId: null, status: 'CANCELLED' }, classes), [{ key: 'status', label: 'Đã hủy' }]);
  // Mở từ "Xem lịch dạy" của một lớp khi danh sách lớp chưa tải xong: chip vẫn hiện, bằng tên nhóm lọc
  assert.deepEqual(f.activeScheduleFilters({ classId: 'c9', status: null }, []), [{ key: 'class', label: 'Lớp học' }]);
  // Lọc buổi: đúng lớp VÀ đúng trạng thái; mục nào để trống thì không lọc theo mục đó
  const sessions = [{ id: 's1', classId: 'c1', status: 'SCHEDULED' }, { id: 's2', classId: 'c1', status: 'COMPLETED' }, { id: 's3', classId: 'c2', status: 'SCHEDULED' }, { id: 's4', classId: 'c2', status: 'CANCELLED' }];
  const ids = (state) => f.filterSchedules(sessions, state).map((s) => s.id);
  assert.deepEqual(ids({ classId: null, status: null }), ['s1', 's2', 's3', 's4']);
  assert.deepEqual(ids({ classId: 'c1', status: null }), ['s1', 's2']); assert.deepEqual(ids({ classId: null, status: 'SCHEDULED' }), ['s1', 's3']);
  assert.deepEqual(ids({ classId: 'c2', status: 'SCHEDULED' }), ['s3']); assert.deepEqual(ids({ classId: 'c1', status: 'CANCELLED' }), []);
  // Mỗi bộ lọc đếm trên hàng có đúng một chip
  const both = { classId: 'c1', status: 'COMPLETED' }; assert.equal(f.activeScheduleFilters(both, classes).length, f.scheduleFilterCount(both));
});

test('Coach schedule has one "Bộ lọc" row, a filter sheet and removable chips — the two always-visible chip rows are gone', () => {
  const view = stripComments(readSource('components/coach/CoachScheduleView.tsx')); const hook = stripComments(readSource('hooks/coach/useCoachScheduleScreen.ts'));
  // Màn chính: một hàng "Bộ lọc" (số bộ lọc đang bật) rồi chip gỡ được, đặt làm đầu danh sách buổi; bảng lọc mở từ hàng đó
  assert.match(view, /<FilterBar hint=\{SCHEDULE_FILTER_TEXT\.hint\} count=\{screen\.filterCount\} onPress=\{\(\) => setFilterOpen\(true\)\} \/>/);
  assert.match(view, /<ActiveFilterChips filters=\{screen\.activeFilters\} onRemove=\{screen\.clearFilter\} \/>/); assert.match(view, /listHeader=\{filters\}/);
  assert.ok(view.indexOf('<FilterBar') < view.indexOf('<ActiveFilterChips'));
  assert.match(view, /<ScheduleFilterSheet\b[\s\S]*?classes=\{screen\.classes\}[\s\S]*?onClear=\{screen\.clearFilters\}[\s\S]*?resultCount=\{screen\.isLoading \? undefined : screen\.sessions\.length\}/);
  // Hai hàng chip "Tất cả lớp của tôi…" / "Tất cả trạng thái…" luôn hiện đã bỏ
  assert.doesNotMatch(view, /\b(FilterChip|ChipRow)\b|SCHEDULE_STATUSES|Tất cả/);
  // Bảng lọc: một nhóm lớp (kèm "Tất cả lớp của tôi") và một nhóm trạng thái (kèm "Tất cả trạng thái")
  const sheet = stripComments(readSource('components/coach/ScheduleFilterSheet.tsx'));
  assert.match(sheet, /<FilterSection title=\{TEXT\.class\}>[\s\S]*?TEXT\.allClasses[\s\S]*?classes\.map/); assert.match(sheet, /<FilterSection title=\{TEXT\.status\}>[\s\S]*?TEXT\.allStatuses[\s\S]*?SCHEDULE_STATUSES\.map/);
  // Hook: lọc bằng lib, đếm + chip + gỡ từng chip + xóa hết; mở từ "Xem lịch dạy" của một lớp vẫn lọc sẵn lớp đó (chip hiện ngay)
  assert.match(hook, /filterSchedules\(schedules, \{ classId: classFilter, status: statusFilter \}\)/); assert.match(hook, /activeScheduleFilters\(filterState, filterClasses\)/);
  assert.match(hook, /key === 'class' \? setClassFilter\(null\) : setStatusFilter\(null\)/); assert.match(hook.slice(hook.indexOf('const clearFilters')), /setClassFilter\(null\);\s*setStatusFilter\(null\)/);
  assert.match(hook, /return \{[\s\S]*filterCount,\s*activeFilters,\s*clearFilter,\s*clearFilters,/); assert.match(hook, /useState<string \| null>\(initialClassId \|\| null\)/);
  // Hàng "Bộ lọc" trải hết bề ngang: icon tune, nhãn kèm số bộ lọc cho trình đọc màn hình, huy hiệu số chỉ khi có bộ lọc
  const bar = stripComments(readSource('components/shared/FilterBar.tsx'));
  assert.match(bar, /<Icon name="tune"/); assert.match(bar, /FILTER_TEXT\.active\(count\)/); assert.match(bar, /\{active \? \(/); assert.match(bar, /className="flex-row items-center gap-sm h-12 px-md bg-bg-surface rounded-lg border"/);
});

// ─── Thanh toán: mở app ngân hàng bằng VietQR deeplink (đủ tham số url + bn; gộp "Lưu mã QR" vào nút mở app) ───────────────

test('VietQR deeplink carries every required parameter (ba, am, tn, url) plus bn; a missing url or bank code means "not autofill"', () => {
  const v = loadApp('http://localhost/api/v1').load('lib/vietqr');
  const acb = { appId: 'acb', appName: 'ACB ONE', appLogo: '', bankName: 'ACB', monthlyInstall: 1, deeplink: 'https://dl.vietqr.io/pay?app=acb', autofill: 1 };
  const vcb = { appId: 'vcb', appName: 'VCB Digibank', appLogo: '', bankName: 'VCB', monthlyInstall: 9, deeplink: 'https://dl.vietqr.io/pay?app=vcb' };
  const info = { accountNumber: '0123456789', bankCode: 'mb', accountHolder: ' SCMS VERIFY ', amount: 100000.4, content: 'SCMS PAY 1', returnUrl: 'https://example.org/back?x=1' };
  // Đủ tham số theo tài liệu VietQR: ba, am, tn, bn, url — "@" giữ nguyên, url được mã hoá, số tiền làm tròn. Thiếu url thì dl.vietqr.io chỉ mở app trống
  // (thử bằng dữ liệu giả 2026-11-16: Android trả intent:// không kèm dữ liệu, iOS chỉ mở mbbank://) nên url không bao giờ được bỏ khi có cấu hình.
  assert.equal(v.buildBankAppDeeplink(acb, info), 'https://dl.vietqr.io/pay?app=acb&ba=0123456789@mb&am=100000&tn=SCMS%20PAY%201&bn=SCMS%20VERIFY&url=https%3A%2F%2Fexample.org%2Fback%3Fx%3D1');
  // Không có url / bn / mã ngân hàng thì không gắn tham số rỗng; deeplink chưa có "?" vẫn dựng đúng
  assert.equal(v.buildBankAppDeeplink(acb, { amount: 5, content: 'X', bankCode: null }), 'https://dl.vietqr.io/pay?app=acb&am=5&tn=X');
  assert.equal(v.buildBankAppDeeplink({ ...acb, deeplink: 'https://dl.vietqr.io/pay' }, { amount: 5, content: 'X', bankCode: null }), 'https://dl.vietqr.io/pay?am=5&tn=X');
  // Tự điền chỉ khi có cờ autofill của VietQR VÀ đủ ba, am, tn, url; thiếu một thứ thì app chỉ được mở trống nên đi đường quét ảnh QR
  assert.equal(v.isAutofillReady(acb, info), true);
  assert.equal(v.isAutofillReady(vcb, info), false);
  for (const missing of [{ returnUrl: null }, { returnUrl: undefined }, { bankCode: null }, { accountNumber: '' }, { content: '' }, { amount: 0 }]) assert.equal(v.isAutofillReady(acb, { ...info, ...missing }), false, JSON.stringify(missing));
});

test('the return url sent to VietQR must be https: a configured value wins, otherwise the API origin', () => {
  const { resolvePaymentReturnUrl: resolve } = loadApp('http://localhost/api/v1').load('lib/vietqr');
  const api = 'https://sports-center-management-system.onrender.com/api/v1'; const origin = 'https://sports-center-management-system.onrender.com';
  assert.equal(resolve(undefined, api), origin); assert.equal(resolve('', api), origin); assert.equal(resolve('   ', api), origin);
  assert.equal(resolve(' https://scms.example.vn/member/membership?from=app ', api), 'https://scms.example.vn/member/membership?from=app');
  // Scheme riêng của app, http, tên miền trần hay chuỗi bậy đều bị VietQR từ chối như thiếu url → rơi về địa chỉ gốc của API
  for (const bad of ['pulsecenter://payment', 'http://scms.example.vn', 'scms.example.vn', 'https://', 'not a url']) assert.equal(resolve(bad, api), origin, bad);
  assert.equal(resolve(undefined, 'https://api.example.vn:8443/api/v1'), 'https://api.example.vn:8443');
  // Không có địa chỉ https nào (vd. đang chạy với BE trong mạng LAN) → null: app ngân hàng sẽ không tự điền
  assert.equal(resolve(undefined, undefined), null); assert.equal(resolve(undefined, 'http://192.168.1.5:8080/api/v1'), null); assert.equal(resolve('pulsecenter://x', 'http://localhost:8080/api/v1'), null);
});

test('bank apps: BE bank ids map to VietQR codes and autofill apps are listed first', () => {
  const v = loadApp('http://localhost/api/v1').load('lib/vietqr');
  const banks = [{ code: 'STB', bin: '970403', shortName: 'Sacombank', name: 'Sacombank' }, { code: 'MB', bin: '970422', shortName: 'MBBank', name: 'MB' }, { code: 'VCB', bin: '970436', shortName: 'Vietcombank', name: 'VCB' }];
  assert.equal(v.resolveVietQrBankCode('SACOMBANK', banks), 'stb'); assert.equal(v.resolveVietQrBankCode('970422', banks), 'mb'); assert.equal(v.resolveVietQrBankCode('Vietcombank', banks), 'vcb');
  assert.equal(v.resolveVietQrBankCode('UNKNOWN', banks), null); assert.equal(v.resolveVietQrBankCode(undefined, banks), null);
  const apps = [{ appId: 'a', monthlyInstall: 100 }, { appId: 'b', monthlyInstall: 10, autofill: 1 }, { appId: 'c', monthlyInstall: 50, autofill: 1 }, { appId: 'd', monthlyInstall: 500 }];
  assert.deepEqual(v.sortBankApps(apps).map((a) => a.appId), ['c', 'b', 'd', 'a']); assert.deepEqual(apps.map((a) => a.appId), ['a', 'b', 'c', 'd'], 'không đổi mảng gốc');
});

test('opening a bank app: autofill apps open straight away; the others copy the transfer content, save the QR once and tell the user what to do', async () => {
  globalThis.__DEV__ = false; // constants/payment đọc cờ __DEV__ của React Native
  try {
    const l = loadApp('http://localhost/api/v1').load('lib/bankAppLaunch'); const calls = [];
    const deps = (over = {}) => ({ autofill: false, qrSaved: false, copyContent: async () => { calls.push('copy'); }, saveQr: async () => { calls.push('save'); return 'saved'; }, ...over });
    // App tự điền: không chuẩn bị gì, mở deeplink là có sẵn số tiền + nội dung
    assert.equal(await l.prepareBankAppLaunch(deps({ autofill: true })), null); assert.deepEqual(calls.splice(0), []);
    // App khác: sao chép nội dung TRƯỚC, rồi lưu ảnh QR — một lần chạm thay cho "Lưu mã QR" rồi "Mở app"
    assert.equal(await l.prepareBankAppLaunch(deps()), 'saved'); assert.deepEqual(calls.splice(0), ['copy', 'save']);
    // Đã lưu ảnh của đơn này: vẫn sao chép nhưng không lưu lại (thư viện ảnh không bị trùng khi chọn app khác)
    assert.equal(await l.prepareBankAppLaunch(deps({ qrSaved: true })), 'saved'); assert.deepEqual(calls.splice(0), ['copy']);
    // Lưu thất bại (thiếu quyền, cần build lại, lỗi khác): trả lại lý do, nội dung chuyển khoản đã được sao chép
    for (const reason of ['denied', 'unavailable', 'failed']) {
      assert.equal(await l.prepareBankAppLaunch(deps({ saveQr: async () => { calls.push('save'); return reason; } })), reason); assert.deepEqual(calls.splice(0), ['copy', 'save']);
    }
    // Hộp thoại trước khi rời app: hướng dẫn quét ảnh vừa lưu, hoặc lý do chưa lưu được (vẫn cho mở app để nhập tay)
    const saved = l.bankAppLaunchNotice('VCB Digibank', 'saved');
    assert.deepEqual([saved.title, saved.confirmText], ['Đã lưu mã QR', 'Mở VCB Digibank']); assert.match(saved.message, /VCB Digibank chọn Quét QR → Chọn ảnh vừa lưu/); assert.match(saved.message, /đã được sao chép/);
    const denied = l.bankAppLaunchNotice('VCB Digibank', 'denied');
    assert.deepEqual([denied.title, denied.confirmText], ['Chưa lưu được mã QR', 'Vẫn mở app']); assert.match(denied.message, /quyền lưu ảnh/);
    for (const reason of ['unavailable', 'denied', 'failed', 'opened']) assert.match(l.bankAppLaunchNotice('X', reason).message, /đã được sao chép — bạn có thể nhập tay/, reason);
    // Nút "Lưu mã QR" riêng: mỗi kết quả một lời nhắn; web (đã mở ảnh ở tab mới) không báo gì
    assert.deepEqual(['saved', 'denied', 'unavailable', 'failed'].map((r) => l.saveQrNotice(r).title), ['Đã lưu mã QR', 'Chưa có quyền lưu ảnh', 'Cần cập nhật ứng dụng', 'Không lưu được mã QR']); assert.equal(l.saveQrNotice('opened'), null);
  } finally { delete globalThis.__DEV__; }
});

test('payment screen wiring: the flow hook owns the bank-app steps, the picker has no separate save button, the return url comes from config', () => {
  const view = stripComments(readSource('components/member/payment/SepayPaymentView.tsx')); const hook = stripComments(readSource('hooks/member/usePayment.ts'));
  const picker = stripComments(readSource('components/member/payment/BankAppPickerModal.tsx')); const apps = stripComments(readSource('hooks/member/useBankApps.ts'));
  // View mỏng: không tự gọi useBankApps, chỉ gọi flow.prepareBankApp rồi hiện hộp thoại; bảng chọn chỉ đóng SAU khi người dùng đồng ý mở app
  // (hộp thoại không phải hiện đúng lúc bảng đang đóng — iOS bỏ qua Modal mở chồng lên Modal đang đóng)
  assert.doesNotMatch(view, /useBankApps\(/); assert.match(view, /flow\.prepareBankApp\(app\)/); assert.match(view, /bankAppLaunchNotice\(appName, launch\.qr\)/); assert.match(view, /showConfirm\(notice\.title, notice\.message/);
  assert.match(view, /const open = async \(\) => \{\s*setPickerOpen\(false\);/); assert.match(view, /isAutofill=\{bankApps\.canAutofill\}/); assert.match(view, /isPreparing=\{flow\.isSavingQr\}/);
  // Bảng chọn: chọn app là tự lưu QR nên không còn nút "Lưu mã QR" riêng; nhãn Tự điền / Quét QR theo isAutofill; khóa danh sách khi đang chuẩn bị
  assert.doesNotMatch(picker, /onSaveQr|Lưu mã QR/); assert.match(picker, /isAutofill\(item\)/); assert.match(picker, /disabled=\{isPreparing\}/);
  // Hook thanh toán: nhớ đã lưu ảnh của đơn để không lưu trùng; sao chép nội dung chuyển khoản trước khi mở app
  assert.match(hook, /useBankApps\(checkout\)/); assert.match(hook, /if \(result === 'saved'\) setQrSaved\(true\)/);
  assert.match(hook, /prepareBankAppLaunch\(\{ autofill, qrSaved, copyContent: \(\) => copyToClipboard\(checkout\.transferContent\), saveQr \}\)/); assert.match(hook, /return \{[\s\S]*bankApps,\s*prepareBankApp,/);
  // Deeplink: đủ thông tin chuyển khoản + url "quay lại" lấy từ cấu hình EXPO_PUBLIC_PAYMENT_RETURN_URL (hoặc địa chỉ gốc của API)
  assert.match(apps, /resolvePaymentReturnUrl\(PAYMENT_RETURN_URL_ENV, BASE_URL\)/); assert.match(apps, /accountHolder: checkout\.bank\?\.accountHolder/); assert.match(apps, /returnUrl: RETURN_URL/);
  assert.match(readSource('constants/payment.ts'), /PAYMENT_RETURN_URL_ENV = process\.env\.EXPO_PUBLIC_PAYMENT_RETURN_URL/); assert.match(readSource('.env.example'), /^EXPO_PUBLIC_PAYMENT_RETURN_URL=\s*$/m);
});

// ─── Bản build EAS: biến môi trường ──────────────────────────────────────────────────────────────────────────────────

test('EAS builds load their own EAS environment, and the README lists every EXPO_PUBLIC variable the app reads, because EAS never sees .env', () => {
  const eas = JSON.parse(readSource('eas.json'));
  // Mỗi profile build nạp biến của môi trường EAS cùng tên (development / preview / production)
  for (const profile of ['development', 'preview', 'production']) assert.equal(eas.build[profile].environment, profile, `profile ${profile}`);

  // Mọi biến EXPO_PUBLIC_* mà code đọc (kể cả app.config.js lúc build) phải có trong README mục 3.2; nếu không, bản build thiếu biến
  // (vd. thiếu EXPO_PUBLIC_API_BASE_URL thì app báo lỗi ngay khi mở) mà không ai biết cần khai báo trên EAS
  const used = new Set();
  const collect = (source) => { for (const match of stripComments(source).matchAll(/process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g)) used.add(match[1]); };
  for (const { source } of sourceFilesUnder('lib', 'constants', 'hooks', 'services', 'components', 'context', 'app', 'navigation')) collect(source);
  collect(readSource('app.config.js'));
  const readme = readSource('README.md');
  const easSection = readme.slice(readme.indexOf('### 3.2.'), readme.indexOf('### 4.'));
  assert.ok(used.size >= 6, 'quét được các biến đang dùng');
  const undocumented = [...used].filter((name) => !easSection.includes(`\`${name}\``));
  assert.deepEqual(undocumented, [], 'biến chưa được liệt kê ở README mục 3.2: ' + undocumented.join(', '));
  // Lệnh của EAS CLI hiện tại là env:set (env:create không còn); EXPO_TOKEN không bao giờ đưa lên EAS
  assert.match(easSection, /eas env:set /); assert.doesNotMatch(readme, /eas env:create/);
  assert.match(easSection, /`EXPO_TOKEN` chỉ dùng cho CLI trên máy/);
  // .env.example nhắc rằng bản build trên EAS không đọc file này
  assert.match(readSource('.env.example'), /Bản build trên EAS không đọc \.env/);
});

// ─── Sửa lỗi sau khi đồng bộ code mới nhất của web/BE (2026-11-17) ────────────────────────────────────────────────

test('refund estimate follows the collected payment and treats a started SCHEDULED plan as active, like the web and the BE', () => {
  const rules = loadApp('http://localhost/api/v1').load('lib/businessRules');
  const DAY = 86_400_000; const now = Date.parse('2026-11-17T00:00:00Z'); const iso = (ms) => new Date(ms).toISOString();
  const active = { status: 'ACTIVE', startDate: iso(now - 10 * DAY), endDate: iso(now + 40 * DAY), priceSnapshot: '300000', plan: { price: '300000' } };
  // Khoản gốc là khoản ĐÃ THU (giao dịch SUCCESS), không phải giá gói: hội viên trả 250.000 thì 30% là 75.000
  assert.equal(rules.cancelRefundBase({ ...active, payments: [{ amount: '250000', status: 'SUCCESS' }] }), 250000);
  assert.deepEqual(rules.cancelRefundEstimate({ ...active, payments: [{ amount: '250000', status: 'SUCCESS' }] }, now), { daysLeft: 40, refundAmount: 75000, willRefund: true });
  // Có danh sách giao dịch nhưng chưa thu khoản nào thì không có gì để hoàn; không có danh sách thì lấy giá lúc mua rồi giá gói
  assert.equal(rules.cancelRefundBase({ ...active, payments: [{ amount: '300000', status: 'PENDING' }] }), 0);
  assert.equal(rules.cancelRefundBase({ ...active, payments: [] }), 0);
  assert.equal(rules.cancelRefundBase(active), 300000);
  assert.equal(rules.cancelRefundBase({ endDate: active.endDate, plan: { price: '120000' } }), 120000);
  // Gói chờ kích hoạt còn ở tương lai: hoàn 100% khoản đã thu; ngày bắt đầu đã qua thì hệ thống sắp kích hoạt nên tính như gói đang dùng
  const future = { status: 'SCHEDULED', startDate: iso(now + 5 * DAY), endDate: iso(now + 200 * DAY), payments: [{ amount: '1500000', status: 'SUCCESS' }] };
  assert.equal(rules.cancelKindOf(future, now), 'SCHEDULED');
  assert.deepEqual(rules.cancelRefundEstimate(future, now), { daysLeft: 0, refundAmount: 1500000, willRefund: true });
  const started = { ...future, startDate: iso(now - DAY) };
  assert.equal(rules.cancelKindOf(started, now), 'ACTIVE');
  assert.deepEqual(rules.cancelRefundEstimate(started, now), { daysLeft: 200, refundAmount: 450000, willRefund: true });
  assert.equal(rules.cancelKindOf({ status: 'SCHEDULED' }, now), 'SCHEDULED', 'thiếu ngày bắt đầu thì coi là chờ kích hoạt');
  // BE trả sẵn `payments` ở GET /subscriptions/member/:id nên kiểu của gói phải có trường này
  assert.match(readSource('lib/types.ts'), /payments\?: Array<\{ amount: string \| number; status: string \}>/);
});

test('a payment that arrives late shows the late-payment wording like the web, never the raw reason code', () => {
  const app = loadApp('http://localhost/api/v1'); const pay = app.load('lib/payment'); const text = app.load('constants/sepayReview');
  const checkout = { orderCode: 'SC123', activationStatus: 'REQUIRES_REVIEW' };
  const late = pay.reviewMessage({ ...checkout, reviewReason: 'LATE_PAYMENT' });
  assert.match(late, /sau khi đơn hết hạn hoặc đã đóng/); assert.match(late, /đối soát hoàn tiền/); assert.ok(late.includes('SC123')); assert.ok(!late.includes('LATE_PAYMENT'));
  // Lý do khác: câu chung kèm ghi chú của BE; không có lý do: chỉ câu chung
  assert.equal(pay.reviewMessage({ ...checkout, reviewReason: 'MANUAL_CHECK' }), 'Trung tâm đã nhận tiền cho đơn SC123. Gói chưa được kích hoạt; vui lòng giữ biên lai và liên hệ trung tâm. Ghi chú: MANUAL_CHECK');
  assert.equal(pay.reviewMessage({ ...checkout, reviewReason: null }), text.SEPAY_REVIEW_TEXT.notActivated('SC123'));
  assert.equal(text.SEPAY_LATE_PAYMENT_REASON, 'LATE_PAYMENT');
  // Bảng đối soát dùng hàm này thay vì tự ghép chữ
  const panel = stripComments(readSource('components/member/payment/SepayReviewPanel.tsx'));
  assert.match(panel, /reviewMessage\(checkout\)/); assert.ok(!/Ghi chú: \$\{/.test(panel));
});

test('a pressable card never wraps another pressable, and the member attendance history never prints the raw system marker', () => {
  // Nút chỉ để nhìn (asLabel) khi nằm trong thẻ bấm được: nút lồng nút là HTML không hợp lệ trên web
  const button = stripComments(readSource('components/ui/Button.tsx'));
  assert.match(button, /asLabel: true; onPress\?: never/); assert.match(button, /if \(mode\.asLabel\) return <View className=\{classes\}>/);
  const next = stripComments(readSource('components/member/home/NextSessionCard.tsx'));
  assert.match(next, /<Card accent=\{Colors\.primary\} className="mb-lg" onPress=\{open\}/); assert.match(next, /<Button\s+asLabel\b/);
  assert.ok(!/<Button[^>]*onPress=\{open\}/.test(next), 'thẻ đã bấm được nên nút bên trong không tự bấm');
  // Lịch sử điểm danh: ghi chú do hệ thống tự đặt hiện bằng câu dễ hiểu
  const view = stripComments(readSource('components/member/attendance/MyAttendanceView.tsx'));
  assert.match(view, /displayAttendanceNote\(r\.note\)/); assert.ok(!/\{r\.note\}/.test(view), 'không in ghi chú thô');
  const note = loadApp('http://localhost/api/v1').load('lib/attendanceNote');
  assert.equal(note.displayAttendanceNote('SYSTEM_NO_SHOW'), 'Hệ thống tự ghi vắng vì chưa điểm danh');
  assert.equal(note.displayAttendanceNote('  Đến muộn 5 phút '), 'Đến muộn 5 phút'); assert.equal(note.displayAttendanceNote('   '), null);
});

// ─── Vuốt từ trái sang phải ở phía HLV: danh sách học viên / điểm danh của một buổi là màn con, không phải nội dung đổi ngay trong tab ──────

test('the coach roster (students + attendance of one session) is a stack screen over the tabs, so every way into it swipes back to where it came from', () => {
  const { ROUTES, canAccessRoute } = loadApp('http://localhost/api/v1').load('navigation/routes');
  // Đích là màn con của khu vực coach (Stack có vuốt quay lại), không phải tab: chuyển giữa các tab không "đẩy" màn hình nên không có trang trước để vuốt về
  // (Lịch dạy → Điểm danh, Trang chủ → Điểm danh…). Tab Điểm danh vẫn là danh sách buổi để chọn.
  assert.deepEqual(ROUTES.coachAttendanceFor('s1'), { pathname: '/coach/attendance/[scheduleId]', params: { scheduleId: 's1' } });
  assert.equal(ROUTES.coachAttendance, '/(tabs)/coach-attendance');
  assert.ok(fs.existsSync(path.resolve(__dirname, '../app/coach/attendance/[scheduleId].tsx')));
  assert.equal(canAccessRoute('COACH', ['coach', 'attendance', '[scheduleId]']), true); assert.equal(canAccessRoute('MEMBER', ['coach', 'attendance', '[scheduleId]']), false);
  const route = stripComments(readSource('app/coach/attendance/[scheduleId].tsx'));
  assert.match(route, /<CoachRosterView scheduleId=\{scheduleId\} \/>/); assert.ok(!/useQuery|apiRequest/.test(route), 'route chỉ render một View');
  // Tab Điểm danh: chỉ chọn buổi — chọn là ĐẨY màn danh sách học viên, không đổi nội dung ngay trong tab (không có nút quay lại giả trong tab)
  const list = stripComments(readSource('components/coach/CoachAttendanceView.tsx'));
  assert.match(list, /router\.push\(ROUTES\.coachAttendanceFor\(item\.id\)\)/); assert.match(list, /variant="tab"/); assert.doesNotMatch(list, /onBackPress|setParams|hasSelection|selectSchedule/);
  // Màn danh sách học viên: nút quay lại là quay lại thật; mở thẳng bằng đường dẫn (không có màn trước) thì về tab Điểm danh; không còn chọn buổi bằng state
  const roster = stripComments(readSource('components/coach/CoachRosterView.tsx'));
  assert.match(roster, /if \(router\.canGoBack\(\)\) router\.back\(\);\s*else router\.replace\(ROUTES\.coachAttendance\);/); assert.match(roster, /onBackPress=\{goBack\}/); assert.doesNotMatch(roster, /variant="tab"|setParams/);
  const hook = stripComments(readSource('hooks/coach/useCoachAttendance.ts'));
  assert.match(hook, /export function useCoachAttendance\(scheduleId: string \| undefined\)/); assert.doesNotMatch(hook, /selectedId|setSelectedId|initialScheduleId|selectSchedule/);
  assert.match(stripComments(readSource('hooks/coach/useCoachAttendanceList.ts')), /s\.status !== 'CANCELLED'/);
  // Mọi lối vào danh sách học viên của một buổi đều đi qua route này: Lịch dạy, Trang chủ, chi tiết buổi, chi tiết lớp
  for (const file of ['components/coach/CoachScheduleView.tsx', 'components/coach/CoachHomeView.tsx', 'components/coach/CoachScheduleActions.tsx', 'components/classes/ClassDetailView.tsx']) assert.match(readSource(file), /router\.push\(ROUTES\.coachAttendanceFor\(/, file);
  // Màn này nằm dưới app/coach, mà layout coach (test vuốt quay lại ở trên đã quét) rải SWIPE_BACK_OPTIONS
  assert.match(readSource('app/coach/_layout.tsx'), /\.\.\.SWIPE_BACK_OPTIONS/);
});

test('a tab never hosts a sub-page: views rendered by the tab routes have no in-screen back handler (a back arrow there needs a stack screen to swipe back)', () => {
  const tabsDir = path.resolve(__dirname, '../app/(tabs)');
  const files = fs.readdirSync(tabsDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.tsx')).map((e) => e.name);
  assert.ok(files.includes('coach-attendance.tsx') && files.includes('schedule.tsx') && files.length >= 6, 'quét đủ các tab: ' + files.join(', '));
  // Nút quay lại tự xử lý (onBackPress) trong một màn của tab nghĩa là màn con đang giả lập bằng state: vuốt từ trái sang phải sẽ không làm gì.
  // Màn con phải là màn của Stack (app/coach, app/chat, app/(tabs)/account/…), mở bằng router.push.
  const offenders = [];
  for (const name of files) {
    const code = stripComments(fs.readFileSync(path.join(tabsDir, name), 'utf8'));
    for (const [, spec] of code.matchAll(/from '(\.\.\/\.\.\/components\/[^']+)'/g)) {
      const view = path.resolve(tabsDir, `${spec}.tsx`);
      if (fs.existsSync(view) && /onBackPress=/.test(stripComments(fs.readFileSync(view, 'utf8')))) offenders.push(`${name} → ${path.relative(path.resolve(__dirname, '..'), view).replaceAll('\\', '/')}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// ─── Hoàn tiền giao dịch, giáo án tập luyện, mốc hết hạn của gói (đối chiếu web sau c072dec / 25643ca) ──────────────────

test('refund request: the web payload and result, who may ask, the reason rule, and the greeting for the receptionist is the web sentence', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('member-token', 'refresh'); await api.setFacilityId('facility-a');
  handle(() => ({ message: 'Đã ghi nhận yêu cầu hoàn tiền.', data: { id: 'payment-1', status: 'SUCCESS', refundRequestedAt: '2027-01-01T00:00:00Z', refundRequestedAmount: '90000', refundReceptionist: { id: 'rec-1', fullName: 'Lễ tân A' } } }));
  const res = await load('services/workflowService').requestPaymentRefund('payment-1', 'Không còn nhu cầu');
  assert.deepEqual([requests[0].method, requests[0].path, requests[0].body], ['POST', '/api/v1/payments/payment-1/refund/request', { reason: 'Không còn nhu cầu' }]);
  assert.equal(requests[0].headers['x-facility-id'], 'facility-a');
  assert.equal(res.message, 'Đã ghi nhận yêu cầu hoàn tiền.'); assert.deepEqual(res.data.refundReceptionist, { id: 'rec-1', fullName: 'Lễ tân A' });

  const refund = load('lib/refund'); const c = load('constants/refund');
  const invoice = (payment, paymentId = 'payment-1') => ({ paymentId, payment });
  const asked = { status: 'SUCCESS', refundRequestedAt: '2027-01-01T00:00:00Z' };
  assert.equal(refund.canRequestRefund(invoice({ status: 'SUCCESS' })), true);
  assert.equal(refund.canRequestRefund(invoice(asked)), false, 'đã gửi yêu cầu thì không gửi lại');
  assert.equal(refund.canRequestRefund(invoice({ status: 'PENDING' })), false); assert.equal(refund.canRequestRefund(invoice({ status: 'REFUNDED' })), false);
  assert.equal(refund.canRequestRefund(invoice({ status: 'SUCCESS' }, null)), false, 'hóa đơn không gắn giao dịch'); assert.equal(refund.canRequestRefund({ paymentId: 'payment-1' }), false);
  assert.equal(refund.hasRefundRequest(invoice(asked)), true); assert.equal(refund.hasRefundRequest(invoice({ status: 'SUCCESS' })), false);
  // Lý do: sau khi cắt khoảng trắng còn ít nhất 3 ký tự, tối đa 1000 (BE)
  assert.deepEqual([c.REFUND_REASON_MIN_LENGTH, c.REFUND_REASON_MAX_LENGTH], [3, 1000]);
  assert.deepEqual(['  ab  ', '   ', '  abc '].map(refund.isRefundReasonValid), [false, false, true]);
  // Câu chào soạn sẵn đúng từng chữ như web (refundChatPath); thiếu tên thì gọi chung là "lễ tân"
  assert.equal(refund.refundChatDraft('Lễ tân A', '1234567890abcdef'), 'Chào Lễ tân A, tôi muốn trao đổi về yêu cầu hoàn tiền mã giao dịch #12345678. Nhờ bạn hỗ trợ.');
  assert.match(refund.refundChatDraft(undefined, 'abcdefgh1'), /^Chào lễ tân, /);
  // BE hủy gói gắn với giao dịch ngay khi nhận yêu cầu → gói, lớp, lịch và thông báo cũng phải tải lại
  for (const key of ['member-invoices', 'payment-record', 'subscriptions', 'my-enrollments', 'course-plan', 'member-schedule', 'notifications']) assert.ok(c.REFUND_REFRESH_KEYS.includes(key), key);
  assert.match(c.REFUND_TEXT.policy(c.REFUND_POLICY_DAYS), /trên 15 ngày sử dụng/);

  const payments = stripComments(readSource('components/member/PaymentsView.tsx'));
  assert.match(payments, /canRequestRefund\(invoice\)/); assert.match(payments, /<RefundRequestSheet refund=\{refund\} onChat=\{chatWithReceptionist\} \/>/);
  assert.match(payments, /ROUTES\.chatThread\(receptionist\.id, receptionist\.fullName, refundChatDraft\(/);
  const hook = stripComments(readSource('hooks/member/useRefundRequest.ts'));
  assert.match(hook, /requestPaymentRefund\(input\.paymentId, input\.reason\)/); assert.match(hook, /REFUND_REFRESH_KEYS/); assert.match(hook, /if \(!mutation\.isPending\) setTarget\(null\)/);
  assert.match(readSource('components/member/PaymentDetailView.tsx'), /payment\?\.refundRequestedAt/);
}));

test('a refund notification for the member opens the chat with the receptionist and the greeting filled in; training plan notifications open the class', () => {
  const app = loadApp('http://localhost/api/v1'); const nav = app.load('navigation/notificationRoute'); const { ROUTES } = app.load('navigation/routes');
  const note = (type, metadata) => ({ id: 'n', userId: 'u', type, title: '', body: '', isRead: false, createdAt: '', metadata });
  const assigned = note('PAYMENT_REFUNDED', { action: 'REFUND_ASSIGNED', receptionistUserId: 'rec-1', receptionistName: 'Lễ tân A', paymentId: '1234567890abcdef' });
  const target = nav.resolveNotificationTarget(assigned, 'MEMBER');
  assert.deepEqual([target.kind, nav.notificationActionLabel(target.kind, 'MEMBER')], ['refundChat', 'Nhắn tin với lễ tân']);
  assert.deepEqual(target.route, { pathname: '/chat/[userId]', params: { userId: 'rec-1', name: 'Lễ tân A', message: 'Chào Lễ tân A, tôi muốn trao đổi về yêu cầu hoàn tiền mã giao dịch #12345678. Nhờ bạn hỗ trợ.' } });
  // Thiếu lễ tân, thông báo hoàn tiền khác hoặc không phải hội viên: về màn Thanh toán như trước
  for (const [item, role] of [[note('PAYMENT_REFUNDED', { action: 'REFUND_ASSIGNED', paymentId: 'p' }), 'MEMBER'], [note('PAYMENT_REFUNDED', { action: 'REFUND_NO_RECEPTIONIST' }), 'MEMBER'], [note('PAYMENT_REFUNDED'), 'MEMBER'], [assigned, 'COACH']]) {
    assert.deepEqual([nav.resolveNotificationTarget(item, role).kind, nav.resolveNotificationRoute(item, role)], ['payments', ROUTES.payments]);
  }
  // Giáo án mới: thẻ "Giáo án tập luyện" nằm ở chi tiết lớp
  const plan = nav.resolveNotificationTarget(note('TRAINING_PLAN_ASSIGNED', { classId: 'class-1', trainingPlanId: 'plan-1' }), 'MEMBER');
  assert.deepEqual([plan.kind, nav.notificationActionLabel(plan.kind, 'MEMBER'), plan.route], ['class', 'Xem lớp học', ROUTES.classDetail('class-1')]);
  assert.equal(nav.resolveNotificationTarget(note('TRAINING_PLAN_ASSIGNED'), 'MEMBER'), null);
  // Tin soạn sẵn đi theo đường dẫn chat và nằm sẵn trong ô soạn (web: ?userId=…&message=…)
  assert.deepEqual(ROUTES.chatThread('u2'), { pathname: '/chat/[userId]', params: { userId: 'u2' } });
  assert.deepEqual(ROUTES.chatThread('u2', 'An', 'Xin chào'), { pathname: '/chat/[userId]', params: { userId: 'u2', name: 'An', message: 'Xin chào' } });
  assert.match(readSource('app/chat/[userId].tsx'), /draft=\{message\}/);
  assert.match(readSource('components/chat/ChatThreadView.tsx'), /useChatComposer\(handleSend, user, draft\)/);
  assert.match(readSource('hooks/shared/useChatComposer.ts'), /useState\(initialText\)/); assert.match(readSource('hooks/shared/useChatComposer.ts'), /useRef\(initialText\)/);
});

test('training plans: the web endpoints and payloads, the form follows the BE limits, and only enrolled members / assigned coaches see them', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('coach-token', 'refresh'); await api.setFacilityId('facility-a');
  const svc = load('services/trainingPlanService'); const lib = load('lib/trainingPlans'); const c = load('constants/trainingPlans');
  handle(() => ({ data: { plans: [], members: [{ id: 'm1', name: 'An' }] } }));
  const list = await svc.getTrainingPlans('class-1');
  assert.deepEqual([requests[0].method, requests[0].path], ['GET', '/api/v1/classes/class-1/training-plans']); assert.equal(list.data.members[0].name, 'An');

  const form = { memberId: '', title: '  Khởi động  ', instructions: ' Chạy nhẹ 10 phút ', homework: '   ' };
  handle(() => ({ data: { id: 'plan-1' } }));
  await svc.createTrainingPlan('class-1', lib.createPlanBody(form));
  assert.deepEqual([requests.at(-1).method, requests.at(-1).path, requests.at(-1).body], ['POST', '/api/v1/classes/class-1/training-plans', { title: 'Khởi động', instructions: 'Chạy nhẹ 10 phút', homework: null, memberId: null }]);
  await svc.createTrainingPlan('class-1', lib.createPlanBody({ ...form, memberId: 'm1', homework: ' Giãn cơ ' }));
  assert.deepEqual(requests.at(-1).body, { title: 'Khởi động', instructions: 'Chạy nhẹ 10 phút', homework: 'Giãn cơ', memberId: 'm1' });
  await svc.updateTrainingPlan('class-1', 'plan-1', lib.updatePlanBody({ ...form, memberId: 'm1' }));
  assert.deepEqual([requests.at(-1).method, requests.at(-1).path], ['PATCH', '/api/v1/classes/class-1/training-plans/plan-1']);
  assert.ok(!('memberId' in requests.at(-1).body), 'sửa giáo án không đổi người nhận');
  handle(() => ({ data: { draft: 'Bản nháp' } }));
  const draft = await svc.suggestTrainingPlan('class-1', { memberId: null, objective: 'Tăng sức bền' });
  assert.deepEqual([requests.at(-1).method, requests.at(-1).path, requests.at(-1).body], ['POST', '/api/v1/classes/class-1/training-plans/suggest', { memberId: null, objective: 'Tăng sức bền' }]);
  assert.equal(draft.data.draft, 'Bản nháp');
  assert.ok(requests.every((r) => r.headers['x-facility-id'] === 'facility-a'));

  // Giới hạn như BE; ô trống chưa báo đỏ nhưng chưa cho giao
  assert.deepEqual(c.TRAINING_PLAN_LIMITS, { titleMin: 2, titleMax: 120, instructionsMin: 3, instructionsMax: 6000, homeworkMax: 3000, objectiveMax: 300 });
  const filled = { memberId: '', title: 'ab', instructions: 'abc', homework: '' };
  assert.equal(lib.canSubmitTrainingPlan(filled), true);
  assert.equal(lib.canSubmitTrainingPlan({ ...filled, title: ' a ' }), false, 'tiêu đề cần ≥ 2 ký tự sau khi cắt khoảng trắng');
  assert.equal(lib.canSubmitTrainingPlan({ ...filled, instructions: ' ab ' }), false, 'nội dung cần ≥ 3 ký tự sau khi cắt khoảng trắng');
  assert.deepEqual(lib.trainingPlanErrors(lib.EMPTY_TRAINING_PLAN_FORM), {}); assert.equal(lib.canSubmitTrainingPlan(lib.EMPTY_TRAINING_PLAN_FORM), false);
  assert.deepEqual(Object.keys(lib.trainingPlanErrors({ ...filled, title: 'a', instructions: 'ab' })), ['title', 'instructions']);
  // Nhãn người nhận; sửa giáo án điền lại đúng form cũ
  assert.equal(lib.planTargetLabel({ memberId: null }), 'Giáo án cả lớp'); assert.equal(lib.planTargetLabel({ memberId: 'm1', member: { user: { fullName: 'An' } } }), 'An'); assert.equal(lib.planTargetLabel({ memberId: 'm1' }), 'Giáo án cá nhân');
  assert.deepEqual([lib.recipientLabel('', list.data.members), lib.recipientLabel('m1', list.data.members)], ['cả lớp', 'An']);
  assert.deepEqual(lib.planToForm({ id: 'p', memberId: null, title: 'T', instructions: 'I', homework: null }), { memberId: '', title: 'T', instructions: 'I', homework: '' });

  // Ai thấy: HLV chỉ khi được phân công lớp; hội viên khi đã có mục tiêu của khóa hoặc còn buổi sắp tới đã đặt (web: classGoalQuery.data || upcomingBooking)
  assert.deepEqual([lib.isAssignedCoach('coach-1', { coaches: [{ coachId: 'coach-1' }] }), lib.isAssignedCoach('coach-2', { coaches: [{ coachId: 'coach-1' }] }), lib.isAssignedCoach(undefined, { coaches: [{ coachId: 'coach-1' }] })], [true, false, false]);
  const now = Date.parse('2027-01-01T00:00:00Z'); const session = (myEnrollmentStatus, startTime) => ({ myEnrollmentStatus, startTime });
  assert.equal(lib.memberSeesTrainingPlans(true, undefined, now), true);
  assert.equal(lib.memberSeesTrainingPlans(false, [session('BOOKED', '2027-01-02T00:00:00Z')], now), true);
  assert.equal(lib.memberSeesTrainingPlans(false, [session('BOOKED', '2026-12-31T00:00:00Z')], now), false, 'buổi đã qua không tính');
  assert.equal(lib.memberSeesTrainingPlans(false, [session(null, '2027-01-02T00:00:00Z')], now), false, 'chưa đăng ký');
  assert.equal(lib.memberSeesTrainingPlans(false, undefined, now), false);

  // Gắn vào chi tiết lớp: hội viên ngay sau mục tiêu & tiến độ (như web), HLV dưới các buổi dạy sắp tới
  const detail = stripComments(readSource('components/classes/ClassDetailView.tsx'));
  assert.match(detail, /d\.isMember && d\.trainingPlansVisible && <TrainingPlansSection classId=\{id\} coach=\{false\} \/>/);
  assert.match(detail, /d\.trainingPlansVisible && <TrainingPlansSection classId=\{id\} coach \/>/);
  assert.ok(detail.indexOf('<ClassGoalCard') < detail.indexOf('<TrainingPlansSection'), 'giáo án nằm sau mục tiêu & tiến độ');
  const section = stripComments(readSource('components/classes/TrainingPlansSection.tsx'));
  assert.match(section, /plan\.editable && onEdit/); assert.match(section, /coach \? <TrainingPlanSheet/); assert.match(section, /onEdit=\{coach \? editor\.openEdit : undefined\}/);
  assert.match(stripComments(readSource('hooks/shared/useClassDetail.ts')), /isAssignedCoach\(user\?\.coachProfile\?\.id, cls\.data\?\.data\)/);
  // Đăng ký lớp xong thì giáo án của lớp được tải lại (web: invalidate ["training-plans", classId])
  assert.match(readSource('hooks/member/useEnrollments.ts'), /'my-class-goal', 'training-plans'/);
  const editor = stripComments(readSource('hooks/shared/useTrainingPlans.ts'));
  assert.match(editor, /updateTrainingPlan\(classId, editingId, updatePlanBody\(form\)\)/); assert.match(editor, /createTrainingPlan\(classId, createPlanBody\(form\)\)/);
  assert.match(editor, /invalidateQueries\(\{ queryKey: \[KEY, classId\] \}\)/);
}));

test('a plan stops giving access at the exact end instant, like the web (the last millisecond still counts)', () => {
  const rules = loadApp('http://localhost/api/v1').load('lib/businessRules');
  const now = Date.parse('2027-01-01T00:00:00Z'); const iso = (offset) => new Date(now + offset).toISOString();
  const sub = (change) => ({ status: 'ACTIVE', startDate: iso(-86_400_000), endDate: iso(86_400_000), ...change });
  assert.equal(rules.isEffectiveSubscription(sub({ startDate: iso(0) }), now), true, 'bắt đầu đúng lúc kích hoạt');
  assert.equal(rules.isEffectiveSubscription(sub({ startDate: iso(1) }), now), false, 'chưa tới giờ kích hoạt');
  assert.equal(rules.isEffectiveSubscription(sub({ endDate: iso(1) }), now), true, 'còn 1 ms thì vẫn còn quyền');
  assert.equal(rules.isEffectiveSubscription(sub({ endDate: iso(0) }), now), false, 'hết quyền đúng thời điểm hết hạn');
  assert.equal(rules.isEffectiveSubscription(sub({ status: 'SCHEDULED' }), now), false); assert.equal(rules.isEffectiveSubscription(sub({ status: 'CANCELLED' }), now), false);
  assert.equal(rules.isEffectiveSubscription(sub({ endDate: 'unknown' }), now), false, 'hạn không đọc được thì coi như hết');
  assert.equal(rules.effectiveSubscription([sub({ endDate: iso(0) })], now), undefined);
});

test('a late payment that was refunded stops waiting for review and says so, like the web (REFUNDED wins over REQUIRES_REVIEW)', () => {
  const app = loadApp('http://localhost/api/v1'); const pay = app.load('lib/payment'); const text = app.load('constants/sepayReview');
  const late = { status: 'SUCCESS', activationStatus: 'REQUIRES_REVIEW', reviewReason: 'LATE_PAYMENT', orderCode: 'SC1', expiresAt: '2027-01-01T00:00:00Z' };
  assert.equal(pay.requiresReview(late), true); assert.equal(pay.isConfirmed(late), false);
  const refunded = { ...late, status: 'REFUNDED' };
  assert.equal(pay.requiresReview(refunded), false, 'đã hoàn tiền thì hết chờ đối soát');
  assert.equal(pay.requiresReview({ ...refunded, requiresReview: true }), false);
  assert.equal(pay.isPaymentStatusShownOnHome(refunded, Date.parse('2027-06-01T00:00:00Z')), false, 'Trang chủ không còn thẻ đối soát');
  assert.equal(text.SEPAY_REFUNDED_TEXT.message, 'Giao dịch đã được ghi nhận hoàn tiền.');
  // Màn thanh toán: đã hoàn tiền thuộc nhánh "failed" nhưng có câu riêng, không phải "Thanh toán thất bại"
  assert.match(stripComments(readSource('hooks/member/usePayment.ts')), /else if \(requiresReview\(checkout\)\) phase = 'review';[\s\S]*checkout\.status === 'REFUNDED'\) phase = 'failed'/);
  const panel = stripComments(readSource('components/member/payment/SepayCheckoutPanel.tsx'));
  assert.match(panel, /phase === 'failed' && checkout\.status === 'REFUNDED'/); assert.match(panel, /phase === 'failed' && checkout\.status !== 'REFUNDED'/);
});

test('session results ("Kết quả buổi tập"): the coach saves them with the evaluation like the web, the member sees them in the log and on the session', async () => fixture(async ({ load, requests, handle }) => {
  const api = load('lib/api'); await api.saveTokens('coach-token', 'refresh'); await api.setFacilityId('facility-a');
  handle(() => ({ data: {} }));
  const goals = load('services/goalService'); const g = load('lib/goalProgress'); const c = load('constants/goals');
  // Web (shared/Attendance.tsx): body = { memberId, progress, description: note.trim() || null, results: results.trim() || null }
  const values = { progress: 60, description: g.evaluationNoteOrNull('  Giữ nhịp thở '), results: g.evaluationNoteOrNull('  Squat 3 hiệp × 10 lần  ') };
  await goals.saveScheduleEvaluation('session-a', { memberId: 'member-a', ...values });
  assert.deepEqual([requests[0].method, requests[0].path, requests[0].body], ['POST', '/api/v1/attendance/schedules/session-a/evaluations', { memberId: 'member-a', progress: 60, description: 'Giữ nhịp thở', results: 'Squat 3 hiệp × 10 lần' }]);
  assert.equal(g.evaluationNoteOrNull('   '), null, 'kết quả để trống thì gửi null (xóa kết quả cũ)');
  assert.equal(c.EVALUATION_RESULTS_MAX_LENGTH, 3000);
  assert.deepEqual([c.GOAL_TEXT.evaluateResultsLabel, c.GOAL_TEXT.evaluateResultsPlaceholder, c.GOAL_TEXT.sessionResults], ['Kết quả từng bài tập trong buổi', 'Ví dụ: Squat 3 hiệp × 10 lần, chạy 15 phút', 'Kết quả buổi tập']);

  const sheet = stripComments(readSource('components/coach/EvaluationSheet.tsx'));
  assert.match(sheet, /onSave\(\{ progress, description: evaluationNoteOrNull\(note\), results: evaluationNoteOrNull\(results\) \}\)/);
  assert.match(sheet, /setResults\(draft\.results\)/); assert.match(sheet, /maxLength=\{EVALUATION_RESULTS_MAX_LENGTH\}/);
  assert.match(stripComments(readSource('hooks/coach/useCoachAttendance.ts')), /saveEvaluation\.mutate\(\{ memberId: evaluatingMemberId, \.\.\.values \}/);
  // Hội viên: cùng một dòng nhật ký ở thẻ "Mục tiêu & tiến độ" của lớp và ở thẻ "Đánh giá của HLV cho buổi này"
  assert.match(stripComments(readSource('components/classes/ClassGoalCard.tsx')), /Boolean\(entry\.results\)[\s\S]*TEXT\.sessionResults[\s\S]*\{entry\.results\}/);
  assert.match(readSource('components/member/SessionEvaluationCard.tsx'), /<EvaluationRow entry=\{entry\} \/>/);
}));
