import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, CalendarDays, Plus } from "lucide-react";
import { api } from "../../shared/api";
import { getFacilityId } from "../../shared/facility";
import { formatMemberDate } from "../../shared/memberFormat";
import { Empty, ErrorState, Loading, Modal } from "../../shared/ui";
import { StatusBadge } from "../../shared/StatusBadge";
import "./coach-changes.css";

type Session = {
  id: string;
  startTime: string;
  endTime: string;
  class: { name: string };
  room: { name: string };
};
type ChangeRequest = {
  id: string;
  status: string;
  reason: string;
  decisionReason?: string;
  requestedStartTime: string;
  requestedEndTime: string;
  schedule: Session;
  requester: { user: { fullName: string } };
  replacement?: { user: { fullName: string } } | null;
};
const when = (value: string) =>
  formatMemberDate(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function CoachChangesPage({
  role,
}: {
  role: "COACH" | "MANAGER" | "ADMIN";
}) {
  const cache = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [reason, setReason] = useState("");
  const [coachId, setCoachId] = useState("");
  const [action, setAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [filter, setFilter] = useState("");
  const facilityId = getFacilityId();
  const requests = useQuery({
    queryKey: ["coach-changes", facilityId, role],
    queryFn: ({ signal }) =>
      api<ChangeRequest[]>("GET /coach-change-requests", { signal }),
  });
  const sessions = useQuery({
    queryKey: ["coach-change-sessions", facilityId],
    queryFn: ({ signal }) =>
      api<Session[]>("GET /coach-change-requests/sessions", { signal }),
    enabled: creating && role === "COACH",
  });
  const candidates = useQuery({
    queryKey: ["coach-change-candidates", facilityId, selected?.id],
    queryFn: ({ signal }) =>
      api<{ id: string; fullName: string }[]>(
        "GET /coach-change-requests/{id}/candidates",
        { params: { id: selected!.id }, signal },
      ),
    enabled: Boolean(selected) && role === "MANAGER",
  });
  const finish = () => {
    setCreating(false);
    setSelected(null);
    void cache.invalidateQueries();
  };
  const create = useMutation({
    mutationFn: () =>
      api("POST /coach-change-requests", {
        body: { scheduleId: sessionId, reason: reason.trim() },
      }),
    onSuccess: finish,
  });
  const decide = useMutation({
    mutationFn: () =>
      api("PATCH /coach-change-requests/{id}", {
        params: { id: selected!.id },
        body: {
          status: action,
          reason: reason.trim(),
          ...(action === "APPROVED" ? { coachId } : {}),
        },
      }),
    onSuccess: finish,
    onError: () => {
      void candidates.refetch();
    },
  });
  const chosen = sessions.data?.data.find((s) => s.id === sessionId);
  return (
    <section className="workflow-page coach-changes-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ĐIỀU PHỐI BUỔI HỌC</div>
          <h1>Đổi huấn luyện viên theo buổi</h1>
          <p>
            {role === "COACH"
              ? "Gửi yêu cầu cho buổi bạn đang được phân công. Quản lý cơ sở sẽ chọn huấn luyện viên thay thế."
              : "Xem xét yêu cầu và bố trí huấn luyện viên phù hợp cho từng buổi học."}
          </p>
        </div>
        {role === "COACH" && (
          <button
            className="button primary"
            onClick={() => {
              setCreating(true);
              setReason("");
              setSessionId("");
              create.reset();
            }}
          >
            <Plus size={18} />
            Tạo yêu cầu đổi HLV
          </button>
        )}
      </div>
      <div className="coach-change-filters" aria-label="Lọc yêu cầu">
        {[
          ["", "Tất cả"],
          ["PENDING", "Chờ duyệt"],
          ["APPROVED", "Đã duyệt"],
          ["REJECTED", "Từ chối"],
        ].map(([value, label]) => (
          <button
            key={value}
            className="button small"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {requests.isPending ? (
        <Loading variant="cards" />
      ) : requests.error ? (
        <ErrorState error={requests.error} retry={() => requests.refetch()} />
      ) : !requests.data?.data.filter((row) => !filter || row.status === filter)
          .length ? (
        <Empty
          text="Chưa có yêu cầu đổi huấn luyện viên"
          detail="Các yêu cầu theo từng buổi học sẽ hiển thị tại đây."
        />
      ) : (
        <div className="coach-change-list">
          {requests.data.data
            .filter((row) => !filter || row.status === filter)
            .map((row) => (
              <article className="panel coach-change-card" key={row.id}>
                <div className="coach-change-card-heading">
                  <span className="coach-change-icon">
                    <ArrowRightLeft size={21} />
                  </span>
                  <div>
                    <h2>{row.schedule.class.name}</h2>
                    <p>
                      <CalendarDays size={15} />
                      {when(row.requestedStartTime)} —{" "}
                      {formatMemberDate(row.requestedEndTime, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <StatusBadge value={row.status} />
                </div>
                <dl>
                  <div>
                    <dt>Huấn luyện viên yêu cầu</dt>
                    <dd>{row.requester.user.fullName}</dd>
                  </div>
                  <div>
                    <dt>Phòng tập</dt>
                    <dd>{row.schedule.room.name}</dd>
                  </div>
                </dl>
                <p className="coach-change-reason">{row.reason}</p>
                {row.replacement && (
                  <p>
                    HLV thay thế:{" "}
                    <strong>{row.replacement.user.fullName}</strong>
                  </p>
                )}
                {row.decisionReason && (
                  <p className="field-note">
                    Phản hồi của quản lý: {row.decisionReason}
                  </p>
                )}
                {role === "MANAGER" && row.status === "PENDING" && (
                  <button
                    className="button primary"
                    onClick={() => {
                      setSelected(row);
                      setReason("");
                      setCoachId("");
                      setAction("APPROVED");
                      decide.reset();
                    }}
                  >
                    Xem xét yêu cầu
                  </button>
                )}
              </article>
            ))}
        </div>
      )}
      {creating && (
        <Modal
          title="Yêu cầu đổi huấn luyện viên"
          onClose={() => setCreating(false)}
          dismissible={!create.isPending}
          maxWidth={700}
        >
          <form
            className="coach-change-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!create.isPending) create.mutate();
            }}
          >
            <fieldset className="form-grid" disabled={create.isPending}>
              <label className="wide">
                <span>Buổi học cần đổi HLV</span>
                <select
                  required
                  value={sessionId}
                  disabled={
                    sessions.isPending || sessions.isError || create.isPending
                  }
                  onChange={(event) => setSessionId(event.target.value)}
                >
                  <option value="">
                    {sessions.isPending
                      ? "Đang tải lịch dạy…"
                      : "Chọn buổi học"}
                  </option>
                  {sessions.data?.data.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.class.name} · {when(session.startTime)}
                    </option>
                  ))}
                </select>
              </label>
              {sessions.error && (
                <div className="wide">
                  <ErrorState
                    error={sessions.error}
                    retry={() => sessions.refetch()}
                  />
                </div>
              )}
              {sessions.isSuccess && !sessions.data.data.length && (
                <p className="field-note wide">
                  Bạn chưa có buổi học sắp tới có thể gửi yêu cầu, hoặc các buổi
                  đó đã có yêu cầu chờ duyệt.
                </p>
              )}
              {chosen && (
                <p className="coach-change-info wide">
                  {chosen.room.name} · {when(chosen.startTime)}. Yêu cầu chỉ áp
                  dụng cho buổi này; lịch dạy còn lại giữ nguyên.
                </p>
              )}
              <label className="wide">
                <span>Lý do đề nghị đổi HLV</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Nêu lý do cần bố trí huấn luyện viên khác cho buổi học này…"
                />
              </label>
            </fieldset>
            {create.error && (
              <div className="coach-change-error">
                <ErrorState error={create.error} />
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="button"
                disabled={create.isPending}
                onClick={() => setCreating(false)}
              >
                Hủy
              </button>
              <button
                className="button primary"
                disabled={
                  create.isPending || !sessionId || reason.trim().length < 3
                }
              >
                {create.isPending ? "Đang gửi…" : "Gửi yêu cầu"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title="Xem xét đổi huấn luyện viên"
          onClose={() => setSelected(null)}
          dismissible={!decide.isPending}
          maxWidth={700}
        >
          <form
            className="coach-change-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!decide.isPending) decide.mutate();
            }}
          >
            <fieldset className="form-grid" disabled={decide.isPending}>
              <div className="coach-change-info wide">
                <strong>{selected.schedule.class.name}</strong>
                <p>
                  {when(selected.requestedStartTime)} ·{" "}
                  {selected.requester.user.fullName}
                </p>
                <p>{selected.reason}</p>
              </div>
              <label className="wide">
                <span>Kết quả xử lý</span>
                <select
                  value={action}
                  onChange={(event) =>
                    setAction(event.target.value as "APPROVED" | "REJECTED")
                  }
                >
                  <option value="APPROVED">Duyệt và đổi huấn luyện viên</option>
                  <option value="REJECTED">Từ chối yêu cầu</option>
                </select>
              </label>
              {action === "APPROVED" && (
                <label className="wide">
                  <span>Huấn luyện viên thay thế</span>
                  <select
                    required
                    value={coachId}
                    disabled={
                      candidates.isPending ||
                      candidates.isError ||
                      decide.isPending
                    }
                    onChange={(event) => setCoachId(event.target.value)}
                  >
                    <option value="">
                      {candidates.isPending
                        ? "Đang kiểm tra huấn luyện viên…"
                        : "Chọn huấn luyện viên thay thế"}
                    </option>
                    {candidates.data?.data.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {action === "APPROVED" &&
                candidates.isSuccess &&
                !candidates.data.data.length && (
                  <p className="field-note wide">
                    Chưa có HLV khác phù hợp chuyên môn và lịch dạy tại cơ sở.
                    Bạn có thể từ chối và ghi rõ lý do để coach biết.
                  </p>
                )}
              {action === "APPROVED" && candidates.error && (
                <div className="wide">
                  <ErrorState
                    error={candidates.error}
                    retry={() => candidates.refetch()}
                  />
                </div>
              )}
              <label className="wide">
                <span>Phản hồi cho huấn luyện viên</span>
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                />
              </label>
            </fieldset>
            {decide.error && (
              <div className="coach-change-error">
                <ErrorState error={decide.error} />
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="button"
                disabled={decide.isPending}
                onClick={() => setSelected(null)}
              >
                Hủy
              </button>
              <button
                className="button primary"
                disabled={
                  decide.isPending ||
                  reason.trim().length < 3 ||
                  (action === "APPROVED" && !coachId)
                }
              >
                {decide.isPending
                  ? "Đang xử lý…"
                  : action === "APPROVED"
                    ? "Duyệt & đổi HLV"
                    : "Xác nhận từ chối"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
