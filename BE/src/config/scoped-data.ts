/**
 * Model CÓ `facilityId` trực tiếp và bị DAL tự lọc/ghi theo facility trong requestContext.
 *
 * `MembershipSubscription` KHÔNG thuộc nhóm này: Membership là GLOBAL cho hội viên.
 * `MembershipSubscription.facilityId` chỉ là ORIGIN (cơ sở phát hành gói) dùng cho
 * báo cáo/audit — KHÔNG được dùng làm phạm vi hiệu lực của gói.
 */
export const facilityRoots = new Set([
  "Room",
  "Class",
  "Payment",
  // Phase 1: lượt vào cửa là dữ liệu vận hành gắn với cơ sở SỬ DỤNG thực tế.
  "FacilityVisit",
  "Issue",
  "LeaveRequest",
  "Slot",
  "SchedulePattern",
  "AuditLog",
  "FacilityStaff",
]);
/**
 * Model con scope theo CHA (vd `Enrollment` → `Class` → facilityId).
 * `MembershipSubscription` không có trong đây: mọi lookup entitlement (gói ACTIVE,
 * quota) phải tra được gói của hội viên bất kể facility đang chọn.
 */
export const parents: Record<string, string[]> = {
  ClassSchedule: ["class"],
  ClassMember: ["class"],
  Enrollment: ["class"],
  Attendance: ["schedule", "class"],
  WaitlistEntry: ["schedule", "class"],
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
