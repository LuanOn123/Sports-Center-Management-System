import { useQuery } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { allPages } from "../../shared/pagedApi";
import { classSports } from "../../shared/sports";
import { canTeach } from "../../shared/coachEligibility";
import type { CoachSportOption } from "./CoachExpertiseFields";

export function useCoachSports(id: string) {
  return useQuery({
    queryKey: ["manager-coach-sports", getFacilityId(), id],
    refetchOnMount: "always",
    queryFn: async ({ signal }) => {
      const [sports, assigned, classes] = await Promise.all([
        allPages<CoachSportOption>("GET /sports", { signal }),
        api<{ sportId: string }[]>("GET /coaches/{id}/specializations", {
          params: { id },
          signal,
        }),
        allPages<RecordData>("GET /classes", {
          query: { coachId: id },
          signal,
        }),
      ]);
      return {
        sports: sports.data,
        assigned: assigned.data.map((row) => row.sportId),
        requiredSports: classes.data
          .filter((row) => row.isActive !== false)
          .flatMap(classSports)
          .map((sport) => sport.id),
      };
    },
  });
}

export async function validateCoachSports(id: string, selected: string[]) {
  if (!selected.length) throw new Error("Bắt buộc chọn ít nhất một bộ môn.");
  const currentClasses = await allPages<RecordData>("GET /classes", {
    query: { coachId: id },
  });
  const required = currentClasses.data
    .filter((row) => row.isActive !== false)
    .flatMap(classSports)
    .map((sport) => sport.id);
  if (required.length && !canTeach(required, selected))
    throw new Error(
      "Phân công lớp của HLV vừa thay đổi. Hãy tải lại và giữ các bộ môn của lớp đang phụ trách.",
    );
}
