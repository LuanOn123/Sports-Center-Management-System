import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api } from "./api";
import type { Term } from "./generated";
import "./member-status.css";

function fmtDate(date: string | Date, withTime = false) {
  return new Date(date).toLocaleString("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  });
}

export function MemberTermBanner({
  variant = "compact",
}: {
  variant?: "compact" | "full";
}) {
  const { data } = useQuery({
    queryKey: ["member-current-term"],
    queryFn: () => api<Term>("GET /terms/current"),
    staleTime: 5 * 60 * 1000,
  });
  const location = useLocation();
  const term = data?.data;
  if (!term?.id) return null;
  const now = new Date();
  const start = new Date(term.registrationStartDate);
  const end = new Date(term.registrationEndDate);
  const closed = term.status === "CLOSED";
  const planning = term.status === "PLANNING";
  const upcoming = !closed && !planning && now < start;
  const open = !closed && !planning && now >= start && now <= end;
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / 86400000),
  );
  const status =
    closed
      ? "Đã kết thúc"
      : planning
        ? "Đang chuẩn bị"
        : upcoming
          ? "Sắp mở đăng ký"
          : open
            ? "Đang mở đăng ký"
            : "Đã đóng đăng ký";
  const description =
    closed
      ? `Kỳ học kết thúc ngày ${fmtDate(term.endDate)}.`
      : planning
        ? `Kỳ học đang được chuẩn bị. Dự kiến mở đăng ký từ ${fmtDate(start, true)}.`
        : upcoming
          ? `Dự kiến mở đăng ký từ ${fmtDate(start, true)} đến ${fmtDate(end)}.`
          : open
            ? `Đăng ký đến ${fmtDate(end)}${days > 0 ? ` · còn ${days} ngày` : " · hạn đăng ký hôm nay"}. Chọn lớp phù hợp với lịch tập của bạn.`
            : `Đăng ký đã đóng ngày ${fmtDate(end)}.${term.status === "IN_PROGRESS" ? " Bạn vẫn có thể theo dõi các lớp đã đăng ký." : ""}`;
  const Icon = open
    ? CheckCircle2
    : upcoming
      ? Clock
      : CalendarDays;
  return (
    <section
      className={`member-term-banner ${variant}`}
      data-open={open}
      aria-label="Thông tin kỳ học"
    >
      <span className="member-term-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="member-term-content">
        <div>
          <strong>{term.name}</strong>
          <span className="member-term-status">{status}</span>
        </div>
        <p>{description}</p>
      </div>
      {open && location.pathname !== "/member/classes" && (
        <Link className="button primary" to="/member/classes">
          Khám phá lớp học
        </Link>
      )}
    </section>
  );
}
