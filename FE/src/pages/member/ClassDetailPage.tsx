import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  CalendarDays,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import { classesApi } from "../../api/classes.api";
import { enrollmentsApi } from "../../api/enrollments.api";
import { authApi } from "../../api/auth.api";
import { EnrollConfirmModal } from "../../components/member/EnrollConfirmModal";
import {
  AlertBanner,
  EmptyState,
  LoadingSpinner,
  StatusBadge,
} from "../../components/common";
import { CoachCard, CoachProfileDialog } from "../../shared/CoachProfileDialog";
import type { CoachInfo } from "../../types/member";
import { WaitlistAction } from "../../shared/Waitlist";
import { ErrorState } from "../../shared/feedback";
import { formatMemberDate } from "../../shared/memberFormat";
import { sportNames } from "../../shared/sports";
import {
  applyWholeCourseEnrollment,
  isWholeCourseRegistered,
} from "../../shared/courseRegistration";
import type {
  CoursePlan,
  CoursePlanSession,
  CourseRegistrationBlocker,
} from "../../types/member";

function courseBlockers(error: unknown): CourseRegistrationBlocker[] {
  const raw =
    (error as { details?: unknown; errors?: unknown } | undefined)?.details ??
    (error as { errors?: unknown } | undefined)?.errors;
  const details = (raw as { details?: unknown } | undefined)?.details;
  return Array.isArray(details) ? (details as CourseRegistrationBlocker[]) : [];
}

function isFreeQuotaBlocker(
  blocker: CourseRegistrationBlocker,
  tier?: string | null,
) {
  return (
    blocker.code === "CONCURRENT_CLASS_LIMIT_REACHED" &&
    (blocker.details?.tier ?? tier) === "FREE"
  );
}

function blockerText(blocker: CourseRegistrationBlocker, tier?: string | null) {
  if (isFreeQuotaBlocker(blocker, tier))
    return "Tài khoản Free chưa bao gồm quyền đăng ký lớp học. Vui lòng chọn gói Membership hoặc Premium để tham gia.";
  if (!blocker.startTime) return blocker.message;
  return `${blocker.message} (${formatMemberDate(blocker.startTime, {
    hour: "2-digit",
    minute: "2-digit",
  })}${blocker.roomName ? ` · ${blocker.roomName}` : ""})`;
}

function sessionLabel(session: CoursePlanSession) {
  if (session.myEnrollmentStatus === "BOOKED")
    return {
      text: "Đã đặt",
      color: "var(--member-success, #267346)",
      background: "var(--member-success-soft, #edfcf2)",
    };
  if (session.myEnrollmentStatus === "COMPLETED")
    return {
      text: "Đã hoàn thành",
      color: "var(--member-info, #026aa2)",
      background: "var(--member-info-soft, #f0f9ff)",
    };
  if (session.isFull)
    return {
      text: "Hết chỗ",
      color: "var(--member-danger, #d92d20)",
      background: "var(--member-danger-soft, #fef3f2)",
    };
  if (session.conflictWith)
    return {
      text: `Trùng giờ với ${session.conflictWith.className}`,
      color: "var(--member-warning, #b54708)",
      background: "var(--member-warning-soft, #fffaeb)",
    };
  return {
    text: "Chưa đặt",
    color: "var(--member-muted, #475467)",
    background: "var(--member-surface-alt, #f2f4f7)",
  };
}

const WEEKDAYS_MAP = [
  { weekday: 1, label: "Thứ 2", short: "T2" },
  { weekday: 2, label: "Thứ 3", short: "T3" },
  { weekday: 3, label: "Thứ 4", short: "T4" },
  { weekday: 4, label: "Thứ 5", short: "T5" },
  { weekday: 5, label: "Thứ 6", short: "T6" },
  { weekday: 6, label: "Thứ 7", short: "T7" },
  { weekday: 7, label: "Chủ nhật", short: "CN" },
];

function CourseScheduleTableView({
  course,
  sessions,
}: {
  course: NonNullable<CoursePlan["course"]>;
  sessions: CoursePlanSession[];
}) {
  const [viewMode, setViewMode] = useState<"table" | "weekly">("table");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        marginTop: 16,
        padding: "20px 22px",
        borderRadius: 16,
        background: "var(--member-surface, #131a26)",
        border: "1px solid var(--member-border, #263143)",
      }}
    >
      {/* Header with Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(212, 255, 0, 0.1)",
              border: "1px solid var(--member-accent-border, #526222)",
              color: "var(--member-accent, #d4ff00)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalendarDays size={18} />
          </div>
          <div>
            <strong
              style={{
                fontSize: 15,
                color: "var(--member-text, #f1f4f9)",
                display: "block",
              }}
            >
              Lịch trình khóa học ({course.totalSessions} buổi)
            </strong>
            <span
              style={{ fontSize: 12, color: "var(--member-muted, #9baac0)" }}
            >
              {formatMemberDate(course.firstSessionStart)} →{" "}
              {formatMemberDate(course.lastSessionStart)}
            </span>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 3,
            borderRadius: 10,
            background: "var(--member-surface-alt, #0e141e)",
            border: "1px solid var(--member-border, #263143)",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode("table")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              background:
                viewMode === "table"
                  ? "var(--member-accent, #d4ff00)"
                  : "transparent",
              color:
                viewMode === "table" ? "#000" : "var(--member-muted, #9baac0)",
            }}
          >
            <TableIcon size={14} />
            Bảng danh sách ({course.totalSessions})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("weekly")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              background:
                viewMode === "weekly"
                  ? "var(--member-accent, #d4ff00)"
                  : "transparent",
              color:
                viewMode === "weekly" ? "#000" : "var(--member-muted, #9baac0)",
            }}
          >
            <LayoutGrid size={14} />
            Thời khóa biểu tuần
          </button>
        </div>
      </div>

      {/* VIEW 1: TABLE */}
      {viewMode === "table" && (
        <div
          style={{
            overflowX: "auto",
            maxHeight: 480,
            borderRadius: 12,
            border: "1px solid var(--member-border, #263143)",
            background: "var(--member-surface-alt, #0e141e)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: 13,
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                background: "var(--member-surface, #131a26)",
                borderBottom: "1px solid var(--member-border, #263143)",
                zIndex: 2,
              }}
            >
              <tr>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                    width: 70,
                  }}
                >
                  Buổi
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                  }}
                >
                  Thứ & Ngày tập
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                  }}
                >
                  Khung giờ
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                  }}
                >
                  Phòng tập
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                  }}
                >
                  Chỗ trống
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                  }}
                >
                  Trạng thái
                </th>
                <th
                  style={{
                    padding: "12px 14px",
                    color: "var(--member-muted, #9baac0)",
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, idx) => {
                const label = sessionLabel(session);
                const isOdd = idx % 2 === 1;
                const availablePct = Math.round(
                  (session.remainingSlots / course.capacity) * 100,
                );

                return (
                  <tr
                    key={session.id}
                    style={{
                      background: isOdd
                        ? "rgba(255, 255, 255, 0.02)"
                        : "transparent",
                      borderBottom: "1px solid var(--member-border, #263143)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 12,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "var(--member-surface, #131a26)",
                          border: "1px solid var(--member-border, #263143)",
                          color: "var(--member-accent, #d4ff00)",
                        }}
                      >
                        #{String(idx + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              session.weekday === 2 ? "#1e293b" : "#172554",
                            color:
                              session.weekday === 2 ? "#38bdf8" : "#818cf8",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                          }}
                        >
                          {session.weekdayLabel}
                        </span>
                        <span
                          style={{
                            color: "var(--member-text, #f1f4f9)",
                            fontWeight: 600,
                          }}
                        >
                          {formatMemberDate(session.startTime)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--member-text, #f1f4f9)",
                          fontWeight: 600,
                        }}
                      >
                        <Clock
                          size={14}
                          color="var(--member-accent, #d4ff00)"
                        />
                        {session.timeLabel}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: "var(--member-muted, #9baac0)",
                        }}
                      >
                        <MapPin size={13} />
                        {session.room.name}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: session.isFull
                              ? "var(--member-danger, #ff8d9a)"
                              : "var(--member-success, #64dfb4)",
                          }}
                        >
                          {session.isFull
                            ? "Hết chỗ"
                            : `Còn ${session.remainingSlots}/${course.capacity}`}
                        </span>
                        <div
                          style={{
                            width: 80,
                            height: 4,
                            background: "rgba(255, 255, 255, 0.1)",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${availablePct}%`,
                              height: "100%",
                              background: session.isFull
                                ? "var(--member-danger, #ff8d9a)"
                                : "var(--member-success, #64dfb4)",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 999,
                          color: label.color,
                          background: label.background,
                          fontSize: 11,
                          fontWeight: 700,
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label.text}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {session.isFull &&
                        session.status === "SCHEDULED" &&
                        Date.parse(session.startTime) > Date.now() &&
                        !["BOOKED", "COMPLETED"].includes(
                          session.myEnrollmentStatus ?? "",
                        ) && <WaitlistAction scheduleId={session.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW 2: WEEKLY TIMETABLE MATRIX */}
      {viewMode === "weekly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
            }}
          >
            {WEEKDAYS_MAP.map((d) => {
              const daySlots = course.slots.filter(
                (s) => s.weekday === d.weekday,
              );
              const hasClass = daySlots.length > 0;
              return (
                <div
                  key={d.weekday}
                  style={{
                    borderRadius: 12,
                    padding: "14px 12px",
                    background: hasClass
                      ? "linear-gradient(145deg, rgba(212, 255, 0, 0.08) 0%, rgba(19, 26, 38, 0.9) 100%)"
                      : "var(--member-surface-alt, #0e141e)",
                    border: hasClass
                      ? "1px solid var(--member-accent-border, #526222)"
                      : "1px dashed var(--member-border, #263143)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    minHeight: 120,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      paddingBottom: 6,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 13,
                        color: hasClass
                          ? "var(--member-accent, #d4ff00)"
                          : "var(--member-muted, #9baac0)",
                      }}
                    >
                      {d.label}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: hasClass
                          ? "rgba(212, 255, 0, 0.15)"
                          : "transparent",
                        color: hasClass
                          ? "var(--member-accent, #d4ff00)"
                          : "var(--member-muted, #667085)",
                      }}
                    >
                      {d.short}
                    </span>
                  </div>

                  {hasClass ? (
                    daySlots.map((slot) => (
                      <div
                        key={slot.startTime}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--member-text, #f1f4f9)",
                          }}
                        >
                          <Clock
                            size={13}
                            color="var(--member-accent, #d4ff00)"
                          />
                          {slot.startTime}–{slot.endTime}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            color: "var(--member-muted, #9baac0)",
                          }}
                        >
                          <MapPin size={11} />
                          {slot.roomName}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#64dfb4",
                            background: "rgba(100, 223, 180, 0.1)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            alignSelf: "flex-start",
                            border: "1px solid rgba(100, 223, 180, 0.2)",
                          }}
                        >
                          {slot.sessionCount} buổi tập
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--member-muted, #667085)",
                        fontStyle: "italic",
                        paddingTop: 10,
                        textAlign: "center",
                      }}
                    >
                      Nghỉ tập
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--member-surface-alt, #0e141e)",
              border: "1px solid var(--member-border, #263143)",
              fontSize: 12,
              color: "var(--member-muted, #9baac0)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>💡</span>
            <span>
              Lớp học diễn ra định kỳ{" "}
              <strong>{course.slots.length} buổi/tuần</strong>. Thời gian học cố
              định giúp bạn dễ dàng sắp xếp công việc và duy trì thói quen tập
              luyện đều đặn.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = {
  background: "var(--member-surface, #ffffff)",
  borderRadius: 20,
  border: "1px solid var(--member-border, #e7ece9)",
  padding: 28,
};

export function ClassDetailPage() {
  const [selectedCoach, setSelectedCoach] = useState<CoachInfo | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    data: cls,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["class", id],
    queryFn: () => (id ? classesApi.getClassById(id) : null),
    enabled: Boolean(id),
  });
  const {
    data: plan,
    isLoading: planLoading,
    error: planError,
  } = useQuery({
    queryKey: ["course-plan", id],
    queryFn: () => (id ? classesApi.getCoursePlan(id) : null),
    enabled: Boolean(id),
  });
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-me"],
    queryFn: () => authApi.getMe(),
  });
  const enrollments = useQuery({
    queryKey: ["my-enrollments", "feedback-eligibility"],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
  });

  const enrollCourseMutation = useMutation({
    mutationFn: (variables?: {
      healthNotes?: string;
      saveToProfile?: boolean;
    }) =>
      enrollmentsApi.enrollWholeCourse(id!, undefined, {
        healthNotes: variables?.healthNotes || null,
        saveToProfile: variables?.saveToProfile,
      }),
    onMutate: () => queryClient.cancelQueries({ queryKey: ["course-plan", id] }),
    onSuccess: async (result) => {
      const { summary } = result;
      setActionSuccess(
        summary.enrolledNow > 0
          ? `Bạn đã đăng ký ${summary.enrolledNow} buổi của khóa "${result.className}". Hiện đã có ${summary.totalRegistered}/${summary.totalSessions} buổi trong khóa của bạn.`
          : `Bạn đã đăng ký đủ ${summary.totalSessions} buổi của khóa này trước đó.`,
      );
      setActionError(null);
      setConfirmOpen(false);
      await queryClient.cancelQueries({
        queryKey: ["course-plan", result.classId],
      });
      queryClient.setQueryData<CoursePlan | null>(
        ["course-plan", result.classId],
        (current) => current ? applyWholeCourseEnrollment(current, result) : current,
      );
      await Promise.all(
        [
          ["class", result.classId],
          ["course-plan", result.classId],
          ["my-enrollments"],
          ["my-enrollment-quota"],
          ["member-schedule"],
          ["classes"],
        ].map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
    },
    onError: (err: unknown) => {
      setActionError(err);
      setConfirmOpen(false);
    },
  });

  if (isLoading) return <LoadingSpinner text="Đang tải thông tin lớp học..." />;
  if (error || !cls)
    return (
      <EmptyState
        title="Không tìm thấy thông tin lớp học"
        description={
          (error as Error)?.message ||
          "Lớp học không tồn tại hoặc đã ngừng hoạt động."
        }
        action={
          <button
            className="button primary"
            onClick={() => navigate("/member/classes")}
          >
            Quay lại danh sách lớp
          </button>
        }
      />
    );

  const coaches = cls.coaches || [];
  const course = plan?.course;
  const registration = plan?.registration;
  const fullyRegistered = isWholeCourseRegistered(plan);
  const mutationBlockers = courseBlockers(actionError);

  const courseTerm =
    (plan?.course as any)?.term ||
    plan?.sessions?.find((s: any) => s.term)?.term;

  const now = Date.now();
  const isTermPlanning = courseTerm?.status === "PLANNING";
  const isTermNotStarted = Boolean(
    courseTerm?.registrationStartDate &&
    new Date(courseTerm.registrationStartDate).getTime() > now,
  );
  const isTermClosed = Boolean(
    courseTerm?.status === "CLOSED" ||
    (courseTerm?.registrationEndDate &&
      new Date(courseTerm.registrationEndDate).getTime() < now),
  );
  const isTermBlocked = Boolean(
    courseTerm && (isTermPlanning || isTermNotStarted || isTermClosed),
  );

  const daysRemaining =
    courseTerm?.registrationEndDate && !isTermClosed
      ? Math.max(
          0,
          Math.ceil(
            (new Date(courseTerm.registrationEndDate).getTime() - now) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  const blockerActions = (blockers: CourseRegistrationBlocker[]) => {
    const codes = blockers.map((blocker) => blocker.code);
    const freeNeedsPlan = blockers.some((blocker) =>
      isFreeQuotaBlocker(blocker, registration?.quota?.tier),
    );
    const needsMembership =
      freeNeedsPlan ||
      codes.some((code) =>
        [
          "SUBSCRIPTION_ENDS_BEFORE_COURSE_END",
          "NO_ACTIVE_SUBSCRIPTION",
          "PREMIUM_REQUIRED",
        ].includes(code),
      );
    const membershipLabel = freeNeedsPlan
      ? "Xem các gói tập"
      : codes.includes("NO_ACTIVE_SUBSCRIPTION")
        ? "Mua gói"
        : codes.includes("PREMIUM_REQUIRED")
          ? "Nâng cấp gói"
          : "Gia hạn ngay";
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {needsMembership && (
          <button
            className="button primary"
            onClick={() => navigate("/member/membership")}
          >
            {membershipLabel}
          </button>
        )}
        {codes.includes("CONCURRENT_CLASS_LIMIT_REACHED") && !freeNeedsPlan && (
          <button
            className="button"
            onClick={() => navigate("/member/my-classes")}
          >
            Xem các lớp đang giữ
          </button>
        )}
        {codes.includes("ATTENDANCE_PENALTY_ACTIVE") && (
          <span style={{ alignSelf: "center", fontSize: 13 }}>
            Vui lòng liên hệ quản lý trung tâm để được hỗ trợ.
          </span>
        )}
      </div>
    );
  };
  const blockerList = (blockers: CourseRegistrationBlocker[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ul style={{ margin: 0, paddingLeft: 22 }}>
        {blockers.map((blocker, index) => (
          <li key={`${blocker.code}-${blocker.sessionId || index}`}>
            {blockerText(blocker, registration?.quota?.tier)}
          </li>
        ))}
      </ul>
      {blockerActions(blockers)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <button
        className="member-button"
        onClick={() => navigate("/member/classes")}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          color: "var(--member-muted, #54655d)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          padding: 0,
        }}
      >
        <ArrowLeft size={16} /> Quay lại danh sách lớp
      </button>

      {actionSuccess && (
        <AlertBanner
          type="success"
          title="Đăng ký thành công"
          message={actionSuccess}
        />
      )}
      {actionError !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AlertBanner
            type="error"
            title="Không thể đăng ký trọn khóa"
            message={
              actionError instanceof Error
                ? actionError.message
                : "Đăng ký khóa học thất bại. Vui lòng thử lại."
            }
          />
          {mutationBlockers.length > 0 && blockerList(mutationBlockers)}
        </div>
      )}

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--member-text, #203d31)",
                backgroundColor: "var(--member-accent-soft, #f2f8eb)",
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--member-accent-border, #d4ebbf)",
              }}
            >
              {sportNames(cls)}
            </span>
            <StatusBadge status={cls.classType} />
          </div>
          <span style={{ fontSize: 13, color: "var(--member-muted, #58695f)" }}>
            Tối đa: <strong>{cls.capacity} học viên/ca</strong>
          </span>
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "var(--member-text, #203d31)",
            margin: "0 0 10px",
          }}
        >
          {cls.name}
        </h1>
        <p
          style={{
            color: "var(--member-muted, #475467)",
            fontSize: 14,
            lineHeight: 1.6,
            margin: "0 0 24px",
            maxWidth: 780,
          }}
        >
          {cls.description ||
            "Lớp học được thiết kế chuyên sâu giúp học viên nâng cao kỹ thuật, phát triển thể lực và giữ vững phong độ."}
        </p>
        <div
          style={{
            paddingTop: 18,
            borderTop: "1px solid var(--member-surface-alt, #f2f5f3)",
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--member-text, #203d31)",
              marginBottom: 12,
            }}
          >
            Đội ngũ Huấn luyện viên
          </h3>
          {coaches.length === 0 ? (
            <span
              style={{ fontSize: 13, color: "var(--member-muted, #58695f)" }}
            >
              Chưa chỉ định huấn luyện viên
            </span>
          ) : (
            <div className="member-coach-grid">
              {coaches.map(
                (assigned) =>
                  assigned.coach?.id &&
                  assigned.coach.user && (
                    <CoachCard
                      key={assigned.id}
                      assigned={assigned}
                      onClick={() => setSelectedCoach(assigned)}
                    />
                  ),
              )}
            </div>
          )}
        </div>
      </section>

      {selectedCoach && (
        <CoachProfileDialog
          key={selectedCoach.coach.id}
          assigned={selectedCoach}
          classId={cls.id}
          onClose={() => setSelectedCoach(null)}
          canReview={Boolean(
            enrollments.data?.enrollments.some(
              (enrollment) =>
                ["BOOKED", "COMPLETED"].includes(enrollment.status) &&
                (enrollment.classId === cls.id ||
                  enrollment.schedule?.class?.id === cls.id ||
                  enrollment.schedule?.class?.coaches?.some(
                    (coach) => coach.coach?.id === selectedCoach.coach.id,
                  )),
            ),
          )}
        />
      )}

      <section style={cardStyle}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "var(--member-text, #203d31)",
            margin: "0 0 4px",
          }}
        >
          Khóa học
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            color: "var(--member-muted, #58695f)",
            fontSize: 13,
          }}
        >
          Toàn bộ lịch trình của lớp — đăng ký một lần cho cả khóa
        </p>
        {planError && course && (
          <ErrorState
            error={planError}
            retry={() => queryClient.invalidateQueries({ queryKey: ["course-plan", id] })}
          />
        )}
        {planError && !course ? (
          <ErrorState error={planError} />
        ) : planLoading ? (
          <LoadingSpinner text="Đang tải lịch trình khóa học..." />
        ) : !course ? (
          <EmptyState
            icon={<Calendar size={36} />}
            title="Chưa có ca học sắp tới"
            description="Hiện chưa có ca học nào được lên lịch cho lớp này. Vui lòng quay lại sau."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                color: "var(--member-muted, #475467)",
                fontSize: 13,
              }}
            >
              <strong>{course.totalSessions} buổi</strong>
              <span>·</span>
              <span>
                {formatMemberDate(course.firstSessionStart)} →{" "}
                {formatMemberDate(course.lastSessionStart)}
              </span>
              <span>·</span>
              <span>Tối đa {course.capacity} học viên/buổi</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {course.slots.map((slot) => (
                <div
                  key={`${slot.weekday}-${slot.startTime}-${slot.roomId}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    padding: "14px 16px",
                    border: "1px solid var(--member-accent-border, #d4ebbf)",
                    background: "var(--member-accent-soft, #f8fcef)",
                    borderRadius: 12,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        color: "var(--member-text, #203d31)",
                        fontSize: 14,
                      }}
                    >
                      {slot.weekdayLabel} · {slot.startTime}–{slot.endTime} ·{" "}
                      {slot.roomName}
                    </strong>
                    <div
                      style={{
                        color: "var(--member-muted, #667085)",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {formatMemberDate(slot.firstSessionStart)} →{" "}
                      {formatMemberDate(slot.lastSessionStart)}
                    </div>
                  </div>
                  <span
                    style={{
                      background: "var(--member-surface, #ffffff)",
                      border: "1px solid var(--member-accent-border, #d4ebbf)",
                      borderRadius: 999,
                      padding: "5px 10px",
                      color: "var(--member-accent, #376228)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {slot.sessionCount} buổi
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color:
                    course.availability.minRemainingSlots === 0
                      ? "var(--member-danger, #d92d20)"
                      : "var(--member-success, #267346)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <Users size={16} /> Còn {course.availability.minRemainingSlots}/
                {course.capacity} chỗ/buổi
              </span>
              {course.availability.fullSessionCount > 0 && (
                <span
                  style={{
                    color: "var(--member-danger, #d92d20)",
                    fontSize: 13,
                  }}
                >
                  Có {course.availability.fullSessionCount} buổi đã hết chỗ
                </span>
              )}
            </div>
            {registration?.membershipCoverage?.policy === "HALF_REMAINING_TERM_V1" && (
              <AlertBanner
                type="info"
                title="Đủ điều kiện thời hạn cho trọn kỳ"
                message={`Gói còn ít nhất 50% thời hạn tại thời điểm xét đăng ký. Quyền học áp dụng cho lớp trong kỳ này đến ${formatMemberDate(registration.membershipCoverage.validUntil)}, kể cả khi gói hết hạn ngày ${formatMemberDate(registration.membershipCoverage.subscriptionEndDate)}. Ngày hết hạn gói không thay đổi.`}
              />
            )}
            {registration && !registration.eligible && !fullyRegistered && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <AlertBanner
                  type="warning"
                  title="Chưa thể đăng ký trọn khóa"
                  message="Vui lòng xử lý các điều kiện dưới đây trước khi đăng ký."
                />
                {blockerList(registration.blockers)}
              </div>
            )}
            {courseTerm && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {isTermPlanning && (
                  <AlertBanner
                    type="warning"
                    title="Chưa mở cổng đăng ký"
                    message={`Khóa học thuộc kỳ "${courseTerm.name}" đang lập kế hoạch, chưa mở đăng ký.`}
                  />
                )}
                {isTermNotStarted && (
                  <AlertBanner
                    type="info"
                    title="Chưa tới ngày mở đăng ký"
                    message={`Kỳ học "${courseTerm.name}" sẽ mở cổng đăng ký từ ngày ${new Date(courseTerm.registrationStartDate).toLocaleDateString("vi-VN")}.`}
                  />
                )}
                {isTermClosed && (
                  <AlertBanner
                    type="error"
                    title="Hết hạn đăng ký"
                    message={`Đã hết thời hạn đăng ký cho kỳ học "${courseTerm.name}".`}
                  />
                )}
                {!isTermBlocked && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      backgroundColor: "var(--member-surface-alt, #f0fdf4)",
                      border: "1px solid var(--member-border, #bbf7d0)",
                      fontSize: 13,
                      color: "#166534",
                      fontWeight: 600,
                    }}
                  >
                    <span>📅 Kỳ học: {courseTerm.name}</span>
                    {daysRemaining !== null && (
                      <span>• Cổng đăng ký còn {daysRemaining} ngày</span>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              className="button primary"
              disabled={
                fullyRegistered ||
                enrollCourseMutation.isPending ||
                !registration ||
                !registration.eligible ||
                isTermBlocked ||
                course.availability.minRemainingSlots === 0
              }
              onClick={() => {
                if (fullyRegistered || enrollCourseMutation.isPending) return;
                setActionError(null);
                setActionSuccess(null);
                setConfirmOpen(true);
              }}
              style={{ alignSelf: "flex-start" }}
            >
              {fullyRegistered
                ? "Đã đăng ký trọn khóa"
                : enrollCourseMutation.isPending
                  ? "Đang đăng ký…"
                  : isTermPlanning
                    ? "Kỳ đang lập kế hoạch"
                    : isTermNotStarted
                      ? "Chưa mở đăng ký"
                      : isTermClosed
                        ? "Đã hết hạn đăng ký"
                        : !registration ||
                            !registration.eligible ||
                            course.availability.minRemainingSlots === 0
                          ? "Chưa thể đăng ký"
                          : "Đăng ký trọn khóa"}
            </button>
            {/* BẢNG LỊCH TRÌNH KHÓA HỌC DẠNG BẢNG & MA TRẬN TUẦN TRỰC QUAN */}
            <CourseScheduleTableView course={course} sessions={plan.sessions} />
          </div>
        )}
      </section>

      <EnrollConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={({ healthNotes, saveToProfile }) => {
          if (fullyRegistered || enrollCourseMutation.isPending) return;
          enrollCourseMutation.mutate({ healthNotes, saveToProfile });
        }}
        title="Xác nhận đăng ký & Lưu ý thể trạng"
        classSummary={{
          name: cls.name,
          sport: sportNames(cls),
          sessions: course?.totalSessions,
          coach: coaches[0]?.coach?.user?.fullName,
          room: course?.slots[0]?.roomName,
          time: course?.slots
            ?.map((s) => `${s.weekdayLabel} ${s.startTime}–${s.endTime}`)
            .join("; "),
        }}
        initialHealthNotes={currentUser?.memberProfile?.healthNotes}
        loading={enrollCourseMutation.isPending}
        confirmText="Xác nhận đăng ký trọn khóa"
      />
    </div>
  );
}
