import { randomUUID } from "node:crypto";
import { ensureSeedTerm } from "../src/scripts/seed-term.js";

const users: string[] = [], sports: string[] = [], terms: string[] = [];
/** Explicit test fixture, never used by production to silently repair invalid requests. */
export async function createFixtureSchedule(db: any, args: any) {
  const cls = await db.class.findUniqueOrThrow({ where: { id: args.data.classId }, include: { sports: true, coaches: true } });
  if (!args.data.termId) {
    const term = await ensureSeedTerm(db, cls.facilityId);
    terms.push(term.id);
    args = { ...args, data: { ...args.data, termId: term.id } };
  }
  let sport = cls.sports[0];
  if (!sport) {
    sport = await db.sport.create({ data: { name: `fixture-${randomUUID()}`, areaTypes: ["INDOOR"] } });
    sports.push(sport.id);
    await db.class.update({ where: { id: cls.id }, data: { sports: { connect: { id: sport.id } } } });
  }
  let coachId = cls.coaches.find((coach: any) => coach.isPrimary)?.coachId;
  if (!coachId) {
    const user = await db.user.create({ data: { email: `${randomUUID()}@fixture.invalid`, fullName: "Fixture coach",
      password: "fixture-only", role: "COACH", coachProfile: { create: {} } }, include: { coachProfile: true } });
    users.push(user.id); coachId = user.coachProfile.id;
    await db.classMember.create({ data: { classId: cls.id, coachId, isPrimary: true } });
    await db.facilityStaff.create({ data: { userId: user.id, facilityId: cls.facilityId, role: "COACH" } });
  }
  await db.coachSpecialization.upsert({ where: { coachId_sportId: { coachId, sportId: sport.id } },
    create: { coachId, sportId: sport.id }, update: {} });
  return db.classSchedule.create(args);
}

export async function cleanupFixtureSchedules(db: any) {
  await db.term.deleteMany({ where: { id: { in: terms } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.sport.deleteMany({ where: { id: { in: sports } } });
}
