import { allPages } from "../shared/pagedApi";
import { apiClient } from "./client";
import type {
  ConcurrentClassQuota,
  Enrollment,
  WholeCourseEnrollmentResult,
} from "../types/member";

export interface EnrollmentQuery {
  status?: "BOOKED" | "CANCELLED" | "COMPLETED";
  page?: number;
  limit?: number;
}

export interface SlotEvaluationItem {
  memberId: string;
  goalId?: string | null;
  goal: string;
  currentProgress: number;
  evaluation?: {
    id: string;
    previousProgress: number;
    newProgress: number;
    description?: string | null;
    results?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface MyClassGoal {
  id: string;
  classId: string;
  goal: string;
  progress: number;
  status: string;
  evaluations: Array<{
    id: string;
    scheduleId: string;
    startTime: string;
    endTime: string;
    roomName?: string;
    coachName: string;
    previousProgress: number;
    newProgress: number;
    diff: number;
    description?: string | null;
    results?: string | null;
    createdAt: string;
  }>;
}

export const enrollmentsApi = {
  async bookClass(
    scheduleId: string,
    options?: {
      healthNotes?: string | null;
      saveToProfile?: boolean;
      memberId?: string;
      goal?: string | null;
    },
  ): Promise<Enrollment> {
    return apiClient.post<Enrollment>("/enrollments", {
      scheduleId,
      ...(options?.memberId ? { memberId: options.memberId } : {}),
      ...(options?.healthNotes !== undefined
        ? { healthNotes: options.healthNotes }
        : {}),
      ...(options?.saveToProfile !== undefined
        ? { saveToProfile: options.saveToProfile }
        : {}),
      ...(options?.goal !== undefined ? { goal: options.goal } : {}),
    });
  },

  async enrollWholeCourse(
    classId: string,
    memberId?: string,
    options?: {
      healthNotes?: string | null;
      saveToProfile?: boolean;
      goal?: string | null;
    },
  ): Promise<WholeCourseEnrollmentResult> {
    return apiClient.post<WholeCourseEnrollmentResult>("/enrollments/bulk", {
      classId,
      ...(memberId ? { memberId } : {}),
      ...(options?.healthNotes !== undefined
        ? { healthNotes: options.healthNotes }
        : {}),
      ...(options?.saveToProfile !== undefined
        ? { saveToProfile: options.saveToProfile }
        : {}),
      ...(options?.goal !== undefined ? { goal: options.goal } : {}),
    });
  },

  async updateHealthNotes(
    id: string,
    healthNotes: string | null,
    saveToProfile?: boolean,
  ): Promise<Enrollment> {
    return apiClient.patch<Enrollment>(`/enrollments/${id}/health-notes`, {
      healthNotes,
      saveToProfile: Boolean(saveToProfile),
    });
  },

  async getMyEnrollments(
    query: EnrollmentQuery = {},
  ): Promise<{ enrollments: Enrollment[]; pagination?: unknown }> {
    if (!query.page)
      return {
        enrollments: (
          await allPages<Enrollment>("GET /enrollments/my", {
            query: query.status ? { status: query.status } : {},
          })
        ).data,
      };
    const params = new URLSearchParams();
    if (query.status) params.append("status", query.status);
    if (query.page) params.append("page", String(query.page));
    if (query.limit) params.append("limit", String(query.limit));

    const qs = params.toString();
    return apiClient.get<{ enrollments: Enrollment[]; pagination?: unknown }>(
      `/enrollments/my${qs ? `?${qs}` : ""}`,
    );
  },

  async cancelEnrollment(id: string): Promise<Enrollment> {
    return apiClient.delete<Enrollment>(`/enrollments/${id}`);
  },

  async cancelWholeCourse(classId: string, termId: string | null) {
    return apiClient.post<{ cancelledSessions: number; cancelledWaitlist: number }>(
      `/enrollments/courses/${encodeURIComponent(classId)}/cancel`, { termId },
    );
  },

  async transferEnrollment(
    id: string,
    targetScheduleId: string,
  ): Promise<Enrollment> {
    return apiClient.post<Enrollment>(`/enrollments/${id}/transfer`, {
      targetScheduleId,
    });
  },

  async getMyQuota(): Promise<ConcurrentClassQuota> {
    return apiClient.get<ConcurrentClassQuota>("/enrollments/my/quota");
  },

  async getScheduleEvaluations(scheduleId: string): Promise<SlotEvaluationItem[]> {
    return apiClient.get<SlotEvaluationItem[]>(
      `/attendance/schedules/${scheduleId}/evaluations`
    );
  },

  async saveScheduleEvaluation(
    scheduleId: string,
    data: { memberId: string; progress: number; description?: string | null; results?: string | null }
  ) {
    return apiClient.post(
      `/attendance/schedules/${scheduleId}/evaluations`,
      data
    );
  },

  async getMyClassGoal(classId: string): Promise<MyClassGoal | null> {
    return apiClient.get<MyClassGoal | null>(
      `/attendance/classes/${classId}/my-goal`
    );
  },

  async updateMyClassGoal(classId: string, goal: string): Promise<{ id: string; goal: string }> {
    return apiClient.patch<{ id: string; goal: string }>(
      `/attendance/classes/${classId}/my-goal`,
      { goal }
    );
  },
};
