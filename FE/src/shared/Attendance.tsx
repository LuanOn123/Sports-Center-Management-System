import { AttendanceQr } from "./QrAttendance";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "./api";
import { at, display } from "./config";
import { Empty, ErrorState, Loading } from "./ui";
import { enrollmentsApi, type SlotEvaluationItem } from "../api/enrollments.api";
import { Target, TrendingUp, MessageSquareQuote } from "lucide-react";
import "./workflow.css";

const statuses: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng mặt",
  LATE: "Đi muộn",
  EXCUSED: "Vắng có phép",
};

export type AttendanceRecord = {
  id: string;
  memberId: string;
  scheduleId: string;
  status: string;
  note?: string;
};

export function getProgressTheme(pct: number) {
  if (pct < 20) {
    return {
      color: "#ef4444",
      bg: "#fee2e2",
      border: "#fca5a5",
      label: "Cần nỗ lực (<20%)",
      barColor: "#ef4444",
    };
  }
  if (pct < 70) {
    return {
      color: "#f59e0b",
      bg: "#fef3c7",
      border: "#fcd34d",
      label: "Đang tiến bộ (20–69%)",
      barColor: "#f59e0b",
    };
  }
  return {
    color: "#10b981",
    bg: "#d1fae5",
    border: "#6ee7b7",
    label: "Tiến độ tốt (≥70%)",
    barColor: "#10b981",
  };
}
export function Attendance({
  schedule,
  roster,
  role,
}: {
  schedule: RecordData;
  roster: RecordData[];
  role: string;
}) {
  const id = String(schedule.id),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["attendance", id],
    queryFn: ({ signal }) =>
      api<AttendanceRecord[]>("GET /attendance", {
        query: { scheduleId: id },
        signal,
      }),
  });
  const evQuery = useQuery({
    queryKey: ["schedule-evaluations", id],
    queryFn: () => enrollmentsApi.getScheduleEvaluations(id),
    enabled: ["ADMIN", "MANAGER", "COACH"].includes(role),
  });
  const canWrite =
    ["ADMIN", "MANAGER", "COACH"].includes(role) &&
    schedule.status !== "CANCELLED" &&
    Date.parse(String(schedule.startTime)) - 30 * 60000 <= Date.now() &&
    Date.now() <= Date.parse(String(schedule.endTime));
  return (
    <section className="workflow-page">
      <h3>{role === "RECEPTIONIST" ? "Chuyên cần buổi học" : "Điểm danh buổi học"}</h3>
      {["ADMIN", "MANAGER", "COACH"].includes(role) &&
        schedule.status === "SCHEDULED" && (
          <AttendanceQr scheduleId={id} schedule={schedule} />
        )}
      {role !== "RECEPTIONIST" && (
        <p>
          Hoàn tất lịch học sẽ ghi vắng cho hội viên chưa điểm danh. Mỗi học viên có mặt cần được ghi nhận trước khi hoàn tất buổi.
        </p>
      )}
      {!canWrite && (
        <p className="field-note">
          {role === "RECEPTIONIST"
            ? "Lễ tân chỉ có quyền xem trạng thái chuyên cần (điểm danh do Huấn luyện viên hoặc Quản lý thực hiện)."
            : "Chỉ quản lý hoặc huấn luyện viên phụ trách được điểm danh khi buổi học đã bắt đầu."}
        </p>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !roster.length ? (
        <Empty text="Chưa có học viên." />
      ) : (
        roster
          .filter((r) => ["BOOKED", "COMPLETED"].includes(String(r.status)))
          .map((r) => {
            const mid = String(r.memberId || at(r, "member.id") || ""),
              record = q.data.data.find(
                (a) => a.memberId === mid && a.scheduleId === id,
              );
            const evalData = evQuery.data?.find((e) => e.memberId === mid);
            return (
              <AttendanceRow
                key={`${mid}-${record?.id}-${record?.status}-${record?.note}-${evalData?.currentProgress}`}
                name={String(at(r, "member.user.fullName") || "Học viên")}
                memberId={mid}
                scheduleId={id}
                record={record}
                evalData={evalData}
                role={role}
                writable={record ? ["ADMIN", "MANAGER"].includes(role) : canWrite}
                canExcuse={["ADMIN", "MANAGER"].includes(role)}
                onSave={() => {
                  void cache.invalidateQueries({
                    queryKey: ["attendance", id],
                  });
                  void cache.invalidateQueries({
                    queryKey: ["schedule-evaluations", id],
                  });
                }}
              />
            );
          })
      )}
    </section>
  );
}
function AttendanceRow({
  name,
  memberId,
  scheduleId,
  record,
  evalData,
  role,
  writable,
  canExcuse,
  onSave,
}: {
  name: string;
  memberId: string;
  scheduleId: string;
  record?: AttendanceRecord;
  evalData?: SlotEvaluationItem;
  role: string;
  writable: boolean;
  canExcuse: boolean;
  onSave: () => void;
}) {
  const canEvaluate = ["ADMIN", "MANAGER", "COACH"].includes(role);
  const previousProgress = evalData?.evaluation
    ? evalData.evaluation.previousProgress
    : (evalData?.currentProgress ?? 0);
  const initialCurrentProgress = evalData?.evaluation
    ? evalData.evaluation.newProgress
    : (evalData?.currentProgress ?? 0);

  const [status, setStatus] = useState(record?.status || "");
  const [note, setNote] = useState(record?.note || "");
  const [progress, setProgress] = useState<number>(initialCurrentProgress);
  const [description, setDescription] = useState<string>(
    evalData?.evaluation?.description || ""
  );

  useEffect(() => {
    if (evalData) {
      const p = evalData.evaluation
        ? evalData.evaluation.newProgress
        : evalData.currentProgress;
      setProgress(p);
      setDescription(evalData.evaluation?.description || "");
    }
  }, [evalData]);

  const theme = getProgressTheme(progress);
  const diff = progress - previousProgress;

  const save = useMutation({
    mutationFn: async () => {
      if (writable && status) {
        await api(record ? "PATCH /attendance/{id}" : "POST /attendance", {
          params: { id: record?.id || "" },
          body: {
            ...(record ? {} : { memberId, scheduleId }),
            status,
            note: note.trim(),
          },
        });
      }
      if (canEvaluate) {
        await enrollmentsApi.saveScheduleEvaluation(scheduleId, {
          memberId,
          progress,
          description: description.trim() || null,
        });
      }
    },
    onSuccess: onSave,
  });

  return (
    <details className="feedback-card">
      <summary>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong>{name}</strong> ·{" "}
          <span>
            {record
              ? statuses[record.status] || display(record.status)
              : "Chưa điểm danh"}
          </span>
          {evalData && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: theme.color,
                background: theme.bg,
                border: `1px solid ${theme.border}`,
                padding: "1px 8px",
                borderRadius: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              🎯 {progress}%
            </span>
          )}
        </div>
      </summary>
      {writable || canEvaluate ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <fieldset disabled={save.isPending}>
            {writable && (
              <>
                <label>
                  Kết quả điểm danh
                  <select
                    required
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Chưa điểm danh</option>
                    {Object.entries(statuses)
                      .filter(([v]) => v !== "EXCUSED" || canExcuse)
                      .map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Ghi chú điểm danh
                  <input
                    maxLength={1000}
                    required={!!record}
                    minLength={record ? 3 : undefined}
                    placeholder={record ? "Lý do sửa điểm danh" : "Ghi chú"}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </>
            )}

            {canEvaluate && (
              <div
                style={{
                  marginTop: 12,
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "var(--member-surface-alt, rgba(255, 255, 255, 0.04))",
                  border: "1px solid var(--member-border, #334155)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Target size={16} color="#0284c7" />
                    <strong style={{ fontSize: 13 }}>Mục tiêu học viên:</strong>
                    <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                      {evalData?.goal || "Hoàn thành khóa học"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.color,
                      background: theme.bg,
                      border: `1px solid ${theme.border}`,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {theme.label}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <label
                      htmlFor={`progress-slider-${memberId}`}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        margin: 0,
                      }}
                    >
                      <TrendingUp size={15} color={theme.color} />
                      Đánh giá tiến độ sau buổi dạy:
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: theme.color,
                        }}
                      >
                        {progress}%
                      </span>
                      {diff !== 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: diff > 0 ? "#10b981" : "#ef4444",
                            background: diff > 0 ? "#d1fae5" : "#fee2e2",
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {diff > 0 ? `+${diff}%` : `${diff}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  <input
                    id={`progress-slider-${memberId}`}
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: theme.barColor,
                      cursor: "pointer",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    <span style={{ color: "#ef4444" }}>0% (Cần nỗ lực &lt;20%)</span>
                    <span style={{ color: "#f59e0b" }}>50% (Đang tiến bộ &lt;70%)</span>
                    <span style={{ color: "#10b981" }}>100% (Đạt mục tiêu ≥70%)</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`eval-desc-${memberId}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <MessageSquareQuote size={15} color="#64748b" />
                    Lời dặn / Ghi chú cho học viên:
                  </label>
                  <textarea
                    id={`eval-desc-${memberId}`}
                    rows={2}
                    maxLength={1000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập nhận xét lý do tăng/giảm tiến độ, lời dặn kỹ thuật động tác..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--member-border, #cbd5e1)",
                      fontSize: 12,
                      lineHeight: 1.4,
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            )}

            <button className="button small primary" disabled={save.isPending}>
              {save.isPending ? "Đang lưu…" : "Lưu đánh giá & điểm danh"}
            </button>
          </fieldset>
        </form>
      ) : (
        <div>
          <p>
            {record
              ? statuses[record.status] || display(record.status)
              : "Chưa điểm danh"}
            {record?.note ? ` · ${record.note}` : ""}
          </p>
          {evalData && (
            <p style={{ fontSize: 13 }}>
              🎯 Mục tiêu: <strong>{evalData.goal}</strong> | Tiến độ:{" "}
              <strong style={{ color: theme.color }}>{progress}%</strong>
            </p>
          )}
        </div>
      )}
      {save.error && <ErrorState error={save.error} />}
    </details>
  );
}
