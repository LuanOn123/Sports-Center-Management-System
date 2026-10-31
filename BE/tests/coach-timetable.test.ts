import assert from 'node:assert/strict';
import { test } from 'node:test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/test';
const { prisma } = require('../src/config/prisma.js');
const { listSchedules } = require('../src/modules/class-schedules/class-schedules.service.js');
const { effectiveCoachIds, effectiveCoachWhere } = require('../src/modules/operations/effective-coaches.js');

test('primary loses only the replaced session; substitute and support keep it', () => {
  const assignments = [{ coachId: 'primary', isPrimary: true }, { coachId: 'support', isPrimary: false }];
  assert.deepEqual(effectiveCoachIds({ coachId: null, class: { coaches: assignments } }), ['primary', 'support']);
  assert.deepEqual(effectiveCoachIds({ coachId: 'substitute', class: { coaches: assignments } }), ['support', 'substitute']);
});

test('coach timetable is scoped to the authenticated coach, including no-class substitutes', async () => {
  const originals = [prisma.coachProfile.findUnique, prisma.classSchedule.count, prisma.classSchedule.findMany, prisma.$queryRaw];
  const seen: any[] = [];
  try {
    prisma.coachProfile.findUnique = async () => ({ id: 'substitute' });
    prisma.classSchedule.count = async (args: any) => { seen.push(args.where); return 1; };
    prisma.classSchedule.findMany = async (args: any) => { seen.push(args.where); return [{ id: 'session' }]; };
    const result = await listSchedules({ startAfter: '2099-01-01T00:00:00Z' }, { id: 'u', role: 'COACH' });
    assert.equal(result.schedules[0].id, 'session');
    for (const where of seen) assert.deepEqual(where.OR, effectiveCoachWhere('substitute').OR);
    await assert.rejects(() => listSchedules({ coachId: 'other' }, { id: 'u', role: 'COACH' }), (err: any) => err.statusCode === 403);
    // Weekday uses raw SQL for pagination: it must apply the same scope before LIMIT/count.
    const raw: any[] = [];
    prisma.$queryRaw = async (_strings: any, ...args: any[]) => { raw.push(args.find(value => value?.sql)); return raw.length === 1 ? [{ total: 1n }] : [{ id: 'session' }]; };
    await listSchedules({ weekdayIso: [2] }, { id: 'u', role: 'COACH' });
    assert.equal(raw.length, 2);
    for (const sql of raw) {
      assert.match(sql.sql, /s\."coachId"/);
      assert.match(sql.sql, /"isPrimary" = false/);
      assert.equal(sql.values.filter((v: any) => v === 'substitute').length, 3);
    }
  } finally {
    [prisma.coachProfile.findUnique, prisma.classSchedule.count, prisma.classSchedule.findMany, prisma.$queryRaw] = originals;
  }
});
