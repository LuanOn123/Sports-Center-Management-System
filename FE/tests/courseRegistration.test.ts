import { describe, expect, it } from "vitest";
import {
  applyWholeCourseEnrollment,
  isWholeCourseRegistered,
} from "../src/shared/courseRegistration";
import type {
  CoursePlan,
  CoursePlanSession,
  WholeCourseEnrollmentResult,
} from "../src/types/member";

function fixture() {
  const session: CoursePlanSession = {
    id: "session-1",
    startTime: "2099-10-01T11:00:00Z",
    endTime: "2099-10-01T12:00:00Z",
    durationMinutes: 60,
    weekday: 4,
    weekdayLabel: "Thứ 5",
    timeLabel: "18:00–19:00",
    status: "SCHEDULED",
    room: {
      id: "r1",
      name: "Phòng Yoga",
      capacity: 10,
      areaType: "INDOOR",
      isActive: true,
    },
    bookedCount: 5,
    remainingSlots: 5,
    isFull: false,
    isBookable: true,
    canBook: true,
    myEnrollmentId: null,
    myEnrollmentStatus: null,
    conflictWith: null,
  };
  const plan: CoursePlan = {
    course: {
      classId: "c1",
      className: "Yoga",
      description: "",
      classType: "REGULAR",
      areaType: "INDOOR",
      capacity: 10,
      sports: [],
      totalSessions: 1,
      firstSessionStart: session.startTime,
      lastSessionStart: session.startTime,
      lastSessionEnd: session.endTime,
      weekdays: [4],
      weekdayLabels: ["Thứ 5"],
      timeSlots: [],
      rooms: [session.room],
      slots: [],
      availability: {
        minRemainingSlots: 5,
        fullSessionCount: 0,
        isFullyBookable: true,
      },
    },
    sessions: [session],
    registration: {
      eligible: true,
      blockers: [],
      subscription: null,
      quota: null,
      penalty: null,
      registeredSessions: 0,
      remainingSessionsToRegister: 1,
      isFullyRegistered: false,
    },
  };
  const result: WholeCourseEnrollmentResult = {
    classId: "c1",
    className: "Yoga",
    summary: {
      totalSessions: 1,
      enrolledNow: 1,
      alreadyBooked: 0,
      totalRegistered: 1,
      firstSessionStart: session.startTime,
      lastSessionEnd: session.endTime,
    },
    sessions: [
      {
        scheduleId: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        roomId: "r1",
        roomName: "Phòng Yoga",
        enrollmentId: "e1",
        status: "BOOKED",
      },
    ],
    quota: {
      hasActiveSubscription: true,
      tier: "MEMBERSHIP",
      limit: 3,
      used: 1,
      remaining: 2,
      classes: [],
    },
  };
  return { plan, result, session };
}

describe("course registration cache", () => {
  it("applies the committed response without counting a seat twice", () => {
    const { plan, result } = fixture();
    const saved = applyWholeCourseEnrollment(plan, result);
    expect(isWholeCourseRegistered(saved)).toBe(true);
    expect(saved.sessions[0]).toMatchObject({
      myEnrollmentId: "e1",
      myEnrollmentStatus: "BOOKED",
      bookedCount: 6,
      remainingSlots: 4,
      canBook: false,
    });
    expect(applyWholeCourseEnrollment(saved, result)).toEqual(saved);
    expect(plan.sessions[0].myEnrollmentStatus).toBeNull();
  });

  it("preserves completed sessions and existing capacity for already-booked results", () => {
    const { plan, result } = fixture();
    plan.sessions[0].myEnrollmentStatus = "COMPLETED";
    result.sessions[0].status = "ALREADY_BOOKED";
    const saved = applyWholeCourseEnrollment(plan, result);
    expect(saved.sessions[0]).toMatchObject({
      myEnrollmentStatus: "COMPLETED",
      bookedCount: 5,
      remainingSlots: 5,
    });
  });

  it("does not apply a late response to another course", () => {
    const { plan, result } = fixture();
    result.classId = "other";
    expect(applyWholeCourseEnrollment(plan, result)).toBe(plan);
    expect(isWholeCourseRegistered(plan)).toBe(false);
  });

  it("unlocks registration after cancellation or when a new session is added", () => {
    const { plan, result, session } = fixture();
    const saved = applyWholeCourseEnrollment(plan, result);
    saved.registration!.isFullyRegistered = false;
    saved.sessions[0].myEnrollmentStatus = "CANCELLED";
    expect(isWholeCourseRegistered(saved)).toBe(false);
    saved.sessions[0].myEnrollmentStatus = "BOOKED";
    saved.sessions.push({ ...session, id: "new-session" });
    expect(isWholeCourseRegistered(saved)).toBe(false);
    expect(isWholeCourseRegistered({ ...plan, sessions: [] })).toBe(false);
  });
});
