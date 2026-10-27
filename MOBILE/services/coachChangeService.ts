// services/coachChangeService.ts
// API "Đổi HLV theo buổi" của Huấn luyện viên (BE operations.routes: /coach-change-requests).
// Danh sách trả mảng (không phân trang, tối đa 200 dòng) trong phạm vi cơ sở hiện tại (X-Facility-Id).

import { api } from '../lib/api';
import type { CoachChangeStatus } from '../constants/coachChanges';

export interface CoachChangeSession {
  id: string;
  startTime: string;
  endTime: string;
  class: { name: string };
  room?: { name: string } | null;
}

export interface CoachChangeRequest {
  id: string;
  status: CoachChangeStatus;
  reason: string;
  decisionReason?: string | null;
  requestedStartTime: string;
  requestedEndTime: string;
  createdAt: string;
  schedule: CoachChangeSession;
  requester?: { user: { fullName: string } };
  replacement?: { user: { fullName: string } } | null;
}

/** GET /coach-change-requests — Coach chỉ thấy yêu cầu của chính mình */
export const getMyCoachChanges = () => api.get<CoachChangeRequest[]>('/coach-change-requests');

/** GET /coach-change-requests/sessions — buổi sắp tới mình dạy chính và chưa có yêu cầu PENDING */
export const getRequestableSessions = () => api.get<CoachChangeSession[]>('/coach-change-requests/sessions');

/** POST /coach-change-requests — { scheduleId, reason } */
export const createCoachChange = (body: { scheduleId: string; reason: string }) =>
  api.post<CoachChangeRequest>('/coach-change-requests', body);
