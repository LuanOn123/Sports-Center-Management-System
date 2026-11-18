// lib/trainingPlans.ts
// Quy tắc thuần của giáo án tập luyện (web: shared/TrainingPlans): ô nhập ↔ nội dung gửi BE, kiểm tra độ dài theo BE,
// nhãn người nhận, và ai được xem / viết giáo án của một lớp.

import { TRAINING_PLAN_LIMITS as LIMITS, TRAINING_PLAN_TEXT as TEXT } from '../constants/trainingPlans';
import type { Class, CoursePlan, CreateTrainingPlanBody, TrainingPlan, TrainingPlanBody, TrainingPlanMember } from './types';

/** Nội dung các ô nhập của form giáo án (chuỗi để gắn thẳng vào TextInput) */
export interface TrainingPlanForm {
  /** Id hội viên nhận giáo án; rỗng = cả lớp */
  memberId: string;
  title: string;
  instructions: string;
  homework: string;
}

export const EMPTY_TRAINING_PLAN_FORM: TrainingPlanForm = { memberId: '', title: '', instructions: '', homework: '' };

/** Điền form từ giáo án có sẵn khi sửa — người nhận giữ nguyên */
export function planToForm(plan: TrainingPlan): TrainingPlanForm {
  return { memberId: plan.memberId ?? '', title: plan.title, instructions: plan.instructions, homework: plan.homework ?? '' };
}

export type TrainingPlanErrors = Partial<Record<'title' | 'instructions', string>>;

/** Lỗi từng ô theo giới hạn BE (sau khi cắt khoảng trắng); ô còn trống chưa báo lỗi để form mới mở không đỏ sẵn */
export function trainingPlanErrors(form: TrainingPlanForm): TrainingPlanErrors {
  const errors: TrainingPlanErrors = {};
  if (form.title.length > 0 && form.title.trim().length < LIMITS.titleMin) errors.title = TEXT.titleTooShort;
  if (form.instructions.length > 0 && form.instructions.trim().length < LIMITS.instructionsMin) errors.instructions = TEXT.instructionsTooShort;
  return errors;
}

/** Đủ tiêu đề và nội dung (sau khi cắt khoảng trắng) thì mới giao / lưu được */
export function canSubmitTrainingPlan(form: TrainingPlanForm) {
  return form.title.trim().length >= LIMITS.titleMin && form.instructions.trim().length >= LIMITS.instructionsMin;
}

function bodyOf(form: TrainingPlanForm): TrainingPlanBody {
  return { title: form.title.trim(), instructions: form.instructions.trim(), homework: form.homework.trim() || null };
}

/** Nội dung tạo mới: memberId rỗng nghĩa là giao cả lớp (null) */
export function createPlanBody(form: TrainingPlanForm): CreateTrainingPlanBody {
  return { ...bodyOf(form), memberId: form.memberId || null };
}

/** Nội dung sửa: không gửi memberId vì người nhận không đổi được */
export function updatePlanBody(form: TrainingPlanForm): TrainingPlanBody {
  return bodyOf(form);
}

/** Nhãn người nhận của một giáo án: "Giáo án cả lớp" hoặc tên hội viên (thiếu tên thì "Giáo án cá nhân") */
export function planTargetLabel(plan: Pick<TrainingPlan, 'memberId' | 'member'>) {
  return plan.memberId ? plan.member?.user.fullName || TEXT.personal : TEXT.wholeClass;
}

/** Người nhận đang chọn trong form, viết cho câu báo "Đã giao giáo án cho …" */
export function recipientLabel(memberId: string, members: readonly TrainingPlanMember[]) {
  return memberId ? members.find((member) => member.id === memberId)?.name ?? TEXT.personal : TEXT.assignedWholeClass;
}

/** HLV này là một trong các HLV được phân công lớp (BE chỉ cho HLV được phân công xem / viết giáo án) */
export function isAssignedCoach(coachId: string | null | undefined, cls: Pick<Class, 'coaches'> | null | undefined) {
  return Boolean(coachId) && Boolean(cls?.coaches?.some((assigned) => assigned.coachId === coachId));
}

/**
 * Hội viên chỉ thấy giáo án của lớp mình đã đăng ký: có mục tiêu của khóa, hoặc còn buổi sắp tới đã đặt
 * (web: classGoalQuery.data || upcomingBooking ở ClassDetailPage).
 */
export function memberSeesTrainingPlans(hasGoal: boolean, sessions: CoursePlan['sessions'] | undefined, now = Date.now()) {
  return hasGoal || Boolean(sessions?.some((session) => session.myEnrollmentStatus === 'BOOKED' && Date.parse(session.startTime) > now));
}
