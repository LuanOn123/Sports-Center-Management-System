import type {
  CoursePlan,
  CoursePlanSession,
  WholeCourseEnrollmentResult,
} from "../types/member";

export function isWholeCourseRegistered(plan: CoursePlan | null | undefined) {
  return Boolean(
    plan?.registration?.isFullyRegistered ||
    (plan?.sessions.length &&
      plan.sessions.every(
        (session) =>
          session.myEnrollmentStatus === "BOOKED" ||
          session.myEnrollmentStatus === "COMPLETED",
      )),
  );
}

/** Apply the committed response while the authoritative course plan is refreshing. */
export function applyWholeCourseEnrollment(
  plan: CoursePlan,
  result: WholeCourseEnrollmentResult,
): CoursePlan {
  if (plan.course?.classId !== result.classId) return plan;
  const enrolled = new Map(
    result.sessions.map((session) => [session.scheduleId, session]),
  );
  const sessions = plan.sessions.map<CoursePlanSession>((session) => {
    const saved = enrolled.get(session.id);
    if (!saved) return session;
    const wasRegistered =
      session.myEnrollmentStatus === "BOOKED" ||
      session.myEnrollmentStatus === "COMPLETED";
    const delta = !wasRegistered && saved.status !== "ALREADY_BOOKED" ? 1 : 0;
    const remainingSlots = Math.max(0, session.remainingSlots - delta);
    return {
      ...session,
      myEnrollmentId: saved.enrollmentId,
      myEnrollmentStatus:
        session.myEnrollmentStatus === "COMPLETED" ? "COMPLETED" : "BOOKED",
      bookedCount: session.bookedCount + delta,
      remainingSlots,
      isFull: remainingSlots === 0,
      isBookable: remainingSlots > 0,
      canBook: false,
    };
  });
  return {
    ...plan,
    course: {
      ...plan.course,
      availability: sessions.length
        ? {
            minRemainingSlots: Math.min(
              ...sessions.map((session) => session.remainingSlots),
            ),
            fullSessionCount: sessions.filter((session) => session.isFull)
              .length,
            isFullyBookable: sessions.every(
              (session) => session.remainingSlots > 0,
            ),
          }
        : plan.course.availability,
    },
    sessions,
    registration: plan.registration
      ? {
          ...plan.registration,
          registeredSessions: result.summary.totalRegistered,
          remainingSessionsToRegister: Math.max(
            0,
            result.summary.totalSessions - result.summary.totalRegistered,
          ),
          isFullyRegistered:
            result.summary.totalSessions > 0 &&
            result.summary.totalRegistered >= result.summary.totalSessions,
        }
      : null,
  };
}
