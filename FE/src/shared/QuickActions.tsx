import { useEffect, useId, useRef, useState } from "react";
import { Bot, MessageCircle, ScanLine, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { FloatingChat } from "./Communication";
import { AttendanceShortcut } from "./AttendanceShortcut";
import { AIChatBubble } from "../features/ai/AIChatBubble";
import "./quick-actions.css";
import { FacilityVisits } from "./FacilityVisits";
import { Modal } from "./ui";

export function QuickActions({
  userId,
  role,
  base,
}: {
  userId: string;
  role: string;
  base: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const location = useLocation();

  useEffect(() => setExpanded(false), [location.pathname]);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function hoverOpen() {
    if (!window.matchMedia("(hover: hover)").matches) return;
    cancelClose();
    setExpanded(true);
  }
  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setExpanded(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);

  function action(
    label: string,
    Icon: LucideIcon,
    launch: () => void,
    unread = 0,
  ) {
    return (
      <button
        type="button"
        className="pulse-quick-action"
        aria-hidden={!expanded}
        tabIndex={expanded ? 0 : -1}
        aria-label={label}
        onClick={() => {
          // Keep a stable focus target for dialogs when their launcher disappears.
          trigger.current?.focus();
          cancelClose();
          setExpanded(false);
          launch();
        }}
      >
        <Icon size={20} aria-hidden="true" />
        <span>{label}</span>
        {unread > 0 && (
          <strong
            className="pulse-quick-unread"
            aria-label={`${unread} tin nhắn chưa đọc`}
          >
            {unread > 99 ? "99+" : unread}
          </strong>
        )}
      </button>
    );
  }

  return (
    <div
      className="pulse-quick-actions"
      data-expanded={expanded}
      ref={root}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        cancelClose();
        closeTimer.current = setTimeout(() => setExpanded(false), 180);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setExpanded(false);
      }}
    >
      <button
        type="button"
        className="pulse-quick-trigger"
        ref={trigger}
        aria-label={expanded ? "Đóng tiện ích nhanh" : "Mở tiện ích nhanh"}
        aria-expanded={expanded}
        aria-controls={panelId}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") hoverOpen();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setExpanded(true);
            requestAnimationFrame(() =>
              root.current
                ?.querySelector<HTMLButtonElement>(".pulse-quick-action")
                ?.focus(),
            );
          }
        }}
        onClick={(event) => {
          cancelClose();
          setExpanded((value) =>
            event.detail > 0 && window.matchMedia("(hover: hover)").matches
              ? true
              : !value,
          );
        }}
      >
        <img src="/brand/pulse-member.svg" width={36} height={36} alt="" />
        {unreadCount > 0 && (
          <span
            className="pulse-quick-unread pulse-quick-trigger-badge"
            aria-label={`${unreadCount} tin nhắn chưa đọc`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      <div
        id={panelId}
        className="pulse-quick-panel"
        role="group"
        aria-label="Tiện ích nhanh"
        onPointerEnter={cancelClose}
      >
        <AIChatBubble launcher={(launch) => action("Trợ lý AI", Bot, launch)} />
        <FloatingChat
          userId={userId}
          onUnreadCountChange={setUnreadCount}
          launcher={(launch, unread) =>
            action("Tin nhắn", MessageCircle, launch, unread)
          }
        />
        <AttendanceShortcut
          role={role}
          base={base}
          launcher={(launch) => action("Điểm danh", ScanLine, launch)}
        />
        {role === "MEMBER" &&
          action("Check-in cơ sở", MapPin, () => setCheckInOpen(true))}
      </div>
      {checkInOpen && (
        <Modal
          title="Check-in cơ sở"
          maxWidth={720}
          onClose={() => setCheckInOpen(false)}
        >
          <FacilityVisits />
        </Modal>
      )}
    </div>
  );
}
