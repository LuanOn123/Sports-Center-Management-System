import { useState } from "react";
import { api, type RecordData } from "../../shared/api";
import { ErrorState } from "../../shared/ui";

export function attendanceReportData(description: unknown): RecordData | null {
  if (typeof description !== "string") return null;
  try {
    const data: unknown = JSON.parse(description);
    return data &&
      typeof data === "object" &&
      "type" in data &&
      data.type === "ATTENDANCE_VIOLATION"
      ? (data as RecordData)
      : null;
  } catch {
    return null;
  }
}
export function AttendanceReportReview({
  issue,
  manager,
  onSuccess,
}: {
  issue: RecordData;
  manager: boolean;
  onSuccess: () => Promise<void>;
}) {
  const data = attendanceReportData(issue.description);
  const [decision, setDecision] = useState("REJECT");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  if (!data) return null;
  return (
    <div className="operations-form">
      <p>
        Hội viên: {String(data.memberName)} · Lớp: {String(data.className)}
      </p>
      <p>
        Đã tham gia {Number(data.attendedCount)} buổi · Vắng{" "}
        {Number(data.absentCount)}/{Number(data.totalSessions)} buổi (
        {Number(data.absenceRate).toLocaleString("vi-VN")}% tại thời điểm báo
        cáo).
      </p>
      <p>Lý do báo cáo: {String(data.reason)}</p>
      {manager && ["OPEN", "IN_PROGRESS"].includes(String(issue.status)) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              await api("POST /attendance/reports/{id}/review", {
                params: { id: String(issue.id) },
                body: { decision, response },
              });
              await onSuccess();
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Quyết định chuyên cần
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="REJECT">Giữ hội viên / từ chối báo cáo</option>
                <option value="APPROVE_REMOVAL">Duyệt hủy đăng ký lớp</option>
              </select>
            </label>
            <label>
              Lý do quyết định
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
              />
            </label>
            {decision === "APPROVE_REMOVAL" && (
              <p>
                Hủy các đăng ký tương lai của lớp này và chặn đăng ký lại theo
                quyết định chuyên cần. Lịch sử điểm danh được lưu giữ.
              </p>
            )}
            <button className="button primary">
              {busy ? "Đang xử lý…" : "Xác nhận quyết định"}
            </button>
          </fieldset>
          {error != null && <ErrorState error={error} />}
        </form>
      )}
    </div>
  );
}
