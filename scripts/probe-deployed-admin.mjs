import fs from 'node:fs';

const base = (process.env.ADMIN_AUDIT_API_URL || 'https://sports-center-management-system.onrender.com/api/v1').replace(/\/$/, '');
const email = process.env.ADMIN_AUDIT_EMAIL;
const password = process.env.ADMIN_AUDIT_PASSWORD;
if (!email || !password) throw new Error('Set ADMIN_AUDIT_EMAIL and ADMIN_AUDIT_PASSWORD');
const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
const body = await login.json();
const report = { base, login: { status: login.status, success: body.success, message: body.message }, results: [] };
if (!login.ok) { console.log(JSON.stringify(report, null, 2)); process.exitCode = 1; }
else {
  const token = body.data.accessToken;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  report.login.tokenRole = claims.role;
  const headers = { Authorization: 'Bearer ' + token };
  let facilityId;
  for (const path of ['/auth/me', '/facilities', '/users', '/members', '/coaches', '/sports', '/membership-plans', '/rooms', '/classes', '/class-schedules', '/reports/revenue', '/audit-logs', '/issues', '/slots']) {
    const response = await fetch(base + path, { headers });
    const data = await response.json();
    report.results.push({ path, scope: 'none', status: response.status, success: data.success, message: data.message, ...(path === '/auth/me' ? { role: data.data?.role, active: data.data?.isActive } : {}), ...(Array.isArray(data.data) ? { records: data.data.length } : {}) });
    if (path === '/facilities' && response.ok) facilityId = data.data?.[0]?.id;
  }
  if (facilityId) for (const path of ['/users', '/members', '/coaches', '/rooms', '/classes', '/class-schedules', '/reports/revenue', '/audit-logs', '/issues', '/slots', '/staff-candidates', '/schedule-patterns', '/leave-requests', '/counter-orders', '/reports/members', '/reports/enrollments', '/reports/memberships']) {
    const response = await fetch(base + path, { headers: { ...headers, 'X-Facility-Id': facilityId } });
    const data = await response.json();
    report.results.push({ path, scope: 'selected', status: response.status, success: data.success, message: data.message, ...(Array.isArray(data.data) ? { records: data.data.length } : {}) });
  }
  // Only revoke the refresh token created by this audit login.
  if (body.data.refreshToken) await fetch(base + '/auth/logout', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: body.data.refreshToken }) });
  if (process.env.ADMIN_AUDIT_OUTPUT) fs.writeFileSync(process.env.ADMIN_AUDIT_OUTPUT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
