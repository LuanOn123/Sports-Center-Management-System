import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { api } from "./api";
import type { Term } from "./generated";
import "./member-status.css";

function fmtDate(date: string | Date) {
  return new Date(date).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
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
  const open =
    !["PLANNING", "CLOSED"].includes(term.status) && now >= start && now <= end;
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / 86400000),
  );
  const status =
    term.status === "CLOSED"
      ? "Đã kết thúc"
      : term.status === "PLANNING"
        ? "Đang chuẩn bị"
        : now < start
          ? "Sắp mở đăng ký"
          : open
            ? "Đang mở đăng ký"
            : "Đã đóng đăng ký";
  const description =
    term.status === "CLOSED"
      ? `Kỳ học kết thúc ngày ${fmtDate(term.endDate)}.`
      : term.status === "PLANNING" || now < start
        ? `Dự kiến mở đăng ký từ ${fmtDate(start)} đến ${fmtDate(end)}.`
        : open
          ? `Đăng ký đến ${fmtDate(end)}${days > 0 ? ` · còn ${days} ngày` : " · hạn đăng ký hôm nay"}. Chọn lớp phù hợp với lịch tập của bạn.`
          : `Đăng ký đã đóng ngày ${fmtDate(end)}.${term.status === "IN_PROGRESS" ? " Bạn vẫn có thể theo dõi các lớp đã đăng ký." : ""}`;
  const Icon = open
    ? CheckCircle2
    : term.status === "PLANNING" || now < start
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
