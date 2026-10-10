import { api, type RecordData } from "./api";
import { allPages } from "./pagedApi";
import { at } from "./config";
import { classSports } from "./sports";

export type QualifiedCoach = { id: string; name: string; sportIds: string[] };
export type CoachSpecialization = { sportId: string };

/** A multi-sport class requires every assigned coach to cover all its sports. */
export function canTeach(
  sportIds: readonly string[],
  assigned: readonly string[],
) {
  return (
    sportIds.length > 0 && sportIds.every((id) => !!id && assigned.includes(id))
  );
}

export async function loadQualifiedCoaches(
  signal?: AbortSignal,
): Promise<QualifiedCoach[]> {
  const { data } = await allPages<RecordData>("GET /coaches", { signal });
  return Promise.all(
    data
      .filter((row) => row.isActive !== false && at(row, "coachProfile.id"))
      .map(async (row) => {
        const id = String(at(row, "coachProfile.id"));
        const assigned = await api<CoachSpecialization[]>(
          "GET /coaches/{id}/specializations",
          { params: { id }, signal },
        );
        return {
          id,
          name: String(row.fullName || row.email),
          sportIds: assigned.data.map((s) => s.sportId),
        };
      }),
  );
}

export async function assertCoachCanTeach(coachId: string, sportIds: string[]) {
  const assigned = await api<CoachSpecialization[]>(
    "GET /coaches/{id}/specializations",
    { params: { id: coachId } },
  );
  if (
    !canTeach(
      sportIds,
      assigned.data.map((s) => s.sportId),
    )
  )
    throw new Error(
      "HLV chỉ được dạy những bộ môn đã được quản lý phân công. Hãy chọn HLV phù hợp với tất cả bộ môn của lớp.",
    );
}

export async function classSportIds(classId: string, signal?: AbortSignal) {
  const result = await api<RecordData>("GET /classes/{id}", {
    params: { id: classId },
    signal,
  });
  const ids = classSports(result.data).map((sport) => sport.id);
  if (!ids.length || ids.some((id) => !id))
    throw new Error(
      "Chưa xác định được bộ môn của lớp. Hãy cập nhật bộ môn trước khi phân công HLV.",
    );
  return ids;
}
