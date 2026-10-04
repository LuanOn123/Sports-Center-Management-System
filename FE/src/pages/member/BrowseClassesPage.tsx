import { sportNames } from "../../shared/sports";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { classesApi } from "../../api/classes.api";
import type { AreaType } from "../../types/member";
import {
  Search,
  Volleyball,
  CalendarDays,
  Clock3,
  ArrowRight,
} from "lucide-react";
import {
  LoadingSpinner,
  EmptyState,
  StatusBadge,
} from "../../components/common";

function CoursePatternSummary({ classId }: { classId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["course-plan", classId],
    queryFn: () => classesApi.getCoursePlan(classId),
  });
  if (isLoading)
    return (
      <span style={{ color: "var(--member-muted, #98a2b3)" }}>
        Đang tải lịch học...
      </span>
    );
  const slots = data?.course?.slots || [];
  if (!slots.length)
    return (
      <span style={{ color: "var(--member-muted, #98a2b3)" }}>
        Chưa có lịch học sắp tới
      </span>
    );
  return slots.slice(0, 4).map((slot) => (
    <div
      key={`${slot.weekday}-${slot.startTime}-${slot.roomId}`}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <Clock3 size={14} color="var(--member-muted, #58695f)" />
      <span>
        {slot.weekdayLabel} · {slot.startTime}–{slot.endTime}
      </span>
    </div>
  ));
}

export function BrowseClassesPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"REGULAR" | "PREMIUM" | "">(
    "",
  );
  const [selectedArea, setSelectedArea] = useState<AreaType | "">("");
  const [page, setPage] = useState(1);

  // Fetch sports for filtering
  const { data: sportsData } = useQuery({
    queryKey: ["sports-list"],
    queryFn: () => classesApi.getSports(),
  });

  // Fetch classes
  const {
    data: classData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "classes",
      search,
      selectedSport,
      selectedType,
      selectedArea,
      page,
    ],
    queryFn: () =>
      classesApi.getClasses({
        search: search || undefined,
        sportId: selectedSport || undefined,
        classType: selectedType || undefined,
        areaType: selectedArea || undefined,
        isActive: true,
        page,
        limit: 12,
      }),
  });

  const classes = classData?.classes || [];
  const sports = sportsData?.sports || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER BANNER */}
      <div
        className="member-explore-hero"
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
          <span className="member-kicker">PULSE / KHÁM PHÁ</span>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--member-text, #203d31)",
              margin: "0 0 6px",
            }}
          >
            Khám phá Lớp học Thể thao
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--member-muted, #58695f)",
              fontSize: 13,
            }}
          >
            Lựa chọn môn thể thao yêu thích, xem lịch học và đặt chỗ trực tuyến
            nhanh chóng
          </p>
        </div>
      </div>

      <div className="member-sport-tabs" aria-label="Chọn bộ môn">
        <button
          className={!selectedSport ? "active" : ""}
          aria-pressed={!selectedSport}
          onClick={() => {
            setSelectedSport("");
            setPage(1);
          }}
        >
          Tất cả bộ môn
        </button>
        {sports.map((sport) => (
          <button
            key={sport.id}
            className={selectedSport === sport.id ? "active" : ""}
            aria-pressed={selectedSport === sport.id}
            onClick={() => {
              setSelectedSport(sport.id);
              setPage(1);
            }}
          >
            {sport.name}
          </button>
        ))}
      </div>
      {/* SEARCH AND FILTER BAR */}
      <div
        className="member-filter-bar"
        style={{
          background: "var(--member-surface, #ffffff)",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid var(--member-border, #e7ece9)",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <Search
            size={17}
            color="var(--member-muted, #58695f)"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            placeholder="Tìm tên lớp học..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: 38 }}
          />
        </div>

        {/* Filter Sport */}
        <div style={{ flex: "0 1 200px" }}>
          <select
            aria-label="Lọc theo bộ môn"
            value={selectedSport}
            onChange={(e) => {
              setSelectedSport(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả bộ môn</option>
            {sports.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Class Type */}
        <div style={{ flex: "0 1 180px" }}>
          <select
            aria-label="Lọc theo hạng lớp"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as "REGULAR" | "PREMIUM" | "");
              setPage(1);
            }}
          >
            <option value="">Tất cả hạng lớp</option>
            <option value="REGULAR">Regular Class</option>
            <option value="PREMIUM">Premium Class ★</option>
          </select>
        </div>

        <div style={{ flex: "0 1 180px" }}>
          <select
            aria-label="Lọc theo khu vực tập"
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value as AreaType | "");
              setPage(1);
            }}
          >
            <option value="">Tất cả khu vực</option>
            <option value="INDOOR">Trong nhà</option>
            <option value="OUTDOOR">Ngoài trời</option>
            <option value="POOL">Hồ bơi</option>
          </select>
        </div>

        {(search || selectedSport || selectedType || selectedArea) && (
          <button
            className="member-button"
            onClick={() => {
              setSearch("");
              setSelectedSport("");
              setSelectedType("");
              setSelectedArea("");
              setPage(1);
            }}
            style={{
              padding: "10px 14px",
              background: "none",
              border: "1px dashed var(--member-border, #d0d5dd)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--member-muted, #475467)",
              cursor: "pointer",
            }}
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* CLASS GRID */}
      {isLoading ? (
        <LoadingSpinner text="Đang tải danh sách lớp học..." />
      ) : error ? (
        <EmptyState
          title="Không thể tải danh sách lớp"
          description={(error as Error).message}
        />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<Volleyball size={40} />}
          title="Không tìm thấy lớp học phù hợp"
          description="Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ môn khác."
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: 20,
          }}
        >
          {classes.map((c) => (
            <div
              className="member-class-card"
              key={c.id}
              style={{
                backgroundColor: "var(--member-surface, #ffffff)",
                borderRadius: 16,
                border: "1px solid var(--member-border, #e7ece9)",
                padding: 22,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                transition: "box-shadow 0.2s, transform 0.2s",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--member-text, #203d31)",
                      backgroundColor: "var(--member-accent-soft, #f2f8eb)",
                      padding: "3px 9px",
                      borderRadius: 6,
                      border: "1px solid var(--member-accent-border, #d4ebbf)",
                    }}
                  >
                    {sportNames(c)}
                  </span>
                  <StatusBadge status={c.classType} />
                </div>

                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "var(--member-text, #203d31)",
                    margin: "0 0 8px",
                    lineHeight: 1.3,
                  }}
                >
                  {c.name}
                </h3>

                <p
                  style={{
                    fontSize: 13,
                    color: "var(--member-muted, #667085)",
                    lineHeight: 1.5,
                    margin: "0 0 16px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {c.description ||
                    "Lớp học tiêu chuẩn rèn luyện thể chất với giáo trình bài bản và chuyên nghiệp."}
                </p>

                {Boolean(c.coaches?.length) && (
                  <div className="member-class-coach">
                    <span className="member-coach-avatar">HLV</span>
                    <div>
                      <small>Huấn luyện viên</small>
                      <strong>
                        {c.coaches
                          ?.map((item) => item.coach?.user?.fullName)
                          .filter(Boolean)
                          .join(", ")}
                      </strong>
                    </div>
                  </div>
                )}
                <div
                  className="member-class-schedule"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--member-muted, #475467)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 700,
                      color: "var(--member-text, #203d31)",
                    }}
                  >
                    <CalendarDays
                      size={15}
                      color="var(--member-accent, #376228)"
                    />
                    <span>Lịch học trong tuần</span>
                  </div>
                  <CoursePatternSummary classId={c.id} />
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid var(--member-surface-alt, #f2f5f3)",
                }}
              >
                <button
                  className="member-button member-button-primary"
                  onClick={() => navigate(`/member/classes/${c.id}`)}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    backgroundColor: "var(--member-accent-soft, #f2f8eb)",
                    color: "var(--member-text, #203d31)",
                    border: "1px solid var(--member-accent-border, #d4ebbf)",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  Xem chi tiết khóa học <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pagination">
        <button
          className="button"
          disabled={page === 1 || isLoading}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <span>Trang {page}</span>
        <button
          className="button"
          disabled={
            isLoading ||
            !classData?.pagination ||
            page >= classData.pagination.totalPages
          }
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}
