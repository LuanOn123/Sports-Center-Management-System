import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  CreditCard,
  LifeBuoy,
  LogOut,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { currentMembershipQuery } from "../api/membership.api";
import { Avatar } from "./Avatar";
import { effectiveSubscription } from "./businessRules";
import type { ProfileOk } from "./generated";
import "./profile-menu.css";
import { display } from "./config";

export function ProfileMenu({
  user,
  base,
  onLogout,
}: {
  user: ProfileOk["data"];
  base: string;
  onLogout?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const location = useLocation();
  const membership = useQuery(
    currentMembershipQuery(user.role === "MEMBER" ? user.id : undefined),
  );
  const activePlan = effectiveSubscription(membership.data?.subscriptions ?? []);
  const planName = activePlan
    ? activePlan.planNameSnapshot ||
      activePlan.plan?.name ||
      display(activePlan.tier)
    : null;
  const planStatus =
    planName ?? (membership.isSuccess ? "Chưa có gói hiệu lực" : null);
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
        aria-describedby={planStatus ? `${id}-plan` : undefined}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="member-profile-name">
          <strong>{user.fullName}</strong>
          <small>{user.role === "STAFF" ? "Lễ tân" : display(user.role)}</small>
          {planStatus && (
            <small
              id={`${id}-plan`}
              className="member-profile-plan"
              title={planStatus}
            >
              {planStatus}
            </small>
          )}
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
          {planStatus && (
            <Link to={`${base}/membership`}>
              <CreditCard size={18} aria-hidden="true" />
              <span className="member-profile-plan-link">{planStatus}</span>
            </Link>
          )}
          <Link to={`${base}/profile`}>
            <UserRound size={18} />
            Hồ sơ cá nhân
          </Link>
          {user.role === "MEMBER" && (
            <>
              <Link to={`${base}/payments`}>
                <ReceiptText size={18} />
                Thanh toán & hóa đơn
              </Link>
              <Link to={`${base}/support`}>
                <LifeBuoy size={18} />
                Yêu cầu hỗ trợ
              </Link>
            </>
          )}
          {user.role !== "MEMBER" && onLogout && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onLogout();
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={18} />
              {busy ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
