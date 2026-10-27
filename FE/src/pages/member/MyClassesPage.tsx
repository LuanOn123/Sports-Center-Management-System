import "../../shared/member-status.css";
import { sportNames } from "../../shared/sports";
import { formatMemberDate } from "../../shared/memberFormat";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { enrollmentsApi } from "../../api/enrollments.api";
import type { EnrollmentStatus } from "../../types/member";
import {
  CalendarCheck,
  CalendarX,
  Clock,
  MapPin,
  Volleyball,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  LoadingSpinner,
  EmptyState,
  StatusBadge,
} from "../../components/common";

export function MyClassesPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<EnrollmentStatus>("BOOKED");

  // Fetch enrollments by status
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-enrollments", activeTab],
    queryFn: () => enrollmentsApi.getMyEnrollments({ status: activeTab }),
  });

  const quota = useQuery({
    queryKey: ["my-enrollment-quota"],
    queryFn: () => enrollmentsApi.getMyQuota(),
  });

  const enrollments = data?.enrollments || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div
        style={{
          background: "var(--member-surface, #ffffff)",
          borderRadius: 16,
          padding: "24px 28px",
          border: "1px solid var(--member-border, #e7ece9)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--member-text, #203d31)",
              margin: "0 0 6px",
            }}
          >
            Lớp học của tôi
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--member-muted, #58695f)",
              fontSize: 13,
            }}
          >
            Theo dõi danh sách các buổi học bạn đã đăng ký, buổi đã tham gia và
            lịch sử hủy lớp
          </p>
        </div>

        <button
          className="member-button member-button-primary"
          onClick={() => navigate("/member/classes")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            backgroundColor: "var(--member-surface-alt, #203d31)",
            color: "var(--member-text, #ffffff)",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Volleyball size={16} /> Đặt thêm lớp mới
        </button>
      </div>

      {quota.isSuccess && (
        <section
          className="member-class-access"
          aria-label="Quyền đăng ký lớp học"
        >
          {!quota.data.hasActiveSubscription || quota.data.limit === 0 ? (
            <>
              <div>
                <h2>Mở quyền đăng ký lớp học</h2>
                <p>
                  {quota.data.tier === "FREE"
                    ? "Tài khoản Free chưa bao gồm lớp học. Chọn gói Membership hoặc Premium để bắt đầu đăng ký."
                    : "Bạn cần một gói tập còn hiệu lực để đăng ký lớp học."}
                </p>
              </div>
              <Link className="button primary" to="/member/membership">
                Xem các gói tập
              </Link>
            </>
          ) : (
            <>
              <div className="member-class-access-copy">
                <h2>Quyền đăng ký lớp học</h2>
                <p>
                  {quota.data.remaining > 0
                    ? "Bạn có thể đăng ký thêm " +
                      quota.data.remaining +
                      " lớp khác nhau."
                    : "Bạn đã đăng ký đủ số lớp của gói hiện tại. Hãy hoàn thành hoặc hủy lớp chưa bắt đầu trước khi đăng ký lớp mới."}
                </p>
                <small>
                  Mỗi lớp có nhiều buổi vẫn chỉ tính là một lớp. Giới hạn áp
                  dụng chung tại mọi cơ sở.
                </small>
              </div>
              <div className="member-class-count">
                <strong>
                  {quota.data.used}
                  <span> / {quota.data.limit}</span>
                </strong>
                <span>Lớp đang đăng ký</span>
              </div>
            </>
          )}
        </section>
      )}

      {/* TABS */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid var(--member-border, #e7ece9)",
          paddingBottom: 2,
        }}
      >
        {[
          {
            key: "BOOKED" as EnrollmentStatus,
            label: "Sắp tới (Đã đặt)",
            icon: CalendarCheck,
          },
          {
            key: "COMPLETED" as EnrollmentStatus,
            label: "Đã hoàn thành",
            icon: CheckCircle2,
          },
          {
            key: "CANCELLED" as EnrollmentStatus,
            label: "Đã hủy",
            icon: CalendarX,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              className="member-button"
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                border: "none",
                background: "none",
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive
                  ? "var(--member-text, #203d31)"
                  : "var(--member-muted, #58695f)",
                borderBottom: isActive
                  ? "3px solid var(--member-text, #203d31)"
                  : "3px solid transparent",
                cursor: "pointer",
                borderRadius: "4px 4px 0 0",
              }}
            >
              <Icon
                size={16}
                color={
                  isActive
                    ? "var(--member-text, #203d31)"
                    : "var(--member-muted, #58695f)"
                }
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ENROLLMENTS LIST */}
      {isLoading ? (
        <LoadingSpinner text="Đang tải danh sách lớp của bạn..." />
      ) : error ? (
        <EmptyState
          title="Lỗi tải dữ liệu"
          description={(error as Error).message}
        />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={40} />}
          title={
            activeTab === "BOOKED"
              ? "Bạn chưa có lớp học nào sắp tới"
              : activeTab === "COMPLETED"
                ? "Chưa có buổi học nào đã hoàn thành"
                : "Không có lịch sử hủy lớp"
          }
          description={
            activeTab === "BOOKED"
              ? "Hãy bấm vào Tìm kiếm lớp học để đăng ký buổi tập rèn luyện sức khỏe."
              : undefined
          }
          action={
            activeTab === "BOOKED" ? (
              <button
                className="member-button member-button-primary"
                onClick={() => navigate("/member/classes")}
                style={{
                  padding: "9px 18px",
                  backgroundColor: "var(--member-surface-alt, #203d31)",
                  color: "var(--member-text, #ffffff)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Khám phá các lớp học
              </button>
            ) : undefined
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {enrollments.map((item) => {
            const sch = item.schedule;
            const startTime = sch ? new Date(sch.startTime) : null;
            const endTime = sch ? new Date(sch.endTime) : null;

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: "var(--member-surface, #ffffff)",
                  borderRadius: 16,
                  border: "1px solid var(--member-border, #e7ece9)",
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  {/* Date badge */}
                  {startTime && (
                    <div
                      style={{
                        textAlign: "center",
                        minWidth: 68,
                        backgroundColor: "var(--member-accent-soft, #f2f8eb)",
                        border:
                          "1px solid var(--member-accent-border, #d4ebbf)",
                        borderRadius: 12,
                        padding: "10px 8px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--member-accent, #376228)",
                          textTransform: "uppercase",
                        }}
                      >
                        {startTime.toLocaleDateString("vi-VN", {
                          weekday: "short",
                        })}
                      </div>
                      <div
                        style={{
                          fontSize: 19,
                          fontWeight: 800,
                          color: "var(--member-text, #203d31)",
                        }}
                      >
                        {startTime.getDate()}/{startTime.getMonth() + 1}
                      </div>
                    </div>
                  )}

                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: "var(--member-text, #203d31)",
                        }}
                      >
                        {sch?.class?.name || "Lớp học thể thao"}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        fontSize: 13,
                        color: "var(--member-muted, #54655d)",
                        flexWrap: "wrap",
                      }}
                    >
                      {startTime && endTime && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Clock
                            size={15}
                            color="var(--member-muted, #58695f)"
                          />
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
                      )}
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <MapPin
                          size={15}
                          color="var(--member-muted, #58695f)"
                        />
                        Phòng: <strong>{sch?.room?.name || "Sân tập"}</strong>
                      </span>
                      <span>
                        Môn: <strong>{sportNames(sch?.class)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="member-button"
                    onClick={() => navigate(`/member/classes/${item.classId}`)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid var(--member-border, #d0d7d3)",
                      backgroundColor: "var(--member-surface, #ffffff)",
                      color: "var(--member-text, #203d31)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Xem lớp
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SCHEDULE SUPPORT INFO */}
      {activeTab === "BOOKED" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 10,
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            fontSize: 12,
            color: "#92400e",
          }}
        >
          <AlertTriangle size={14} />
          <span>
            Nếu cần hỗ trợ về lịch học, vui lòng liên hệ lễ tân cơ sở.
          </span>
        </div>
      )}

    </div>
  );
}
