import { useState, useMemo } from "react";
import {
  CalendarDays,
  Search,
  UserCheck,
  UserPlus,
  Trash2,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  X,
} from "lucide-react";
import { ScheduleAgenda } from "../../../shared/ScheduleAgenda";
import type { RecordData } from "../../../shared/api";
import { api } from "../../../shared/api";
import { at, display } from "../../../shared/config";
import { useReceptionList } from "../api";
import { Heading, ListState, MemberPicker } from "../components";
import { StatusBadge } from "../../../shared/StatusBadge";
import { ErrorState, Loading, Modal } from "../../../shared/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type AttendanceRecord = {
  id: string;
  memberId: string;
  scheduleId: string;
  status: string;
  note?: string;
};

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function AttendanceStatusBadge({ status }: { status?: unknown }) {
  const str = status ? String(status) : "";
  if (!str) {
    return <span className="badge badge-neutral">Chưa điểm danh</span>;
  }
  switch (str) {
    case "PRESENT":
      return <span className="badge badge-success">Có mặt</span>;
    case "ABSENT":
      return <span className="badge badge-danger">Vắng mặt</span>;
    case "LATE":
      return <span className="badge badge-warning">Đi muộn</span>;
    case "EXCUSED":
      return <span className="badge badge-info">Vắng có phép</span>;
    default:
      return <span className="badge badge-neutral">{display(str)}</span>;
  }
}

function EnrollmentBadge({ status }: { status?: unknown }) {
  const str = status ? String(status) : "";
  switch (str) {
    case "BOOKED":
      return <span className="badge badge-success">Đã đăng ký</span>;
    case "CANCELLED":
      return <span className="badge badge-danger">Đã hủy</span>;
    case "COMPLETED":
      return <span className="badge badge-info">Hoàn tất</span>;
    default:
      return <span className="badge badge-neutral">{display(str)}</span>;
  }
}

export function ClassesPage() {
  const client = useQueryClient();
  const [member, setMember] = useState<RecordData | null>(null);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState("");
  const [schedule, setSchedule] = useState<RecordData | null>(null);

  // Table search & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Booking & Cancellation states
  const [showBookModal, setShowBookModal] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookError, setBookError] = useState<unknown>(null);

  const [confirmCancelRow, setConfirmCancelRow] = useState<RecordData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<unknown>(null);

  const schedules = useReceptionList("GET /class-schedules", {
    page: String(page),
    limit: "10",
    ...(date ? { date } : {}),
  });

  const enrollments = useReceptionList(
    "GET /enrollments/schedule/{scheduleId}",
    {},
    { scheduleId: String(schedule?.id || "") },
    Boolean(schedule?.id),
  );

  const attendanceQuery = useQuery({
    queryKey: ["attendance", schedule?.id],
    queryFn: ({ signal }) =>
      api<AttendanceRecord[]>("GET /attendance", {
        query: { scheduleId: String(schedule?.id || "") },
        signal,
      }),
    enabled: Boolean(schedule?.id),
  });

  // Calculate schedule statistics
  const totalBooked = useMemo(() => {
    return (
      enrollments.data?.data?.filter((r) => r.status === "BOOKED").length || 0
    );
  }, [enrollments.data?.data]);

  const capacity = Number(at(schedule, "class.capacity")) || 0;
  const spotsLeft =
    capacity > 0 ? Math.max(0, capacity - totalBooked) : undefined;

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    if (attendanceQuery.data?.data && Array.isArray(attendanceQuery.data.data)) {
      for (const att of attendanceQuery.data.data) {
        map.set(att.memberId, att);
      }
    }
    return map;
  }, [attendanceQuery.data?.data]);

  const attendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    attendanceMap.forEach((att) => {
      if (att.status === "PRESENT") present++;
      else if (att.status === "ABSENT") absent++;
      else if (att.status === "LATE") late++;
    });
    return { present, absent, late, total: attendanceMap.size };
  }, [attendanceMap]);

  // Selected member check
  const selectedMemberId = member ? String(member.id) : "";
  const isAlreadyEnrolled = useMemo(() => {
    if (!selectedMemberId || !enrollments.data?.data) return false;
    return enrollments.data.data.some(
      (e) =>
        (String(e.memberId) === selectedMemberId ||
          String(at(e, "member.id")) === selectedMemberId) &&
        e.status === "BOOKED",
    );
  }, [selectedMemberId, enrollments.data?.data]);

  const isSchedulePast = schedule
    ? new Date(String(schedule.startTime)).getTime() <= Date.now()
    : false;
  const isScheduleCancelled = schedule?.status === "CANCELLED";
  const isFull = capacity > 0 && totalBooked >= capacity;

  // Filtered enrollments for the streamlined table
  const filteredEnrollments = useMemo(() => {
    if (!enrollments.data?.data) return [];
    return enrollments.data.data.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const fullName = String(
          at(row, "member.user.fullName") || "",
        ).toLowerCase();
        const email = String(
          at(row, "member.user.email") || "",
        ).toLowerCase();
        const phone = String(
          at(row, "member.user.phone") || "",
        ).toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !phone.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [enrollments.data?.data, searchTerm, statusFilter]);

  async function handleConfirmBook() {
    if (!member || !schedule) return;
    setIsBooking(true);
    setBookError(null);
    try {
      await api("POST /enrollments", {
        body: {
          scheduleId: String(schedule.id),
          memberId: String(member.id),
        },
      });
      setShowBookModal(false);
      void enrollments.refetch();
      void client.invalidateQueries({
        queryKey: ["reception", "GET /enrollments/schedule/{scheduleId}"],
      });
    } catch (err) {
      setBookError(err);
    } finally {
      setIsBooking(false);
    }
  }

  async function handleConfirmCancel() {
    if (!confirmCancelRow) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api("DELETE /enrollments/{id}", {
        params: { id: String(confirmCancelRow.id) },
      });
      setConfirmCancelRow(null);
      void enrollments.refetch();
      void client.invalidateQueries({
        queryKey: ["reception", "GET /enrollments/schedule/{scheduleId}"],
      });
    } catch (err) {
      setCancelError(err);
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <Heading title="Đăng ký lớp học" />
      <ol className="booking-steps" aria-label="Các bước đăng ký">
        <li className={!member ? "current" : "done"}>
          <span>1</span>Chọn hội viên
        </li>
        <li
          className={member && !schedule ? "current" : schedule ? "done" : ""}
        >
          <span>2</span>Chọn buổi học
        </li>
        <li className={member && schedule ? "current" : ""}>
          <span>3</span>Xác nhận &amp; Quản lý đăng ký
        </li>
      </ol>

      <MemberPicker
        value={member}
        onChange={(m) => {
          setMember(m);
        }}
      />

      <section className="panel reception-section">
        <h2>Lịch học theo buổi</h2>
        <div className="collection-toolbar">
          <p>Chọn một buổi học để xem danh sách đăng ký, kiểm tra chuyên cần và hỗ trợ hội viên.</p>
          <label className="agenda-filter">
            <CalendarDays size={18} aria-hidden="true" />
            <span className="sr-only">Ngày học</span>
            <input
              aria-label="Ngày học"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {date && (
            <button
              className="button small"
              onClick={() => {
                setDate("");
                setPage(1);
              }}
            >
              Tất cả ngày
            </button>
          )}
        </div>
        <ListState result={schedules}>
          {(rows) => (
            <ScheduleAgenda
              rows={rows}
              selectedId={schedule ? String(schedule.id) : undefined}
              actions={(row) => (
                <button
                  className={`button small ${String(row.id) === String(schedule?.id) ? "primary" : ""}`}
                  onClick={() => setSchedule(row)}
                >
                  {String(row.id) === String(schedule?.id) ? "Đang chọn" : "Xem đăng ký"}
                </button>
              )}
            />
          )}
        </ListState>
        <div className="pagination">
          <button
            className="button"
            disabled={page <= 1 || schedules.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span>Trang {page}</span>
          <button
            className="button"
            disabled={
              schedules.isFetching ||
              !schedules.data?.pagination ||
              page >= schedules.data.pagination.totalPages
            }
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      </section>

      {schedule && (
        <section className="panel reception-section">
          {/* Header information */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px",
              borderBottom: "1px solid var(--color-border, #333)",
              paddingBottom: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h2 style={{ margin: 0 }}>{display(at(schedule, "class.name"))}</h2>
                <StatusBadge value={schedule.status} />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  color: "var(--color-text-muted, #888)",
                  marginTop: "6px",
                  fontSize: "14px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={15} />
                  {formatDateTime(schedule.startTime)} –{" "}
                  {formatDateTime(schedule.endTime)}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={15} />
                  {display(at(schedule, "room.name")) || "Chưa xếp phòng"}
                </span>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "var(--color-bg-secondary, rgba(255,255,255,0.05))",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #444)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "11px", color: "var(--color-text-muted, #aaa)", textTransform: "uppercase" }}>
                  Sĩ số lớp
                </div>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>
                  {totalBooked} {capacity > 0 ? `/ ${capacity}` : ""}{" "}
                  <span style={{ fontSize: "12px", fontWeight: "normal", color: spotsLeft === 0 ? "var(--color-danger, #ff4d4f)" : "var(--color-success, #52c41a)" }}>
                    {spotsLeft === undefined ? "" : spotsLeft === 0 ? "(Hết chỗ)" : `(Còn ${spotsLeft})`}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: "var(--color-bg-secondary, rgba(255,255,255,0.05))",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #444)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "11px", color: "var(--color-text-muted, #aaa)", textTransform: "uppercase" }}>
                  Chuyên cần
                </div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>
                  <span style={{ color: "var(--color-success, #52c41a)" }}>{attendanceStats.present} có mặt</span>
                  {" · "}
                  <span style={{ color: "var(--color-danger, #ff4d4f)" }}>{attendanceStats.absent} vắng</span>
                  {attendanceStats.late > 0 && (
                    <span style={{ color: "var(--color-warning, #faad14)" }}>
                      {" · "}
                      {attendanceStats.late} muộn
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick action for selected member */}
          <div
            style={{
              background: "var(--color-bg-card, rgba(255, 255, 255, 0.02))",
              border: "1px solid var(--color-border, #333)",
              borderRadius: "8px",
              padding: "14px 16px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {member ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="avatar" aria-hidden="true">
                  {String(at(member, "user.fullName") || "?").slice(0, 1)}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    Hội viên đã chọn: {display(at(member, "user.fullName"))}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted, #888)" }}>
                    SĐT: {display(at(member, "user.phone")) || "—"} · Email: {display(at(member, "user.email")) || "—"}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--color-text-muted, #888)", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={18} />
                <span>Chưa chọn hội viên. Hãy chọn ở Bước 1 phía trên để tiến hành đăng ký.</span>
              </div>
            )}

            <div>
              {member && isAlreadyEnrolled ? (
                <div
                  className="badge badge-warning"
                  style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <UserCheck size={16} />
                  <span>Hội viên đã đăng ký buổi này</span>
                </div>
              ) : member && isSchedulePast ? (
                <span className="badge badge-neutral">Buổi học đã qua hoặc đang diễn ra</span>
              ) : member && isScheduleCancelled ? (
                <span className="badge badge-danger">Buổi học đã bị hủy</span>
              ) : member && isFull ? (
                <span className="badge badge-danger">Lớp học đã đủ sĩ số ({capacity})</span>
              ) : member ? (
                <button
                  className="button primary"
                  onClick={() => {
                    setBookError(null);
                    setShowBookModal(true);
                  }}
                >
                  <UserPlus size={16} />
                  Đăng ký cho {display(at(member, "user.fullName"))}
                </button>
              ) : null}
            </div>
          </div>

          {/* Table Toolbar: Search & Filter */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 280px", maxWidth: "420px" }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search
                  size={16}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-muted, #888)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm học viên theo tên, SĐT hoặc email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    paddingLeft: "32px",
                    width: "100%",
                    borderRadius: "6px",
                    height: "36px",
                  }}
                />
              </div>
              {searchTerm && (
                <button
                  className="icon-button"
                  title="Xóa tìm kiếm"
                  onClick={() => setSearchTerm("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Trạng thái:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ borderRadius: "6px", height: "36px", padding: "0 8px" }}
                >
                  <option value="ALL">Tất cả ({enrollments.data?.data?.length || 0})</option>
                  <option value="BOOKED">Đã đăng ký ({totalBooked})</option>
                  <option value="CANCELLED">Đã hủy</option>
                  <option value="COMPLETED">Hoàn tất</option>
                </select>
              </label>

              <span style={{ fontSize: "13px", color: "var(--color-text-muted, #888)" }}>
                Hiển thị {filteredEnrollments.length} kết quả
              </span>
            </div>
          </div>

          {/* Streamlined & Optimized Roster Table */}
          {enrollments.isPending ? (
            <Loading />
          ) : enrollments.isError ? (
            <ErrorState error={enrollments.error} retry={() => enrollments.refetch()} />
          ) : !enrollments.data?.data?.length ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--color-text-muted, #888)" }}>
              <Users size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
              <p>Chưa có hội viên nào đăng ký buổi học này.</p>
            </div>
          ) : !filteredEnrollments.length ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--color-text-muted, #888)" }}>
              <p>Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.</p>
              <button
                className="button small"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                }}
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Bảng danh sách đăng ký buổi học"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: "40px" }}>#</th>
                    <th scope="col">Hội viên</th>
                    <th scope="col">Số điện thoại</th>
                    <th scope="col">Email</th>
                    <th scope="col">Trạng thái đặt chỗ</th>
                    <th scope="col">Chuyên cần</th>
                    <th scope="col">Đăng ký lúc</th>
                    <th scope="col" style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((row, index) => {
                    const memberId = String(
                      row.memberId || at(row, "member.id") || "",
                    );
                    const attRecord = attendanceMap.get(memberId);
                    const isBooked = row.status === "BOOKED";

                    return (
                      <tr key={String(row.id || index)}>
                        <td style={{ color: "var(--color-text-muted, #888)", fontSize: "13px" }}>
                          {index + 1}
                        </td>
                        <td>
                          <div className="name-cell">
                            <span className="avatar" aria-hidden="true">
                              {String(at(row, "member.user.fullName") || "?").slice(0, 1)}
                            </span>
                            <strong>
                              {display(at(row, "member.user.fullName"))}
                            </strong>
                          </div>
                        </td>
                        <td>
                          {display(at(row, "member.user.phone")) || "—"}
                        </td>
                        <td style={{ color: "var(--color-text-muted, #888)", fontSize: "13px" }}>
                          {display(at(row, "member.user.email")) || "—"}
                        </td>
                        <td>
                          <EnrollmentBadge status={row.status} />
                        </td>
                        <td>
                          {/* Read-only attendance monitoring badge */}
                          <AttendanceStatusBadge status={attRecord?.status} />
                        </td>
                        <td style={{ color: "var(--color-text-muted, #888)", fontSize: "13px" }}>
                          {formatDateTime(row.bookedAt)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="button small danger"
                            disabled={!isBooked || isSchedulePast || !row.id}
                            title={
                              isSchedulePast
                                ? "Không thể hủy buổi học đã diễn ra"
                                : !isBooked
                                ? "Đăng ký đã ở trạng thái hủy/hoàn tất"
                                : "Hủy đăng ký lớp cho hội viên này"
                            }
                            onClick={() => {
                              setCancelError(null);
                              setConfirmCancelRow(row);
                            }}
                          >
                            <Trash2 size={13} style={{ marginRight: "4px" }} />
                            Hủy đăng ký
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="field-note" style={{ marginTop: "16px" }}>
            * Lễ tân có thể xem trạng thái chuyên cần để hỗ trợ hội viên. Quyền ghi hoặc sửa điểm danh được thực hiện bởi Huấn luyện viên hoặc Quản lý.
          </p>
        </section>
      )}

      {/* Modal: Confirm Booking */}
      {showBookModal && member && schedule && (
        <Modal
          title="Xác nhận đăng ký buổi học"
          onClose={() => {
            if (!isBooking) setShowBookModal(false);
          }}
          dismissible={!isBooking}
        >
          <p>
            Bạn có chắc chắn muốn đăng ký buổi học này cho hội viên không?
          </p>
          <div
            style={{
              padding: "14px 16px",
              margin: "14px 0",
              background: "var(--color-bg-secondary, rgba(255,255,255,0.04))",
              borderRadius: "8px",
              border: "1px solid var(--color-border, #444)",
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong>Hội viên:</strong> {display(at(member, "user.fullName"))}{" "}
              ({display(at(member, "user.phone")) || display(at(member, "user.email"))})
            </div>
            <div>
              <strong>Lớp học:</strong> {display(at(schedule, "class.name"))}
            </div>
            <div>
              <strong>Thời gian:</strong> {formatDateTime(schedule.startTime)}
            </div>
            <div>
              <strong>Phòng tập:</strong> {display(at(schedule, "room.name")) || "Chưa xếp"}
            </div>
          </div>

          {bookError != null && <ErrorState error={bookError} />}

          <div className="modal-footer">
            <button
              className="button"
              disabled={isBooking}
              onClick={() => setShowBookModal(false)}
            >
              Quay lại
            </button>
            <button
              className="button primary"
              disabled={isBooking}
              onClick={handleConfirmBook}
            >
              {isBooking ? "Đang xử lý…" : "Xác nhận đăng ký"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Confirm Cancel Enrollment */}
      {confirmCancelRow && schedule && (
        <Modal
          title="Hủy đăng ký lớp học"
          onClose={() => {
            if (!isCancelling) setConfirmCancelRow(null);
          }}
          dismissible={!isCancelling}
        >
          <p>
            Bạn có chắc chắn muốn hủy đăng ký của hội viên{" "}
            <strong>
              {display(at(confirmCancelRow, "member.user.fullName"))}
            </strong>{" "}
            trong buổi học{" "}
            <strong>{display(at(schedule, "class.name"))}</strong>?
          </p>
          <p className="field-note">
            Chỗ học sẽ được thu hồi để nhường cho hội viên khác hoặc danh sách chờ. Thao tác này không thể hoàn tác trực tiếp.
          </p>

          {cancelError != null && <ErrorState error={cancelError} />}

          <div className="modal-footer">
            <button
              className="button"
              disabled={isCancelling}
              onClick={() => setConfirmCancelRow(null)}
            >
              Quay lại
            </button>
            <button
              className="button danger"
              disabled={isCancelling}
              onClick={handleConfirmCancel}
            >
              {isCancelling ? "Đang hủy…" : "Xác nhận hủy đăng ký"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
