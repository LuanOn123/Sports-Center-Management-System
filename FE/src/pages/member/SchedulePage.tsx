import { formatMemberDate } from "../../shared/memberFormat";
import {
  MEMBER_TIME_ZONE,
  memberDateKey,
  memberWeekStart,
} from "../../shared/memberCalendar";
import { ErrorState } from "../../shared/feedback";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { enrollmentsApi } from "../../api/enrollments.api";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  List,
  Calendar as CalendarIcon,
} from "lucide-react";
import { LoadingSpinner, EmptyState } from "../../components/common";

export function SchedulePage() {
  const navigate = useNavigate();

  // State for week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    return memberWeekStart();
  });

  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Fetch all booked enrollments
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-enrollments", "BOOKED", 50],
    queryFn: () =>
      enrollmentsApi.getMyEnrollments({ status: "BOOKED", limit: 50 }),
  });

  const enrollments = data?.enrollments || [];

  // Generate 7 days of the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(currentWeekStart);
    day.setUTCDate(day.getUTCDate() + i);
    return day;
  });

  const nextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() + 7);
    setCurrentWeekStart(d);
  };

  const prevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    setCurrentWeekStart(d);
  };

  const resetToThisWeek = () => {
    setCurrentWeekStart(memberWeekStart());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER & CONTROLS */}
      <div
        style={{
          background: "var(--member-surface, #ffffff)",
          borderRadius: 16,
          padding: "20px 24px",
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
              margin: "0 0 4px",
            }}
          >
            Lịch tập cá nhân
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--member-muted, #58695f)",
              fontSize: 13,
            }}
          >
            Thời khóa biểu các ca học đã đặt của bạn theo tuần
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {/* Week navigator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "var(--member-surface-alt, #f2f5f3)",
              borderRadius: 10,
              padding: 3,
            }}
          >
            <button
              className="member-button"
              onClick={prevWeek}
              style={{
                background: "none",
                border: "none",
                padding: "6px 8px",
                cursor: "pointer",
                display: "flex",
                color: "var(--member-text, #203d31)",
              }}
              title="Tuần trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="member-button"
              onClick={resetToThisWeek}
              style={{
                background: "none",
                border: "none",
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--member-text, #203d31)",
                cursor: "pointer",
              }}
            >
              Hôm nay
            </button>
            <button
              className="member-button"
              onClick={nextWeek}
              style={{
                background: "none",
                border: "none",
                padding: "6px 8px",
                cursor: "pointer",
                display: "flex",
                color: "var(--member-text, #203d31)",
              }}
              title="Tuần sau"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--member-text, #203d31)",
            }}
          >
            {weekDays[0].toLocaleDateString("vi-VN", {
              timeZone: MEMBER_TIME_ZONE,
              day: "numeric",
              month: "numeric",
            })}{" "}
            -{" "}
            {weekDays[6].toLocaleDateString("vi-VN", {
              timeZone: MEMBER_TIME_ZONE,
              day: "numeric",
              month: "numeric",
              year: "numeric",
            })}
          </span>

          {/* Toggle View */}
          <div
            style={{
              display: "flex",
              backgroundColor: "var(--member-surface-alt, #f2f5f3)",
              borderRadius: 8,
              padding: 2,
            }}
          >
            <button
              className="member-button"
              onClick={() => setViewMode("calendar")}
              style={{
                border: "none",
                background:
                  viewMode === "calendar"
                    ? "var(--member-surface, #ffffff)"
                    : "transparent",
                color:
                  viewMode === "calendar"
                    ? "var(--member-text, #203d31)"
                    : "var(--member-muted, #58695f)",
                fontWeight: 600,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CalendarIcon size={14} /> Lịch tuần
            </button>
            <button
              className="member-button"
              onClick={() => setViewMode("list")}
              style={{
                border: "none",
                background:
                  viewMode === "list"
                    ? "var(--member-surface, #ffffff)"
                    : "transparent",
                color:
                  viewMode === "list"
                    ? "var(--member-text, #203d31)"
                    : "var(--member-muted, #58695f)",
                fontWeight: 600,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <List size={14} /> Danh sách
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Đang tải thời khóa biểu..." />
      ) : error ? (
        <ErrorState error={error} />
      ) : viewMode === "calendar" ? (
        /* WEEKLY CALENDAR VIEW */
        <div
          className="member-week-grid"
<<<<<<< HEAD
=======
          tabIndex={0}
          role="region"
          aria-label="Lịch tập trong tuần"
>>>>>>> develop
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {weekDays.map((date) => {
            const isToday = memberDateKey(date) === memberDateKey(new Date());

            const dateStr = memberDateKey(date);
            const dayClasses = enrollments.filter((item) => {
              if (!item.schedule?.startTime) return false;
              return memberDateKey(item.schedule.startTime) === dateStr;
            });

            return (
              <div
                className={`member-day ${isToday ? "is-today" : ""}`}
                key={dateStr}
                style={{
                  backgroundColor: "var(--member-surface, #ffffff)",
                  borderRadius: 14,
                  border: isToday
                    ? "2px solid var(--member-accent, #376228)"
                    : "1px solid var(--member-border, #e7ece9)",
                  minHeight: 320,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {/* Day Header */}
                <div
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    backgroundColor: isToday
                      ? "var(--member-accent-soft, #f2f8eb)"
                      : "var(--member-surface-alt, #f8faf9)",
                    borderBottom: "1px solid var(--member-border, #edf2ee)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isToday
                        ? "var(--member-accent, #376228)"
                        : "var(--member-muted, #58695f)",
                      textTransform: "uppercase",
                    }}
                  >
                    {date.toLocaleDateString("vi-VN", {
                      timeZone: MEMBER_TIME_ZONE,
                      weekday: "short",
                    })}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: isToday
                        ? "var(--member-text, #203d31)"
                        : "var(--member-muted, #475467)",
                    }}
                  >
                    {date.getUTCDate()}/{date.getUTCMonth() + 1}
                  </div>
                </div>

                {/* Day Content */}
                <div
                  style={{
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    flex: 1,
                  }}
                >
                  {dayClasses.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: 1,
                        color: "var(--member-muted, #58695f)",
                        fontSize: 11,
                      }}
                    >
                      <span className="member-rest">
                        <CalendarDays size={22} />
                        <strong>Ngày nghỉ tập</strong>
                        <span>Chưa có ca học</span>
                      </span>
                    </div>
                  ) : (
                    dayClasses.map((item) => {
                      const sch = item.schedule;
                      const startTime = new Date(sch.startTime);
                      const endTime = new Date(sch.endTime);

                      return (
<<<<<<< HEAD
                        <div
                          className="member-calendar-event"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              navigate(`/member/classes/${item.classId}`);
                            }
                          }}
=======
                        <button
                          type="button"
                          className="member-calendar-event"
>>>>>>> develop
                          key={item.id}
                          onClick={() =>
                            navigate(`/member/classes/${item.classId}`)
                          }
                          style={{
                            backgroundColor:
                              "var(--member-accent-soft, #f2f8eb)",
                            border:
                              "1px solid var(--member-accent-border, #d4ebbf)",
                            borderRadius: 10,
                            padding: "8px 10px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            transition: "transform 0.15s",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--member-text, #203d31)",
                              lineHeight: 1.2,
                            }}
                          >
                            {sch.class?.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--member-muted, #475467)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Clock
                              size={12}
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
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--member-muted, #667085)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <MapPin
                              size={11}
                              color="var(--member-muted, #58695f)"
                            />
                            {sch.room?.name}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {enrollments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={38} />}
              title="Chưa có lịch học nào"
              description="Hãy đặt các lớp học để lịch trình của bạn hiển thị tại đây."
            />
          ) : (
            enrollments.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: "var(--member-surface, #ffffff)",
                  borderRadius: 14,
                  border: "1px solid var(--member-border, #e7ece9)",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "var(--member-text, #203d31)",
                    }}
                  >
                    {item.schedule?.class?.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginTop: 4,
                      fontSize: 13,
                      color: "var(--member-muted, #475467)",
                    }}
                  >
                    <span>📅 {formatMemberDate(item.schedule?.startTime)}</span>
                    <span>
                      ⏰{" "}
                      {formatMemberDate(item.schedule?.startTime, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {formatMemberDate(item.schedule?.endTime, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>🏛️ Phòng {item.schedule?.room?.name}</span>
                  </div>
                </div>

                <button
                  className="member-button member-button-primary"
                  onClick={() => navigate(`/member/classes/${item.classId}`)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "var(--member-accent-soft, #f2f8eb)",
                    color: "var(--member-text, #203d31)",
                    border: "1px solid var(--member-accent-border, #d4ebbf)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Xem chi tiết
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
