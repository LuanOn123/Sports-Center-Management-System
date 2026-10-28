import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { at, display } from "../../shared/config";
import { getFacilityId } from "../../shared/facility";
import {
  canTeach,
  classSportIds,
  loadQualifiedCoaches,
} from "../../shared/coachEligibility";
import { ErrorState, Loading } from "../../shared/ui";

export function ScheduleCoachForm({
  scheduleId,
  onSuccess,
  onCancel,
  onBusyChange,
}: {
  scheduleId: string;
  onSuccess: () => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [coachId, setCoachId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const query = useQuery({
    queryKey: ["schedule-coach-assignment", getFacilityId(), scheduleId],
    queryFn: async ({ signal }) => {
      const schedule = await api<RecordData>("GET /class-schedules/{id}", {
        params: { id: scheduleId },
        signal,
      });
      if (schedule.data.status !== "SCHEDULED")
        throw new Error("Chỉ có thể gán HLV cho buổi học đang lên lịch.");
      const classId = String(
        schedule.data.classId || at(schedule.data, "class.id") || "",
      );
      if (!classId) throw new Error("Không xác định được lớp của buổi học.");
      const [sports, coaches] = await Promise.all([
        classSportIds(classId, signal),
        loadQualifiedCoaches(signal),
      ]);
      return {
        schedule: schedule.data,
        currentCoachName: coaches.find(
          (coach) =>
            coach.id ===
            String(
              schedule.data.coachId || at(schedule.data, "coach.id") || "",
            ),
        )?.name,
        coaches: coaches.filter((coach) => canTeach(sports, coach.sportIds)),
      };
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const { schedule, coaches } = query.data;
  const currentId = String(schedule.coachId || at(schedule, "coach.id") || "");
  const currentName =
    query.data.currentCoachName ||
    at(schedule, "coach.user.fullName") ||
    at(schedule, "coach.fullName") ||
    (!currentId
      ? at(schedule, "class.coaches.0.coach.user.fullName")
      : "HLV đã phân công");
  return (
    <form
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !coaches.some((coach) => coach.id === coachId)) return;
        setBusy(true);
        onBusyChange(true);
        setError(undefined);
        try {
          const fresh = await api<RecordData>("GET /class-schedules/{id}", {
            params: { id: scheduleId },
          });
          if (fresh.data.status !== "SCHEDULED")
            throw new Error(
              "Buổi học đã đổi trạng thái. Không thể thay đổi HLV.",
            );
          // Recheck eligibility so a stale form cannot use revoked teaching permissions.
          const classId = String(
            fresh.data.classId || at(fresh.data, "class.id") || "",
          );
          const [sports, available] = await Promise.all([
            classSportIds(classId),
            loadQualifiedCoaches(),
          ]);
          if (
            !available.some(
              (coach) =>
                coach.id === coachId && canTeach(sports, coach.sportIds),
            )
          )
            throw new Error(
              "HLV không còn phù hợp với lớp hoặc không còn hoạt động tại cơ sở. Hãy tải lại danh sách.",
            );
          await api("PATCH /class-schedules/{id}", {
            params: { id: scheduleId },
            body: { coachId },
          });
          onSuccess();
        } catch (caught) {
          setError(caught);
        } finally {
          setBusy(false);
          onBusyChange(false);
        }
      }}
    >
      <p className="field-note">
        Phân công chỉ áp dụng cho buổi học này, không thay đổi HLV của toàn bộ
        lớp. Hệ thống sẽ kiểm tra trùng lịch khi lưu.
      </p>
      <dl className="details">
        <div>
          <dt>Lớp học</dt>
          <dd>{display(at(schedule, "class.name"))}</dd>
        </div>
        <div>
          <dt>Thời gian</dt>
          <dd>
            {display(schedule.startTime)} – {display(schedule.endTime)}
          </dd>
        </div>
        <div>
          <dt>HLV hiện tại</dt>
          <dd>
            {String(currentName || "Chưa phân công")}
            {!currentId && currentName ? " (theo phân công lớp)" : ""}
          </dd>
        </div>
      </dl>
      <fieldset className="form-grid" disabled={busy}>
        <label className="wide">
          Huấn luyện viên
          <select
            required
            value={coachId}
            onChange={(event) => setCoachId(event.target.value)}
          >
            <option value="">Chọn HLV phù hợp</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
                {coach.id === currentId ? " (hiện tại)" : ""}
              </option>
            ))}
          </select>
        </label>
        {!coaches.length && (
          <p role="status">
            Chưa có HLV được gán đủ bộ môn của lớp. Cập nhật bộ môn giảng dạy
            tại Nhân sự cơ sở trước khi phân công.
          </p>
        )}
      </fieldset>
      {error != null && (
        <>
          <ErrorState error={error} />
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => query.refetch()}
          >
            Tải lại danh sách HLV
          </button>
        </>
      )}
      <div className="modal-footer">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button
          className="button primary"
          disabled={
            busy ||
            coachId === currentId ||
            !coaches.some((coach) => coach.id === coachId)
          }
        >
          {busy ? "Đang phân công…" : "Lưu phân công"}
        </button>
      </div>
    </form>
  );
}
