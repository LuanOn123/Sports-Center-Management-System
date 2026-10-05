export const facilityRoots = new Set([
  "Room",
  "Class",
  "Payment",
  "MembershipSubscription",
  "Issue",
  "LeaveRequest",
  "Slot",
  "SchedulePattern",
  "AuditLog",
  "FacilityStaff",
]);
export const parents: Record<string, string[]> = {
  ClassSchedule: ["class"],
  ClassMember: ["class"],
  Enrollment: ["class"],
  Attendance: ["schedule", "class"],
  Invoice: ["payment"],
  RoomCapability: ["room"],
  AttendanceManualCode: ["schedule", "class"],
  AttendancePenalty: ["class"],
  CoachFeedback: ["class"],
};
export function facilityFilter(
  model: string,
  facilityId: string,
): Record<string, any> | undefined {
  if (facilityRoots.has(model)) return { facilityId };
  const chain = parents[model];
  return chain?.reduceRight((nested, key) => ({ [key]: nested }), {
    facilityId,
  } as Record<string, any>);
}
