import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import {
  assertCoachCanTeach,
  canTeach,
  classSportIds,
  loadQualifiedCoaches,
} from "../../shared/coachEligibility";
import { ErrorState, Loading } from "../../shared/ui";

export function CoachAssignmentForm({
  classId,
  support,
  onSuccess,
  onCancel,
  onBusyChange,
}: {
  classId: string;
  support: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [coachId, setCoachId] = useState("");
  const [primary, setPrimary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const coaches = useQuery({
    queryKey: ["qualified-coaches", getFacilityId()],
    queryFn: ({ signal }) => loadQualifiedCoaches(signal),
  });
  const sports = useQuery({
    queryKey: ["coach-assignment-sports", getFacilityId(), classId],
    queryFn: ({ signal }) => classSportIds(classId, signal),
  });
  if (coaches.isPending || sports.isPending) return <Loading />;
  if (coaches.error || sports.error)
    return (
      <ErrorState
        error={coaches.error || sports.error}
        retry={() => {
          void coaches.refetch();
          void sports.refetch();
        }}
      />
    );
  const eligible = coaches.data.filter((coach) =>
    canTeach(sports.data, coach.sportIds),
  );
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError(undefined);
        setBusy(true);
        onBusyChange(true);
        try {
          if (!eligible.some((coach) => coach.id === coachId))
            throw new Error("Hãy chọn HLV có bộ môn phù hợp.");
          await assertCoachCanTeach(coachId, await classSportIds(classId));
          await api(
            support
              ? "POST /classes/{id}/coaches/support"
              : "POST /classes/{id}/coaches",
            {
              params: { id: classId },
              body: { coachId, ...(!support ? { isPrimary: primary } : {}) },
            },
          );
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
        Chỉ hiển thị HLV được gán đủ bộ môn của lớp. Quản lý cập nhật quyền
        giảng dạy tại Người dùng → Bộ môn giảng dạy.
      </p>
      <fieldset className="form-grid" disabled={busy}>
        <label className="wide">
          Huấn luyện viên
          <select
            required
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
          >
            <option value="">Chọn HLV phù hợp</option>
            {eligible.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </select>
        </label>
        {!support && (
          <label>
            <input
              type="checkbox"
              checked={primary}
              onChange={(e) => setPrimary(e.target.checked)}
            />
            HLV chính
          </label>
        )}
        {!eligible.length && (
          <p role="status">
            Chưa có HLV được gán đủ bộ môn của lớp. Hãy cập nhật bộ môn giảng
            dạy trước khi phân công.
          </p>
        )}
      </fieldset>
      {error != null && <ErrorState error={error} />}
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
          disabled={busy || !eligible.some((coach) => coach.id === coachId)}
        >
          {busy ? "Đang phân công…" : "Phân công"}
        </button>
      </div>
    </form>
  );
}
