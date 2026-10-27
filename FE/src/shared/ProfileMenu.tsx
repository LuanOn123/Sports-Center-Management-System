import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LifeBuoy, ReceiptText, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Avatar } from "./Avatar";
import type { ProfileOk } from "./generated";
import "./profile-menu.css";

export function ProfileMenu({
  user,
  base,
}: {
  user: ProfileOk["data"];
  base: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="member-profile-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="member-profile-trigger"
        aria-label={`Menu hồ sơ của ${user.fullName}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="member-profile-name">
          <strong>{user.fullName}</strong>
          <small>Hội viên</small>
        </span>
        <Avatar user={user} interactive={false} />
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <nav
          id={id}
          className="member-profile-dropdown"
          aria-label="Menu hồ sơ"
        >
          <div className="member-profile-caption">TÀI KHOẢN CỦA BẠN</div>
          <Link to={`${base}/profile`}>
            <UserRound size={18} />
            Hồ sơ cá nhân
          </Link>
          <Link to={`${base}/payments`}>
            <ReceiptText size={18} />
            Thanh toán & hóa đơn
          </Link>
          <Link to={`${base}/support`}>
            <LifeBuoy size={18} />
            Yêu cầu hỗ trợ
          </Link>
        </nav>
      )}
    </div>
  );
}
