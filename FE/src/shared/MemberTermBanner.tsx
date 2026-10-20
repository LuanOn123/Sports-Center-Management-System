/**
 * MemberTermBanner — hiển thị trạng thái kỳ học hiện tại cho hội viên.
 *
 * Quy tắc nghiệp vụ (Member):
 * - PLANNING → Thông báo "Kỳ học đang lập kế hoạch – chưa mở đăng ký"
 * - OPEN_REGISTRATION (trong cửa sổ đăng ký) → Nổi bật "Đang mở đăng ký – đăng ký ngay!"
 * - OPEN_REGISTRATION (ngoài cửa sổ) → Cảnh báo chưa đến ngày hoặc đã hết hạn
 * - IN_PROGRESS → Thông báo kỳ học đang diễn ra, đăng ký đã đóng
 * - CLOSED → Thông báo "Kỳ học đã kết thúc"
 * - Không có kỳ → Ẩn banner
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Term } from "./generated";
import { CalendarDays, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface MemberTermBannerProps {
  /** "compact" = widget nhỏ cho dashboard; "full" = banner đầy đủ cho browse classes */
  variant?: "compact" | "full";
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

export function MemberTermBanner({ variant = "compact" }: MemberTermBannerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["member-current-term"],
    queryFn: () => api<Term>("GET /terms/current"),
    staleTime: 5 * 60 * 1000,
  });

  const term = (data as any)?.data ?? data;
  const now = new Date();

  if (isLoading) return null;
  if (!term) return null;

  const regStart = new Date(term.registrationStartDate);
  const regEnd = new Date(term.registrationEndDate);
  const termEnd = new Date(term.endDate);

  const isRegistrationOpen =
    term.status !== "PLANNING" &&
    term.status !== "CLOSED" &&
    now >= regStart &&
    now <= regEnd;

  const isBeforeRegistration = now < regStart && term.status !== "CLOSED";
  const isAfterRegistration = now > regEnd && term.status !== "CLOSED" && term.status !== "PLANNING";
  const isClosed = term.status === "CLOSED";
  const isPlanning = term.status === "PLANNING";

  const daysUntilRegOpen = isBeforeRegistration ? daysBetween(now, regStart) : 0;
  const daysUntilRegClose = isRegistrationOpen ? daysBetween(now, regEnd) : 0;
  const daysUntilTermEnd = !isClosed ? daysBetween(now, termEnd) : 0;

  // ── COMPACT variant (dashboard widget) ──────────────────────────────────────
  if (variant === "compact") {
    let bg = "var(--member-surface, #f9fafb)";
    let border = "var(--member-border, #e7ece9)";
    let iconColor = "#667085";
    let icon: React.ReactNode = <CalendarDays size={16} />;
    let message: React.ReactNode = null;

    if (isPlanning) {
      icon = <Clock size={16} />;
      iconColor = "#6941c6";
      bg = "#f4f3ff";
      border = "#d9d6fe";
      message = (
        <span>
          <strong>{term.name}</strong> — đang lập kế hoạch. Cổng đăng ký mở{" "}
          <strong>{fmtDate(regStart)}</strong>.
        </span>
      );
    } else if (isRegistrationOpen) {
      icon = <CheckCircle2 size={16} />;
      iconColor = "#027a48";
      bg = "#f0fdf4";
      border = "#bbf7d0";
      message = (
        <span>
          <strong>{term.name}</strong> — đang mở đăng ký.{" "}
          {daysUntilRegClose > 0 ? (
            <>Cổng đăng ký còn <strong>{daysUntilRegClose} ngày</strong> (hạn {fmtDate(regEnd)}).</>
          ) : (
            <>Hạn đăng ký hôm nay.</>
          )}
        </span>
      );
    } else if (isBeforeRegistration) {
      icon = <Clock size={16} />;
      iconColor = "#b54708";
      bg = "#fffaeb";
      border = "#fedf89";
      message = (
        <span>
          <strong>{term.name}</strong> — chưa mở cổng đăng ký. Còn{" "}
          <strong>{daysUntilRegOpen} ngày</strong> (mở {fmtDate(regStart)}).
        </span>
      );
    } else if (isAfterRegistration) {
      icon = <AlertTriangle size={16} />;
      iconColor = "#d92d20";
      bg = "#fef3f2";
      border = "#fecdca";
      message = (
        <span>
          <strong>{term.name}</strong> — hết hạn đăng ký ngày {fmtDate(regEnd)}.{" "}
          {daysUntilTermEnd > 0 && (
            <>Kỳ học kết thúc sau <strong>{daysUntilTermEnd} ngày</strong>.</>
          )}
        </span>
      );
    } else if (isClosed) {
      icon = <XCircle size={16} />;
      iconColor = "#667085";
      bg = "#f9fafb";
      border = "#d0d5dd";
      message = (
        <span>
          <strong>{term.name}</strong> — kỳ học đã kết thúc.
        </span>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 12,
          background: bg,
          border: `1px solid ${border}`,
          fontSize: 13,
          color: "var(--member-text, #203d31)",
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: iconColor, flexShrink: 0, display: "flex" }}>{icon}</span>
        <span style={{ flex: 1 }}>{message}</span>
        {isRegistrationOpen && (
          <Link
            to="/member/classes"
            style={{
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "#027a48",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Đặt lịch →
          </Link>
        )}
      </div>
    );
  }

  // ── FULL variant (browse classes page banner) ────────────────────────────────
  let bg = "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)";
  let border = "#bbf7d0";
  let titleColor = "#027a48";
  let icon: React.ReactNode = <CalendarDays size={20} />;
  let title = "";
  let subtitle: React.ReactNode = null;
  let tag: React.ReactNode = null;
  let ctaText: string | null = null;

  if (isPlanning) {
    bg = "linear-gradient(135deg, #f4f3ff 0%, #ede9fe 100%)";
    border = "#d9d6fe";
    titleColor = "#5925dc";
    icon = <Clock size={20} />;
    title = `Kỳ học sắp mở: ${term.name}`;
    subtitle = (
      <>
        Cổng đăng ký sẽ mở vào <strong>{fmtDate(regStart)}</strong>. Theo dõi để không bỏ lỡ!
      </>
    );
    tag = (
      <span style={{ background: "#ede9fe", color: "#5925dc", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        Sắp mở
      </span>
    );
  } else if (isRegistrationOpen) {
    title = `Kỳ học ${term.name} đang mở đăng ký!`;
    subtitle = (
      <>
        Cổng đăng ký mở đến <strong>{fmtDate(regEnd)}</strong>
        {daysUntilRegClose > 0 ? ` — còn ${daysUntilRegClose} ngày` : " — hạn chót hôm nay"}.
        {" "}Đăng ký ngay để giữ chỗ.
      </>
    );
    tag = (
      <span style={{ background: "#d1fae5", color: "#027a48", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        ⚡ Đang mở đăng ký
      </span>
    );
    ctaText = "Xem lớp học";
    icon = <CheckCircle2 size={20} />;
  } else if (isBeforeRegistration) {
    bg = "linear-gradient(135deg, #fffaeb 0%, #fef9c3 100%)";
    border = "#fedf89";
    titleColor = "#b54708";
    icon = <Clock size={20} />;
    title = `Kỳ học ${term.name} — chưa mở đăng ký`;
    subtitle = (
      <>
        Cổng đăng ký sẽ mở vào <strong>{fmtDate(regStart)}</strong>
        {daysUntilRegOpen > 0 ? ` (còn ${daysUntilRegOpen} ngày)` : " — ngày mai"}.
      </>
    );
    tag = (
      <span style={{ background: "#fef9c3", color: "#a16207", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        Chưa mở
      </span>
    );
  } else if (isAfterRegistration) {
    bg = "linear-gradient(135deg, #fff1f0 0%, #fef2f2 100%)";
    border = "#fecaca";
    titleColor = "#b91c1c";
    icon = <AlertTriangle size={20} />;
    title = `Kỳ học ${term.name} — hết hạn đăng ký`;
    subtitle = (
      <>
        Cổng đăng ký đã đóng vào {fmtDate(regEnd)}.
        {term.status === "IN_PROGRESS" ? " Kỳ học vẫn đang diễn ra." : ""}
      </>
    );
    tag = (
      <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        Hết hạn đăng ký
      </span>
    );
  } else if (isClosed) {
    bg = "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)";
    border = "#d1d5db";
    titleColor = "#374151";
    icon = <XCircle size={20} />;
    title = `Kỳ học ${term.name} đã kết thúc`;
    subtitle = `Kỳ học kết thúc vào ${fmtDate(termEnd)}. Kỳ học mới sẽ sớm được mở.`;
    tag = (
      <span style={{ background: "#e5e7eb", color: "#374151", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        Đã kết thúc
      </span>
    );
  }

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: titleColor,
            flexShrink: 0,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, color: titleColor }}>{title}</strong>
            {tag}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>{subtitle}</p>
        </div>
      </div>
      {ctaText && (
        <Link
          to="/member/classes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            background: "#027a48",
            color: "#ffffff",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(2,122,72,0.25)",
          }}
        >
          {ctaText} →
        </Link>
      )}
    </div>
  );
}
