const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const root = require('node:path').resolve(process.cwd(), '..');
const out = process.env.SCMS_ARTIFACT_DIR || fs.mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'scms-live-'));
fs.mkdirSync(out, { recursive: true });
const reqBE = createRequire(root + '/BE/package.json');
const reqFE = createRequire(root + '/FE/package.json');
const { prisma } = require(root + '/BE/src/config/prisma.ts');
const mongoose = reqBE('mongoose');
const { User } = require(root + '/BE/src/models/User.ts');
const { createIdentity } = require(root + '/BE/tests/helpers/identity.ts');
const { signAccessToken } = require(root + '/BE/src/utils/jwt.ts');
const app = require(root + '/BE/src/app.ts').default;
const { chromium } = reqFE('playwright');
const results = [], tokens = {}, profiles = {}, pageErrors = [], apiErrors = [];
let server, vite, browser, sockets, apiBase, webBase;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = async (name, fn) => {
  try { const details = await fn(); results.push({ name, status: 'PASS', details }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.message }); }
  console.log(JSON.stringify(results.at(-1)));
};
async function http(actor, method, path, data) {
  const response = await fetch(apiBase + path, { method, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[actor], 'X-Facility-Id': 'seed-fac-q1',
  }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  return { status: response.status, body: await response.json() };
}
async function fresh(key) {
  const user = await createIdentity({ email: key + '@strict.invalid', fullName: key,
    password: 'fixture-only', role: 'MEMBER' });
  tokens[key] = signAccessToken({ id: user.id, role: 'MEMBER' });
  profiles[key] = user.memberProfile.id;
  return user;
}
async function pageFor(actor, path) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.addInitScript(({ token }) => {
    sessionStorage.setItem('pulse.identity-version', 'mongo-identities-v1');
    sessionStorage.setItem('pulse.access', token);
    sessionStorage.setItem('pulse.facility', 'seed-fac-q1');
  }, { token: tokens[actor] });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push({ path, error: error.message }));
  page.on('response', async response => {
    if (response.url().startsWith(apiBase) && response.status() >= 400)
      apiErrors.push({ page: path, url: response.url().replace(apiBase, ''), status: response.status(), body: (await response.text()).slice(0, 600) });
  });
  await page.goto(webBase + path);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  return page;
}
async function main() {
  assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema'), /^scms_verify_/);
  assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
  assert.match(process.env.MONGO_URI, /^mongodb:\/\/127\.0\.0\.1:\d+\/scms_verify_/);
  await mongoose.connect(process.env.MONGO_URI);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  apiBase = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  sockets = new (reqBE('socket.io').Server)(server, { cors: { origin: '*' } });
  require(root + '/BE/src/modules/chat/chat.socket.ts').setupSocket(sockets);
  for (const [actor, email] of Object.entries({ admin: 'admin', reception: 'reception.q1', manager: 'manager.q1', coach: 'coach.yoga', free: 'member.free', member: 'member.membership' })) {
    const user = await User.findOne({ email: email + '@seed.scms.test' });
    assert.ok(user, actor); tokens[actor] = signAccessToken({ id: user.id, role: user.role });
  }
  const plan = await prisma.membershipPlan.create({ data: { name: 'AUDIT Gói 30 ngày', price: 300000, durationDays: 30, tier: 'MEMBERSHIP', maxConcurrentClasses: 3 } });
  await fresh('renewal');
  let purchase, renewal;
  await check('HTTP mua gói tại quầy', async () => {
    purchase = await http('reception', 'POST', '/subscriptions', { memberId: profiles.renewal, planId: plan.id, paymentMethod: 'CASH' });
    assert.equal(purchase.status, 201, JSON.stringify(purchase));
    assert.equal(purchase.body.data.subscription.status, 'ACTIVE');
    return { subscription: purchase.body.data.subscription.status, payment: purchase.body.data.payment.status };
  });
  await check('HTTP gia hạn nối tiếp chính xác và chặn gói chờ thứ hai', async () => {
    renewal = await http('reception', 'POST', `/subscriptions/${purchase.body.data.subscription.id}/renew`, { planId: plan.id, paymentMethod: 'CASH' });
    assert.equal(renewal.status, 201, JSON.stringify(renewal));
    assert.equal(renewal.body.data.subscription.status, 'SCHEDULED');
    assert.equal(renewal.body.data.subscription.startDate, purchase.body.data.subscription.endDate);
    const third = await http('reception', 'POST', '/subscriptions', { memberId: profiles.renewal, planId: plan.id, paymentMethod: 'CASH' });
    assert.equal(third.status, 409);
    return { queuedStart: renewal.body.data.subscription.startDate, nextPurchase: third.status };
  });
  await check('Báo cáo doanh thu theo gói phải gồm cả khoản gia hạn', async () => {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const report = await http('manager', 'GET', '/reports/memberships?startDate=' + today + '&endDate=' + today);
    assert.equal(report.status, 200, JSON.stringify(report));
    const row = report.body.data.plansBreakdown.find(p => p.planId === plan.id || p.id === plan.id);
    const payments = await prisma.payment.findMany({ where: { memberId: profiles.renewal }, select: { amount: true, planId: true, subscriptionId: true } });
    fs.writeFileSync(out + '/renewal-report-evidence.json', JSON.stringify({ row, payments, report: report.body }, null, 2));
    assert.equal(Number(row?.revenue), 600000, JSON.stringify({ row, payments }));
  });
  await check('Backfill khoản gia hạn cũ thiếu planId chạy lặp an toàn', async () => {
    const paymentId = renewal.body.data.payment.id;
    await prisma.payment.update({ where: { id: paymentId }, data: { planId: null } });
    const sql = fs.readFileSync(root + '/BE/prisma/migrations/20261031230000_renewal_payment_plan/migration.sql', 'utf8');
    await prisma.$executeRawUnsafe(sql);
    assert.equal((await prisma.payment.findUnique({ where: { id: paymentId } })).planId, plan.id);
    assert.equal(await prisma.$executeRawUnsafe(sql), 0);
  });
  await check('Hủy gói chờ, yêu cầu hoàn 100%, xác nhận biên nhận một lần', async () => {
    const cancel = await http('renewal', 'PATCH', `/subscriptions/${renewal.body.data.subscription.id}/cancel`, {});
    assert.equal(cancel.status, 200, JSON.stringify(cancel));
    let payment = await prisma.payment.findUnique({ where: { id: renewal.body.data.payment.id } });
    assert.equal(payment.status, 'SUCCESS'); assert.equal(Number(payment.refundRequestedAmount), 300000);
    const confirm = await http('reception', 'POST', `/payments/${payment.id}/refund/confirm`, { reason: 'Audit actual cash return', reference: 'AUDIT-ONE' });
    assert.equal(confirm.status, 200, JSON.stringify(confirm));
    const repeat = await http('reception', 'POST', `/payments/${payment.id}/refund/confirm`, { reason: 'Audit duplicate', reference: 'AUDIT-TWO' });
    assert.equal(repeat.status, 200, JSON.stringify(repeat));
    payment = await prisma.payment.findUnique({ where: { id: payment.id } });
    assert.equal(payment.refundReference, 'AUDIT-ONE');
    assert.equal((await prisma.membershipSubscription.findUnique({ where: { id: purchase.body.data.subscription.id } })).status, 'ACTIVE');
    return { refund: payment.status, receipt: payment.refundReference, activeRetained: true };
  });
  // Start the actual frontend against the disposable backend; no API route mocks.
  const net = require('node:net'); const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  webBase = 'http://127.0.0.1:' + port;
  const log = fs.openSync(out + '/strict-vite.log', 'w');
  vite = spawn(process.execPath, [root + '/FE/node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root + '/FE', env: { ...process.env, VITE_API_BASE_URL: apiBase }, windowsHide: true, stdio: ['ignore', log, log],
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(webBase)).ok) break; } catch {} await sleep(300); }
  browser = await chromium.launch({ headless: true });
  await check('UI lễ tân có thao tác hủy gói ACTIVE đã được cấp quyền', async () => {
    const page = await pageFor('reception', '/receptionist/membership?memberId=' + profiles.renewal);
    await page.screenshot({ path: out + '/ui-reception-membership.png', fullPage: true });
    fs.writeFileSync(out + '/ui-reception-membership.txt', await page.locator('main').innerText());
    assert.ok(await page.getByRole('button', { name: 'Hủy gói', exact: true }).count(), 'Không có nút Hủy gói ACTIVE; chỉ thấy thao tác ngừng quyền lợi');
  });
  await check('UI hội viên gia hạn VietQR phải tạo được checkout', async () => {
    const page = await pageFor('renewal', '/member/membership');
    fs.writeFileSync(out + '/ui-renewal-before.txt', await page.locator('body').innerText());
    const button = page.getByRole('button', { name: 'Gia hạn qua VietQR', exact: true });
    const count = await button.count(); assert.ok(count, 'Không thấy nút gia hạn; xem ui-renewal-before.txt');
    await button.last().click();
    const pending = page.waitForResponse(r => r.url().endsWith('/payments/sepay/checkout') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Tiếp tục tạo VietQR', exact: true }).click();
    const response = await pending;
    const evidence = { status: response.status(), sent: response.request().postDataJSON(), body: await response.json(), originalEnd: purchase.body.data.subscription.endDate };
    fs.writeFileSync(out + '/ui-renewal-checkout.json', JSON.stringify(evidence, null, 2));
    await page.screenshot({ path: out + '/ui-member-renewal.png', fullPage: true });
    assert.equal(response.status(), 201, JSON.stringify(evidence));
  });
  await check('Tạm ngưng thủ công không được để booking tiếp tục chiếm chỗ', async () => {
    const schedule = await prisma.classSchedule.findFirst({ where: { classId: 'seed-class-yoga-morning', status: 'SCHEDULED', startTime: { gt: new Date() } } });
    assert.ok(schedule);
    const enrollment = await prisma.enrollment.create({ data: { memberId: profiles.renewal, classId: schedule.classId, scheduleId: schedule.id, subscriptionId: purchase.body.data.subscription.id } });
    const result = await http('reception', 'PATCH', `/subscriptions/${purchase.body.data.subscription.id}/status`, { status: 'SUSPENDED' });
    const after = await prisma.enrollment.findUnique({ where: { id: enrollment.id } });
    assert.equal(result.status, 409, JSON.stringify(result));
    assert.equal(result.body.errors.code, 'SUBSCRIPTION_SUSPEND_FORBIDDEN');
    assert.equal(after.status, 'BOOKED'); // Rejected request must leave the paid subscription and booking untouched.
  });
  await check('UI lễ tân hủy ACTIVE: thu hồi booking và tạo yêu cầu hoàn, chưa ghi đã trả', async () => {
    await fresh('staffcancel');
    const sold = await http('reception', 'POST', '/subscriptions', { memberId: profiles.staffcancel, planId: plan.id, paymentMethod: 'CASH' });
    assert.equal(sold.status, 201);
    const sub = sold.body.data.subscription;
    const schedule = await prisma.classSchedule.findFirstOrThrow({ where: { classId: 'seed-class-yoga-morning', startTime: { gt: new Date() }, status: 'SCHEDULED' } });
    const booked = await prisma.enrollment.create({ data: { memberId: profiles.staffcancel, classId: schedule.classId, scheduleId: schedule.id, subscriptionId: sub.id } });
    const page = await pageFor('reception', '/receptionist/membership?memberId=' + profiles.staffcancel);
    await page.getByRole('button', { name: 'Hủy gói', exact: true }).click();
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/subscriptions/' + sub.id + '/status') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Xác nhận hủy gói', exact: true }).click();
    const response = await responsePromise; assert.equal(response.status(), 200, await response.text());
    await page.getByText(/Đã yêu cầu hoàn/).waitFor();
    const receipt = await prisma.payment.findUnique({ where: { id: sold.body.data.payment.id } });
    assert.equal(receipt.status, 'SUCCESS'); assert.ok(receipt.refundRequestedAt);
    assert.equal(Number(receipt.refundRequestedAmount), 300000);
    assert.equal((await prisma.enrollment.findUnique({ where: { id: booked.id } })).status, 'CANCELLED');
    await page.screenshot({ path: out + '/ui-staff-active-cancel.png', fullPage: true });
  });
  await check('Ba giao dịch mua đồng thời giữ tối đa một ACTIVE và một SCHEDULED', async () => {
    await fresh('race');
    const outcomes = await Promise.all([1,2,3].map(() => http('reception', 'POST', '/subscriptions', { memberId: profiles.race, planId: plan.id, paymentMethod: 'CASH' })));
    const states = await prisma.membershipSubscription.findMany({ where: { memberId: profiles.race }, select: { status: true } });
    assert.equal(states.filter(s => s.status === 'ACTIVE').length, 1); assert.equal(states.filter(s => s.status === 'SCHEDULED').length, 1);
    assert.deepEqual(outcomes.map(r => r.status).sort(), [201,201,409]); return outcomes.map(r => r.status);
  });
  await check('UI đăng ký trọn khóa tạo booking thật và giữ nguồn gói', async () => {
    await fresh('classflow');
    const sold = await http('reception', 'POST', '/subscriptions', { memberId: profiles.classflow, planId: plan.id, paymentMethod: 'CASH' });
    assert.equal(sold.status, 201);
    const page = await pageFor('classflow', '/member/classes/seed-class-yoga-morning');
    await page.getByRole('button', { name: 'Đăng ký trọn khóa', exact: true }).click({ timeout: 10000 });
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/enrollments/bulk') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Xác nhận đăng ký trọn khóa', exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201, await response.text());
    const rows = await prisma.enrollment.findMany({ where: { memberId: profiles.classflow } });
    assert.ok(rows.length > 0); assert.ok(rows.every(row => row.subscriptionId === sold.body.data.subscription.id));
    await page.screenshot({ path: out + '/ui-course-enrolled.png', fullPage: true });
    return { booked: rows.length, sourceRecorded: true };
  });
  await check('Đơn SePay đã thu nhưng mất gói phải có đường giải quyết/hoàn tiền', async () => {
    const payment = await prisma.payment.create({ data: { memberId: profiles.renewal, facilityId: 'seed-fac-q1', amount: 300000,
      method: 'SEPAY', gateway: 'SEPAY', status: 'SUCCESS', paidAt: new Date(), activationStatus: 'REQUIRES_REVIEW', reviewReason: 'Plan missing' } });
    const retry = await http('admin', 'POST', `/payments/${payment.id}/retry-activation`, {});
    const denied = await http('reception', 'POST', `/payments/${payment.id}/refund/request`, { reason: 'Not authorized' });
    assert.equal(denied.status, 403);
    const arbitraryAmount = await http('admin', 'POST', `/payments/${payment.id}/refund/request`, { reason: 'Invalid amount override', amount: 999999 });
    assert.equal(arbitraryAmount.status, 400);
    const approval = await http('admin', 'POST', `/payments/${payment.id}/refund/request`, { reason: 'Cannot activate original plan' });
    assert.equal(approval.status, 200, JSON.stringify(approval));
    assert.equal(approval.body.data.status, 'SUCCESS');
    assert.equal(Number(approval.body.data.refundRequestedAmount), 300000);
    const repeatApproval = await http('admin', 'POST', `/payments/${payment.id}/refund/request`, { reason: 'Repeat approval' });
    assert.equal(repeatApproval.status, 200);
    assert.equal(repeatApproval.body.data.refundReason, approval.body.data.refundReason);
    const refund = await http('admin', 'POST', `/payments/${payment.id}/refund/confirm`, { reason: 'Refund failed activation', reference: 'AUDIT-REVIEW-REFUND' });
    assert.equal(retry.status, 409);
    assert.equal(refund.status, 200, JSON.stringify(refund));
    assert.equal(refund.body.data.status, 'REFUNDED');
    const another = await prisma.payment.create({ data: { memberId: profiles.renewal, facilityId: 'seed-fac-q1', planId: plan.id,
      amount: 300000, method: 'SEPAY', gateway: 'SEPAY', status: 'SUCCESS', paidAt: new Date(), activationStatus: 'REQUIRES_REVIEW' } });
    const approved = await http('admin', 'POST', '/payments/' + another.id + '/refund/request', { reason: 'Approve instead of activation' });
    assert.equal(approved.status, 200);
    const blocked = await http('admin', 'POST', '/payments/' + another.id + '/retry-activation', {});
    assert.equal(blocked.status, 409);
    assert.equal((await prisma.payment.findUnique({ where: { id: another.id } })).subscriptionId, null);

  });
  await check('Sửa lịch tương lai không được chuyển buổi học vào quá khứ', async () => {
    const coach = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: (await User.findOne({ email: 'coach.yoga@seed.scms.test' })).id } });
    const cls = await prisma.class.create({ data: { name: 'Audit schedule move', facilityId: 'seed-fac-q1', capacity: 10, areaType: 'INDOOR',
      sports: { connect: { id: 'seed-sport-yoga' } }, coaches: { create: { coachId: coach.id, isPrimary: true } } } });
    const term = await prisma.term.findFirstOrThrow({ where: { facilityId: 'seed-fac-q1' } });
    const room = await prisma.room.findFirstOrThrow({ where: { facilityId: 'seed-fac-q1', areaType: 'INDOOR' } });
    const future = await prisma.classSchedule.create({ data: { classId: cls.id, roomId: room.id, termId: term.id,
      startTime: new Date(Date.now() + 80 * 86400000), endTime: new Date(Date.now() + 80 * 86400000 + 3600000) } });
    const result = await http('manager', 'PATCH', `/class-schedules/${future.id}`, {
      startTime: new Date(Date.now() - 100 * 86400000).toISOString(), endTime: new Date(Date.now() - 100 * 86400000 + 3600000).toISOString() });
    assert.equal(result.status, 400, JSON.stringify(result));
    assert.equal(result.body.errors.code, 'SCHEDULE_IN_PAST');
  });
  await check('Dữ liệu seed demo QR phải tạo được mã điểm danh', async () => {
    const schedule = await prisma.classSchedule.findFirstOrThrow({ where: { classId: 'seed-class-demo-qr', startTime: { lte: new Date() }, endTime: { gt: new Date() } } });
    const result = await http('manager', 'POST', '/attendance/generate-qr', { scheduleId: schedule.id });
    assert.equal(result.status, 200, JSON.stringify({ scheduleId: schedule.id, response: result }));
  });
  let qrSchedule, qrData;
  await check('QR buổi học UUID: hội viên trả phí quét lặp không tạo trùng', async () => {
    const coachUser = await User.findOne({ email: 'coach.yoga@seed.scms.test' });
    const coach = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: coachUser.id } });
    const cls = await prisma.class.create({ data: { name: 'Audit live QR', facilityId: 'seed-fac-q1', capacity: 10, areaType: 'INDOOR',
      sports: { connect: { id: 'seed-sport-yoga' } }, coaches: { create: { coachId: coach.id, isPrimary: true } } } });
    const term = await prisma.term.findFirstOrThrow({ where: { facilityId: 'seed-fac-q1' } });
    const room = await prisma.room.findFirstOrThrow({ where: { facilityId: 'seed-fac-q1', areaType: 'INDOOR' } });
    qrSchedule = await prisma.classSchedule.create({ data: { classId: cls.id, roomId: room.id, termId: term.id,
      startTime: new Date(Date.now() - 5 * 60000), endTime: new Date(Date.now() + 55 * 60000) } });
    const purchased = await prisma.membershipSubscription.findFirstOrThrow({ where: { memberId: profiles.classflow, status: 'ACTIVE' } });
    await prisma.enrollment.create({ data: { memberId: profiles.classflow, classId: cls.id, scheduleId: qrSchedule.id, subscriptionId: purchased.id } });
    const generated = await http('manager', 'POST', '/attendance/generate-qr', { scheduleId: qrSchedule.id });
    assert.equal(generated.status, 200, JSON.stringify(generated)); qrData = generated.body.data;
    for (let i = 0; i < 2; i++) {
      const scanned = await http('classflow', 'POST', '/attendance/scan-qr', { qrToken: qrData.qrToken });
      assert.equal(scanned.status, 200, JSON.stringify(scanned));
    }
    assert.equal(await prisma.attendance.count({ where: { memberId: profiles.classflow, scheduleId: qrSchedule.id } }), 1);
    const stranger = await http('free', 'POST', '/attendance/scan-qr', { qrToken: qrData.qrToken });
    assert.equal(stranger.status, 403);
    return { duplicateCount: 1, nonEnrolled: stranger.status };
  });
  await check('FREE không được điểm danh lớp chỉ nhờ booking cũ đã hết quyền, không có grant', async () => {
    const user = await User.findOne({ email: 'member.free@seed.scms.test' });
    const profile = await prisma.memberProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const expired = await prisma.membershipSubscription.create({ data: { memberId: profile.id, planId: plan.id, tier: 'MEMBERSHIP',
      status: 'EXPIRED', startDate: new Date(Date.now() - 40 * 86400000), endDate: new Date(Date.now() - 10 * 86400000) } });
    await prisma.enrollment.create({ data: { memberId: profile.id, classId: qrSchedule.classId, scheduleId: qrSchedule.id, subscriptionId: expired.id } });
    const result = await http('free', 'POST', '/attendance/scan-qr', { qrToken: qrData.qrToken });
    assert.equal(result.status, 403, JSON.stringify({ expected: '403 PAID or valid term grant required', actual: result }));
  });
  for (const [actor, path] of [['free','/member/membership'],['member','/member/classes'],['member','/member/schedule'],['reception','/receptionist/payments'],['reception','/receptionist/checkin'],['manager','/manager/schedules'],['manager','/manager/terms'],['coach','/coach']]) {
    await check('UI live smoke ' + path + ' (' + actor + ')', async () => {
      const page = await pageFor(actor, path);
      const text = await page.locator('body').innerText();
      const name = actor + '-' + path.split('/').filter(Boolean).join('-');
      await page.screenshot({ path: out + '/ui-' + name + '.png', fullPage: true });
      fs.writeFileSync(out + '/ui-' + name + '.txt', text);
      assert.ok(!text.includes('Không tìm thấy trang'), 'Route không tồn tại trong UI');
      assert.ok(!page.url().includes('/login'), 'Bị đưa về đăng nhập');
      return { title: (await page.locator('h1').allTextContents()).join(' | '), url: page.url().replace(webBase, '') };
    });
  }
}
main().catch(error => { results.push({ name: 'HARNESS', status: 'ERROR', error: error.stack }); console.error(error); process.exitCode = 1; })
  .finally(async () => {
    if (pageErrors.length) results.push({ name: 'Browser JavaScript errors', status: 'FAIL', details: pageErrors });
    fs.writeFileSync(out + '/strict-live-results.json', JSON.stringify({ baseline: 'working-tree strict fixes', results, pageErrors, apiErrors }, null, 2));
    if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
    console.log('LIVE SUMMARY ' + JSON.stringify({ total: results.length, passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status !== 'PASS').length, artifacts: out }));
    if (browser) await browser.close();
    if (vite) vite.kill();
    if (sockets) await new Promise(resolve => sockets.close(resolve));
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect(); await mongoose.disconnect();
  });
