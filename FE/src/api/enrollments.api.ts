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
    const res = await apiClient.get<{ success: boolean; data: SlotEvaluationItem[] }>(
      `/attendance/schedules/${scheduleId}/evaluations`
    );
    return res.data;
  },

  async saveScheduleEvaluation(
    scheduleId: string,
    data: { memberId: string; progress: number; description?: string | null }
  ): Promise<{ evaluation: any; goal: any }> {
    const res = await apiClient.post<{ success: boolean; data: { evaluation: any; goal: any } }>(
      `/attendance/schedules/${scheduleId}/evaluations`,
      data
    );
    return res.data;
  },

  async getMyClassGoal(classId: string): Promise<MyClassGoal> {
    const res = await apiClient.get<{ success: boolean; data: MyClassGoal }>(
      `/attendance/classes/${classId}/my-goal`
    );
    return res.data;
  },

  async updateMyClassGoal(classId: string, goal: string): Promise<{ id: string; goal: string }> {
    const res = await apiClient.patch<{ success: boolean; data: { id: string; goal: string } }>(
      `/attendance/classes/${classId}/my-goal`,
      { goal }
    );
    return res.data;
  },
};
