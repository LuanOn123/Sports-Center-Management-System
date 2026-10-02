import { CoachFeedback } from "../../shared/CoachFeedback";
import { sportNames } from "../../shared/sports";
import { ErrorState } from "../../shared/feedback";
import { formatMemberDate } from "../../shared/memberFormat";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classesApi } from "../../api/classes.api";
import { enrollmentsApi } from "../../api/enrollments.api";
import type { ClassSchedule } from "../../types/member";
import { ArrowLeft, Calendar, Clock, MapPin, Users } from "lucide-react";
import {
  LoadingSpinner,
  EmptyState,
  StatusBadge,
  ConfirmModal,
  AlertBanner,
} from "../../components/common";

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedSchedule, setSelectedSchedule] =
    useState<ClassSchedule | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch Class Detail
  const {
    data: cls,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["class", id],
    queryFn: () => (id ? classesApi.getClassById(id) : null),
    enabled: Boolean(id),
  });

  // Fetch Class Schedules
  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useQuery({
    queryKey: ["class-schedules", id],
    queryFn: () =>
      id ? classesApi.getSchedules({ classId: id, status: "SCHEDULED" }) : null,
    enabled: Boolean(id),
  });

  const enrollments = useQuery({
    queryKey: ["my-enrollments", "feedback-eligibility"],
    queryFn: () => enrollmentsApi.getMyEnrollments(),
  });

  // Booking Mutation
  const bookMutation = useMutation({
    mutationFn: (scheduleId: string) => enrollmentsApi.bookClass(scheduleId),
    onSuccess: () => {
      setActionSuccess(
        "Đặt lớp học thành công! Chúc bạn có buổi tập hiệu quả.",
      );
      setActionError(null);
      setConfirmOpen(false);
      setSelectedSchedule(null);

      // Invalidate queries to refresh state
      queryClient.invalidateQueries({ queryKey: ["class", id] });
      queryClient.invalidateQueries({ queryKey: ["class-schedules", id] });
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["member-schedule"] });
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError(
          "Đặt lịch thất bại. Vui lòng kiểm tra lại điều kiện đặt chỗ.",
        );
      }
      setConfirmOpen(false);
    },
  });

  if (isLoading) return <LoadingSpinner text="Đang tải thông tin lớp học..." />;

  if (error || !cls) {
    return (
      <EmptyState
        title="Không tìm thấy thông tin lớp học"
        description={
          (error as Error)?.message ||
          "Lớp học không tồn tại hoặc đã ngừng hoạt động."
        }
        action={
          <button
            onClick={() => navigate("/member/classes")}
            style={{
              padding: "10px 18px",
              backgroundColor: "var(--color-primary)",
              color: "var(--color-surface)",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
            }}
          >
            Quay lại danh sách lớp
          </button>
        }
      />
    );
  }

  const coaches = cls.coaches || [];
  const schedules = scheduleData?.schedules || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {actionError && /gói|hết hạn|Premium/i.test(actionError) && (
        <button
          className="button primary"
          onClick={() => navigate("/member/membership")}
        >
          Gia hạn ngay
        </button>
      )}
      {/* BACK BUTTON */}
      <div>
        <button
          onClick={() => navigate("/member/classes")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            color: "#54655d",
            fontSize: "var(--font-small)",
            fontWeight: 600,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ArrowLeft size={16} /> Quay lại danh sách lớp
        </button>
      </div>

      {actionSuccess && (
        <AlertBanner
          type="success"
          title="Thành công"
          message={actionSuccess}
        />
      )}

      {actionError && (
        <AlertBanner
          type="error"
          title="Không thể đặt lịch"
          message={actionError}
        />
      )}

      {/* CLASS OVERVIEW CARD */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid #e7ece9",
          padding: 28,
        }}
      >
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
                fontSize: "var(--font-small)",
                fontWeight: 700,
                color: "var(--color-primary)",
                backgroundColor: "#f2f8eb",
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #d4ebbf",
              }}
            >
              {sportNames(cls)}
            </span>
            <StatusBadge status={cls.classType} />
          </div>
          <span
            style={{
              fontSize: "var(--font-small)",
              color: "var(--color-text-muted)",
            }}
          >
            Tối đa: <strong>{cls.capacity} học viên/ca</strong>
          </span>
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--color-primary)",
            margin: "0 0 10px",
          }}
        >
          {cls.name}
        </h1>

        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--font-small)",
            lineHeight: 1.6,
            margin: "0 0 24px",
            maxWidth: 780,
          }}
        >
          {cls.description ||
            "Lớp học được thiết kế chuyên sâu giúp học viên nâng cao kỹ thuật, phát triển thể lực và giữ vững phong độ."}
        </p>

        {/* COACHES ROW */}
        <div style={{ paddingTop: 18, borderTop: "1px solid #f2f5f3" }}>
          <h3
            style={{
              fontSize: "var(--font-small)",
              fontWeight: 700,
              color: "var(--color-primary)",
              marginBottom: 12,
            }}
          >
            Đội ngũ Huấn luyện viên
          </h3>
          {coaches.length === 0 ? (
            <span
              style={{
                fontSize: "var(--font-small)",
                color: "var(--color-text-muted)",
              }}
            >
              Chưa chỉ định huấn luyện viên
            </span>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {coaches.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: "#f9fbfa",
                    border: "1px solid #e7ece9",
                    padding: "10px 16px",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "var(--font-small)",
                    }}
                  >
                    {c.coach?.user?.fullName?.charAt(0) || "C"}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "var(--font-small)",
                        color: "var(--color-primary)",
                      }}
                    >
                      {c.coach?.user?.fullName}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--font-caption)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {c.coach?.specialization ||
                        "Huấn luyện viên chuyên nghiệp"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {coaches.map(
        (c) =>
          c.coach?.id && (
            <details className="detail-disclosure" key={c.coach.id}>
              <summary>Đánh giá · {c.coach.user?.fullName}</summary>
              <div className="workflow-card">
                <CoachFeedback
                  coachId={c.coach.id}
                  classId={cls.id}
                  role="MEMBER"
                  canReview={Boolean(
                    enrollments.data?.enrollments.some(
                      (e) =>
                        ["BOOKED", "COMPLETED"].includes(e.status) &&
                        (e.classId === cls.id ||
                          e.schedule?.class?.id === cls.id ||
                          e.schedule?.class?.coaches?.some(
                            (assigned) => assigned.coach?.id === c.coach.id,
                          )),
                    ),
                  )}
                />
              </div>
            </details>
          ),
      )}
      {/* SCHEDULES & BOOKING SECTION */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid #e7ece9",
          padding: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--color-primary)",
                margin: "0 0 4px",
              }}
            >
              Lịch học sắp diễn ra
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted)",
                fontSize: "var(--font-small)",
              }}
            >
              Chọn ca học phù hợp với thời gian của bạn và bấm Đặt chỗ
            </p>
          </div>
        </div>

        {scheduleError ? (
          <ErrorState error={scheduleError} />
        ) : scheduleLoading ? (
          <LoadingSpinner text="Đang tải các ca học..." />
        ) : schedules.length === 0 ? (
          <EmptyState
            icon={<Calendar size={36} />}
            title="Chưa có ca học sắp tới"
            description="Hiện chưa có ca học nào được lên lịch cho lớp này. Vui lòng quay lại sau."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {schedules.map((sch) => {
              const startTime = new Date(sch.startTime);
              const endTime = new Date(sch.endTime);
              const isPast = startTime <= new Date();

              const bookedEnrollments = sch._count?.enrollments ?? 0;
              const remaining = Math.max(0, cls.capacity - bookedEnrollments);
              const isFull = remaining === 0;

              return (
                <div
                  key={sch.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                    padding: "16px 20px",
                    borderRadius: "var(--radius-card)",
                    backgroundColor: isPast ? "#f9fafb" : "#fcfdfc",
                    border: "1px solid #e7ece9",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 24,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Date Badge */}
                    <div
                      style={{
                        textAlign: "center",
                        minWidth: 70,
                        backgroundColor: "#f2f8eb",
                        border: "1px solid #d4ebbf",
                        borderRadius: 10,
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "var(--font-caption)",
                          fontWeight: 700,
                          color: "#376228",
                          textTransform: "uppercase",
                        }}
                      >
                        {startTime.toLocaleDateString("vi-VN", {
                          weekday: "short",
                        })}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "var(--color-primary)",
                        }}
                      >
                        {startTime.getDate()}/{startTime.getMonth() + 1}
                      </div>
                    </div>

                    {/* Time & Room Details */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: "var(--font-small)",
                          fontWeight: 700,
                          color: "var(--color-primary)",
                        }}
                      >
                        <Clock size={16} color="var(--color-text-muted)" />
                        <span>
                          {formatMemberDate(startTime, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {formatMemberDate(endTime, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          marginTop: 4,
                          fontSize: "var(--font-small)",
                          color: "#54655d",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <MapPin size={14} color="var(--color-text-muted)" />
                          Phòng: <strong>{sch.room?.name || "Sân tập"}</strong>
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Users size={14} color="var(--color-text-muted)" />
                          Còn trống:{" "}
                          <strong
                            style={{ color: isFull ? "#d92d20" : "#267346" }}
                          >
                            {isFull
                              ? "Hết chỗ"
                              : `${remaining}/${cls.capacity}`}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTON */}
                  <div>
                    <button
                      disabled={
                        isPast ||
                        isFull ||
                        bookMutation.isPending ||
                        !cls.isActive ||
                        sch.status !== "SCHEDULED"
                      }
                      onClick={() => {
                        setSelectedSchedule(sch);
                        setConfirmOpen(true);
                        setActionError(null);
                        setActionSuccess(null);
                      }}
                      style={{
                        padding: "10px 22px",
                        backgroundColor:
                          isPast || isFull ? "#e4e7e6" : "var(--color-primary)",
                        color:
                          isPast || isFull ? "#8c9b94" : "var(--color-surface)",
                        border: "none",
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: "var(--font-small)",
                        cursor: isPast || isFull ? "not-allowed" : "pointer",
                        transition: "background 0.15s",
                      }}
                    >
                      {isPast ? "Đã qua" : isFull ? "Đã đầy chỗ" : "Đặt ca học"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (selectedSchedule) {
            bookMutation.mutate(selectedSchedule.id);
          }
        }}
        title="Xác nhận Đặt lịch Ca học"
        message={`Bạn có chắc chắn muốn đặt ca học "${cls.name}" vào ngày ${
          selectedSchedule
            ? formatMemberDate(selectedSchedule.startTime) +
              " (" +
              formatMemberDate(selectedSchedule.startTime, {
                hour: "2-digit",
                minute: "2-digit",
              }) +
              " - " +
              formatMemberDate(selectedSchedule.endTime, {
                hour: "2-digit",
                minute: "2-digit",
              }) +
              ")"
            : ""
        }?`}
        confirmText="Xác nhận đặt chỗ"
        cancelText="Để sau"
        loading={bookMutation.isPending}
      />
    </div>
  );
}
