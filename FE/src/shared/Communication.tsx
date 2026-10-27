import { Avatar } from "./Avatar";
import type { ReactNode } from "react";
import { ProtectedAttachment } from "./ProtectedAttachment";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
  Bell,
  CheckCheck,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Users,
  ArrowLeft,
  X,
} from "lucide-react";
import {
  api,
  BASE_URL,
  getAccessToken,
  endSession,
  type RecordData,
} from "./api";
import { Empty, ErrorState, Loading, Modal } from "./ui";
import { display } from "./config";
import "./workflow.css";
import "./communication.css";

type Notification = {
  id: string;
  type?: string;
  title: string;
  body: string;
  reason?: string;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export function getNotificationCta(
  n: Notification,
  role?: string,
): { label: string; to: string } | null {
  const type = String(n.type || "");
  const meta = n.metadata || {};
  if (type.startsWith("COACH_CHANGE_") && ["COACH", "MANAGER", "ADMIN"].includes(role || "")) {
    return { label: "Xem yêu cầu đổi HLV", to: `/${role!.toLowerCase()}/coach-changes` };
  }
  if (type.startsWith("LEAVE_REQUEST_")) {
    if (role === "MANAGER") {
      const leaveId = String(meta.leaveRequestId || meta.id || "");
      return {
        label: "Xem đơn nghỉ",
        to: leaveId ? `/manager/leave?id=${leaveId}` : `/manager/leave`,
      };
    }
    if (role === "COACH") {
      return {
        label: "Xem đơn nghỉ của tôi",
        to: "/coach/leave",
      };
    }
    if (role === "RECEPTIONIST") {
      return {
        label: "Xem đơn nghỉ của tôi",
        to: "/receptionist/leave",
      };
    }
  }
  if (
    type.includes("SCHEDULE") ||
    type === "COACH_CHANGED" ||
    type === "UPCOMING_CLASS"
  ) {
    if (role === "MEMBER") {
      return {
        label: "Xem lịch tập",
        to: "/member/schedule",
      };
    }
    if (role === "COACH") {
      return {
        label: "Xem lịch dạy",
        to: "/coach/schedule",
      };
    }
    if (role === "MANAGER") {
      return {
        label: "Xem lịch hoạt động",
        to: "/manager/schedules",
      };
    }
  }
  return null;
}

export function NotificationBell({
  base,
  role,
}: {
  base: string;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const count = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: ({ signal }) =>
      api<{ unreadCount: number }>("GET /notifications/unread-count", {
        signal,
      }),
    refetchInterval: 20_000,
  });
  const list = useQuery({
    queryKey: ["notifications", "popover"],
    queryFn: ({ signal }) =>
      api<Notification[]>("GET /notifications", {
        query: { page: "1", limit: "8" },
        signal,
      }),
    enabled: open,
    refetchInterval: open ? 20_000 : false,
  });
  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(
        id === "all"
          ? "PATCH /notifications/mark-all-read"
          : "PATCH /notifications/{id}/read",
        { params: { id } },
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["notifications"] }),
  });
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const unreadCount = count.data?.data.unreadCount || 0;
  return (
    <div
      className="notification-bell"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`topbar-icon ${unreadCount ? "has-unread attention" : ""}`}
        aria-label={
          unreadCount ? `${unreadCount} thông báo chưa đọc` : "Thông báo"
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="utility-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          ref={panel}
          id={panelId}
          tabIndex={-1}
          className="notification-popover"
          aria-label="Thông báo gần đây"
        >
          <header>
            <div>
              <strong>Thông báo</strong>
              <small>
                {count.data
                  ? `${unreadCount} chưa đọc`
                  : "Chưa cập nhật số chưa đọc"}
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              title="Đánh dấu tất cả đã đọc"
              aria-label="Đánh dấu tất cả đã đọc"
              disabled={!unreadCount || markRead.isPending}
              onClick={() => markRead.mutate("all")}
            >
              <CheckCheck size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Đóng thông báo"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          {markRead.error && <ErrorState error={markRead.error} />}
          {count.error && !list.error && (
            <ErrorState error={count.error} retry={() => count.refetch()} />
          )}
          {markRead.isPending && (
            <p className="notification-feedback" role="status">
              Đang cập nhật trạng thái đọc…
            </p>
          )}
          <div className="notification-popover-list">
            {list.isPending ? (
              <Loading variant="cards" />
            ) : list.error ? (
              <ErrorState error={list.error} retry={() => list.refetch()} />
            ) : !list.data.data.length ? (
              <Empty
                text="Không có thông báo."
                detail="Lịch tập, thanh toán và cập nhật từ trung tâm sẽ xuất hiện tại đây."
              />
            ) : (
              list.data.data.map((item) => {
                const cta = getNotificationCta(item, role);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`notification-popover-item ${item.isRead ? "" : "unread"} ${expandedId === item.id ? "expanded" : ""}`}
                    aria-expanded={expandedId === item.id}
                    disabled={markRead.isPending}
                    onClick={() => {
                      setExpandedId((value) =>
                        value === item.id ? null : item.id,
                      );
                      if (!item.isRead) markRead.mutate(item.id);
                    }}
                  >
                    <span className="notification-dot" />
                    <span>
                      <strong>{item.title}</strong>
                      {!item.isRead && (
                        <small className="notification-unread-label">
                          Chưa đọc
                        </small>
                      )}
                      <p>{item.body}</p>
                      {item.reason && (
                        <p
                          style={{
                            fontStyle: "italic",
                            opacity: 0.85,
                            fontSize: "0.85rem",
                          }}
                        >
                          Lý do: {item.reason}
                        </p>
                      )}
                      <small>{display(item.createdAt)}</small>
                      {cta && (
                        <span
                          className="button small primary"
                          style={{
                            marginTop: "6px",
                            display: "inline-block",
                            width: "fit-content",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            if (!item.isRead) markRead.mutate(item.id);
                            navigate(cta.to);
                          }}
                        >
                          {cta.label}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <footer>
            <Link to={`${base}/notifications`} onClick={() => setOpen(false)}>
              Xem tất cả thông báo
            </Link>
            <small>Chọn thông báo để đọc đầy đủ.</small>
          </footer>
        </section>
      )}
    </div>
  );
}

export function Notifications({ role }: { role: string }) {
  const [confirmReminders, setConfirmReminders] = useState(false);
  const [page, setPage] = useState(1),
    [unread, setUnread] = useState(false);
  const cache = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications", page, unread],
    queryFn: ({ signal }) =>
      api<Notification[]>("GET /notifications", {
        query: {
          page: String(page),
          limit: "20",
          ...(unread ? { isRead: "false" } : {}),
        },
        signal,
      }),
  });
  const count = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: ({ signal }) =>
      api<{ unreadCount: number }>("GET /notifications/unread-count", {
        signal,
      }),
  });
  const action = useMutation({
    mutationFn: (id: string) =>
      api(
        id === "all"
          ? "PATCH /notifications/mark-all-read"
          : "PATCH /notifications/{id}/read",
        { params: { id } },
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const reminders = useMutation({
    mutationFn: () =>
      api<{ sent: number }>("POST /notifications/trigger-upcoming-reminders"),
    onSuccess: () => {
      setConfirmReminders(false);
      return cache.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  return (
    <div className="workflow-page">
      <div className="page-heading">
        <div>
          <h1>Thông báo</h1>
          <p>
            {count.data
              ? `${count.data.data.unreadCount} thông báo chưa đọc`
              : "Cập nhật từ trung tâm"}
          </p>
        </div>
      </div>
      <div className="workflow-actions">
        <label>
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Chỉ xem chưa đọc
        </label>
        <button
          className="button"
          disabled={action.isPending || !count.data?.data.unreadCount}
          onClick={() => action.mutate("all")}
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>
      {action.error && <ErrorState error={action.error} />}
      {list.isPending ? (
        <Loading variant="cards" />
      ) : list.error ? (
        <ErrorState error={list.error} retry={() => list.refetch()} />
      ) : !list.data.data.length ? (
        <Empty text="Không có thông báo." />
      ) : (
        list.data.data.map((n) => (
          <article className="panel workflow-card" key={n.id}>
            <div className="workflow-actions">
              <h2>{n.title}</h2>
              {!n.isRead && <span className="badge">Chưa đọc</span>}
            </div>
            <NotificationBody text={n.body} />
            {n.reason && <p>Lý do: {n.reason}</p>}
            <small>{display(n.createdAt)}</small>
            <div
              className="workflow-actions"
              style={{ marginTop: "10px", gap: "8px" }}
            >
              {(() => {
                const cta = getNotificationCta(n, role);
                return cta ? (
                  <Link
                    to={cta.to}
                    className="button small primary"
                    onClick={() => {
                      if (!n.isRead) action.mutate(n.id);
                    }}
                  >
                    {cta.label}
                  </Link>
                ) : null;
              })()}
              {!n.isRead && (
                <button
                  className="button small"
                  disabled={action.isPending}
                  onClick={() => action.mutate(n.id)}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
          </article>
        ))
      )}
      <div className="workflow-actions">
        <button
          className="button"
          disabled={page === 1 || list.isFetching}
          onClick={() => setPage((p) => p - 1)}
        >
          Trước
        </button>
        <span>Trang {page}</span>
        <button
          className="button"
          disabled={
            list.isFetching ||
            !list.data?.pagination ||
            page >= list.data.pagination.totalPages
          }
          onClick={() => setPage((p) => p + 1)}
        >
          Sau
        </button>
      </div>
      {["MANAGER", "RECEPTIONIST"].includes(role) && (
        <section className="panel workflow-card">
          <h2>Nhắc lịch tập sắp tới</h2>
          <p>
            Gửi thông báo trong hệ thống cho hội viên đã đặt lớp trong 24 giờ
            tới.
          </p>
          <button
            className="button"
            disabled={reminders.isPending}
            onClick={() => {
              reminders.reset();
              setConfirmReminders(true);
            }}
          >
            {reminders.isPending ? "Đang gửi…" : "Gửi nhắc lịch"}
          </button>
          {reminders.error && <ErrorState error={reminders.error} />}
          {reminders.isSuccess && (
            <p role="status">Đã gửi {reminders.data.data.sent} thông báo.</p>
          )}
          {confirmReminders && (
            <Modal
              title="Xác nhận gửi nhắc lịch"
              onClose={() => setConfirmReminders(false)}
              dismissible={!reminders.isPending}
            >
              <div className="help-panel">
                <p>
                  Thông báo sẽ được gửi trong hệ thống cho các hội viên đã đặt
                  lớp trong 24 giờ tới. Bạn muốn gửi ngay?
                </p>
                {reminders.error && <ErrorState error={reminders.error} />}
                <div className="modal-footer">
                  <button
                    className="button"
                    disabled={reminders.isPending}
                    onClick={() => setConfirmReminders(false)}
                  >
                    Hủy
                  </button>
                  <button
                    className="button primary"
                    disabled={reminders.isPending}
                    onClick={() => reminders.mutate()}
                  >
                    {reminders.isPending ? "Đang gửi…" : "Xác nhận gửi"}
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </section>
      )}
    </div>
  );
}

function NotificationBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <p className={expanded ? "" : "workflow-notification-preview"}>{text}</p>
      {text.length > 240 && (
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Thu gọn" : "Xem đầy đủ"}
        </button>
      )}
    </>
  );
}

type Contact = {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  avatarUrl?: string | null;
};
type Message = {
  id: string;
  senderId: string;
  receiverId?: string | null;
  sender: Contact;
  content?: string;
  fileUrl?: string;
  createdAt: string;
  isRead?: boolean;
};
type ConversationItem = {
  user: Contact;
  unreadCount: number;
  latestMessage?: Message;
};

export function FloatingChat({
  userId,
  launcher,
  onUnreadCountChange,
}: {
  userId: string;
  launcher?: (launch: () => void, unreadCount: number) => ReactNode;
  onUnreadCountChange?: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  const unread = useQuery({
    queryKey: ["chat", "unread-count"],
    queryFn: ({ signal }) =>
      api<{ unreadCount: number }>("GET /chat/messages/unread-count", {
        signal,
      }),
    refetchInterval: open ? false : 20_000,
  });
  useEffect(() => {
    const socket = io(BASE_URL.replace(/\/api\/v1$/, ""), {
      transports: ["websocket", "polling"],
      auth: (done) => done({ token: getAccessToken() }),
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    socket.on("disconnect", handleDisconnect);
    socket.on("newMessage", () => {
      void cache.invalidateQueries({ queryKey: ["chat"] });
    });
    socket.on("messagesRead", () => {
      void cache.invalidateQueries({ queryKey: ["chat"] });
    });
    return () => {
      socket.disconnect();
    };
  }, [cache]);
  const unreadCount = unread.data?.data.unreadCount || 0;
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);
  return (
    <>
      {launcher?.(() => setOpen((value) => !value), unreadCount)}
      <div className={`floating-chat ${open ? "open" : ""}`}>
        {open && (
          <section className="floating-chat-panel" aria-label="Cửa sổ tin nhắn">
            <header className="floating-chat-header">
              <div>
                <span className="chat-brand-icon">
                  <MessageCircle size={21} />
                </span>
                <span className="chat-header-title">
                  <strong>Tin nhắn Pulse</strong>
                  <small>Kết nối với đội ngũ của bạn</small>
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Đóng tin nhắn"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <Chat userId={userId} compact />
          </section>
        )}
        {!launcher && (
          <button
            type="button"
            className={`floating-chat-button ${unreadCount ? "has-unread attention" : ""}`}
            aria-label={
              open
                ? "Đóng tin nhắn"
                : unreadCount
                  ? `${unreadCount} tin nhắn chưa đọc`
                  : "Mở tin nhắn"
            }
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={24} /> : <MessageCircle size={25} />}
            {!open && unreadCount > 0 && (
              <span className="utility-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        )}
      </div>
    </>
  );
}

function handleDisconnect(reason: string) {
  if (reason === "io server disconnect")
    endSession(
      "Phiên đăng nhập đã kết thúc ở thiết bị khác. Vui lòng đăng nhập lại.",
    );
}
export function Chat({
  userId,
  compact = false,
}: {
  userId: string;
  compact?: boolean;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const cache = useQueryClient();
  const contacts = useQuery({
    queryKey: ["chat", "contacts"],
    queryFn: ({ signal }) => api<Contact[]>("GET /chat/contacts", { signal }),
  });
  const conversations = useQuery({
    queryKey: ["chat", "conversations"],
    refetchInterval: connected ? false : 15000,
    queryFn: ({ signal }) =>
      api<ConversationItem[]>("GET /chat/conversations", {
        signal,
      }),
  });
  useEffect(() => {
    const socketUrl = BASE_URL.replace(/\/api\/v1$/, "");
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      auth: (done) => done({ token: getAccessToken() }),
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("presence:list", (ids: string[]) => setOnline(new Set(ids)));
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("disconnect", handleDisconnect);
    socket.on("newMessage", () => {
      void cache.invalidateQueries({ queryKey: ["chat"] });
    });
    socket.on("messageSent", () => {
      void cache.invalidateQueries({ queryKey: ["chat"] });
    });
    socket.on("messagesRead", () => {
      void cache.invalidateQueries({ queryKey: ["chat"] });
    });
    socket.on("presenceChanged", ({ userId: id, online: isOnline }) => {
      setOnline((current) => {
        const next = new Set(current);
        if (isOnline) next.add(id);
        else next.delete(id);
        return next;
      });
    });
    socket.on("typing", ({ userId: id, isTyping }) => {
      setTyping((current) => {
        const next = new Set(current);
        if (isTyping) next.add(id);
        else next.delete(id);
        return next;
      });
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cache]);
  const conversationById = new Map(
    (conversations.data?.data || []).map((item) => [item.user.id, item]),
  );
  const orderedContacts = useMemo(() => {
    const byId = new Map(
      (contacts.data?.data || []).map((contact) => [contact.id, contact]),
    );
    for (const item of conversations.data?.data || [])
      byId.set(item.user.id, item.user);
    const history = new Map(
      (conversations.data?.data || []).map((item) => [item.user.id, item]),
    );
    const query = search.trim().toLocaleLowerCase("vi");
    return [...byId.values()]
      .filter(
        (contact) =>
          (query || history.get(contact.id)?.latestMessage) &&
          (contact.fullName + " " + (contact.email || ""))
            .toLocaleLowerCase("vi")
            .includes(query),
      )
      .sort((a, b) => {
        const first = history.get(a.id),
          second = history.get(b.id);
        const unread =
          Number(Boolean(second?.unreadCount)) -
          Number(Boolean(first?.unreadCount));
        if (unread) return unread;
        const timeA = Date.parse(first?.latestMessage?.createdAt || "") || 0;
        const timeB = Date.parse(second?.latestMessage?.createdAt || "") || 0;
        return timeB - timeA || a.fullName.localeCompare(b.fullName, "vi");
      });
  }, [contacts.data, conversations.data, search]);
  const selectedContact =
    contacts.data?.data.find((item) => item.id === target) ||
    conversationById.get(target || "")?.user;
  const selectConversation = (id: string) => setTarget(id);
  return (
    <div className={"workflow-page chat-page " + (compact ? "compact" : "")}>
      {!compact && (
        <div className="page-heading">
          <div>
            <h1>Tin nhắn</h1>
            <p>Trao đổi với đội ngũ và huấn luyện viên của trung tâm.</p>
          </div>
        </div>
      )}
      <div
        className="chat-shell panel"
        data-conversation-open={target !== null}
      >
        <aside className="chat-sidebar" aria-label="Danh sách trò chuyện">
          <div className="chat-sidebar-head">
            <h2>Cuộc trò chuyện</h2>
            <div className="chat-search">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="Tìm cuộc trò chuyện"
                placeholder="Tìm tên hoặc email…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="chat-contact-list">
            {contacts.isPending || conversations.isPending ? (
              <Loading variant="field" />
            ) : contacts.error ? (
              <ErrorState
                error={contacts.error}
                retry={() => contacts.refetch()}
              />
            ) : conversations.error ? (
              <ErrorState
                error={conversations.error}
                retry={() => conversations.refetch()}
              />
            ) : (
              <>
                {orderedContacts.length === 0 && (
                  <p className="chat-list-hint">
                    {search.trim()
                      ? "Không tìm thấy người phù hợp."
                      : "Chưa có cuộc trò chuyện riêng. Tìm tên để bắt đầu nhắn tin."}
                  </p>
                )}
                {orderedContacts.map((contact) => {
                  const item = conversationById.get(contact.id);
                  const latest = item?.latestMessage;
                  return (
                    <button
                      type="button"
                      key={contact.id}
                      aria-label={contact.fullName}
                      className={
                        "chat-contact chat-conversation-row " +
                        (target === contact.id ? "active " : "") +
                        (item?.unreadCount ? "unread" : "")
                      }
                      onClick={() => selectConversation(contact.id)}
                    >
                      <span className="chat-avatar">
                        <Avatar user={contact} interactive={false} />
                        <i className={online.has(contact.id) ? "online" : ""} />
                      </span>
                      <span className="chat-contact-copy">
                        <strong>{contact.fullName}</strong>
                        <small>
                          {latest
                            ? (latest.senderId === userId ? "Bạn: " : "") +
                              (latest.content ||
                                (latest.fileUrl
                                  ? "Đã gửi tệp đính kèm"
                                  : "Tin nhắn mới"))
                            : "Bắt đầu cuộc trò chuyện"}
                        </small>
                      </span>
                      <span className="chat-contact-meta">
                        {latest && (
                          <time dateTime={latest.createdAt}>
                            {new Date(latest.createdAt).toLocaleDateString(
                              "vi-VN",
                            ) === new Date().toLocaleDateString("vi-VN")
                              ? new Date(latest.createdAt).toLocaleTimeString(
                                  "vi-VN",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : new Date(latest.createdAt).toLocaleDateString(
                                  "vi-VN",
                                  { day: "2-digit", month: "2-digit" },
                                )}
                          </time>
                        )}
                        {Boolean(item?.unreadCount) && (
                          <b
                            className="chat-unread"
                            aria-label={
                              item!.unreadCount + " tin nhắn chưa đọc"
                            }
                          >
                            {item!.unreadCount > 99 ? "99+" : item!.unreadCount}
                          </b>
                        )}
                      </span>
                    </button>
                  );
                })}
                {(!search.trim() ||
                  "phòng chung".includes(
                    search.trim().toLocaleLowerCase("vi"),
                  )) && (
                  <button
                    type="button"
                    aria-label="Phòng chung"
                    className={
                      "chat-contact chat-conversation-row " +
                      (target === "" ? "active" : "")
                    }
                    onClick={() => selectConversation("")}
                  >
                    <span className="chat-avatar group">
                      <Users size={20} />
                    </span>
                    <span className="chat-contact-copy">
                      <strong>Phòng chung</strong>
                      <small>Không gian trao đổi của trung tâm</small>
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </aside>
        {target !== null ? (
          <Conversation
            key={target}
            target={target}
            userId={userId}
            contact={selectedContact}
            online={target ? online.has(target) : connected}
            isTyping={target ? typing.has(target) : false}
            socket={socketRef.current}
            connected={connected}
            onBack={compact ? () => setTarget(null) : undefined}
          />
        ) : (
          !compact && (
            <div className="chat-welcome">
              <span>
                <MessageCircle size={30} />
              </span>
              <h3>Tin nhắn của bạn</h3>
              <p>Chọn cuộc trò chuyện hoặc tìm tên để bắt đầu.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Conversation({
  target,
  userId,
  contact,
  online,
  isTyping,
  socket,
  connected,
  onBack,
}: {
  onBack?: () => void;
  target: string;
  userId: string;
  contact?: Contact;
  online: boolean;
  isTyping: boolean;
  socket: Socket | null;
  connected: boolean;
}) {
  const cache = useQueryClient();
  const [content, setContent] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [validation, setValidation] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const messages = useQuery({
    queryKey: ["chat", "messages", target],
    queryFn: ({ signal }) =>
      api<Message[]>("GET /chat/messages", {
        query: { targetId: target },
        signal,
      }),
    refetchInterval: connected ? false : 15000,
  });
  const read = useMutation({
    mutationFn: () =>
      api("PATCH /chat/messages/read", { body: { targetId: target } }),
    onSuccess: () => {
      socket?.emit("markAsRead", { targetId: target || undefined });
      void cache.invalidateQueries({ queryKey: ["chat"] });
    },
  });
  const send = useMutation({
    mutationFn: (body: FormData) =>
      api<RecordData>("POST /chat/messages", { body }),
    onSuccess: () => {
      setContent("");
      setFile(null);
      socket?.emit("typing", {
        receiverId: target || undefined,
        isTyping: false,
      });
      void cache.invalidateQueries({ queryKey: ["chat"] });
    },
  });
  useEffect(() => {
    if (target && messages.isSuccess) read.mutate();
  }, [target, messages.isSuccess]);
  useEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.data?.data.length, isTyping]);
  useEffect(
    () => () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      socket?.emit("typing", {
        receiverId: target || undefined,
        isTyping: false,
      });
    },
    [socket, target],
  );
  function updateTyping(value: string) {
    setContent(value);
    if (!socket || !connected) return;
    socket.emit("typing", {
      receiverId: target || undefined,
      isTyping: Boolean(value.trim()),
    });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () =>
        socket.emit("typing", {
          receiverId: target || undefined,
          isTyping: false,
        }),
      1600,
    );
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (send.isPending) return;
    setValidation("");
    if (!content.trim() && !file) {
      setValidation("Nhập nội dung hoặc chọn tệp đính kèm.");
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setValidation("Tệp tối đa 10 MB.");
      return;
    }
    if (
      file &&
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
      ].includes(file.type)
    ) {
      setValidation("Chỉ gửi được ảnh JPEG/PNG/WebP/GIF hoặc PDF.");
      return;
    }
    const body = new FormData();
    if (target) body.set("receiverId", target);
    if (content.trim()) body.set("content", content.trim());
    if (file) body.set("file", file);
    send.mutate(body);
  }
  return (
    <section className="chat-conversation">
      <header className="chat-conversation-head">
        {onBack && (
          <button
            type="button"
            className="icon-button chat-back"
            aria-label="Quay lại cuộc trò chuyện"
            onClick={onBack}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <span className={`chat-avatar ${target ? "" : "group"}`}>
          {target ? (
            contact ? (
              <Avatar user={contact} />
            ) : (
              "?"
            )
          ) : (
            <Users size={18} />
          )}
          {target && <i className={online ? "online" : ""} />}
        </span>
        <div>
          <h2>
            {target ? contact?.fullName || "Trao đổi riêng" : "Phòng chung"}
          </h2>
          <small>
            {target
              ? online
                ? "Đang hoạt động"
                : display(contact?.role)
              : "Không gian chung của trung tâm"}
          </small>
        </div>
        {target && (
          <button
            className="button small"
            disabled={read.isPending}
            onClick={() => read.mutate()}
          >
            Đánh dấu đã đọc
          </button>
        )}
      </header>
      {read.error && <ErrorState error={read.error} />}
      <div
        className="workflow-messages chat-log"
        role="log"
        aria-label="Lịch sử trò chuyện"
        ref={log}
      >
        {messages.isPending ? (
          <Loading variant="cards" />
        ) : messages.error ? (
          <ErrorState error={messages.error} retry={() => messages.refetch()} />
        ) : !messages.data.data.length ? (
          <div className="chat-welcome">
            <span>
              <MessageCircle size={30} aria-hidden="true" />
            </span>
            <h3>Bắt đầu cuộc trò chuyện</h3>
            <p>
              Chia sẻ câu hỏi, lịch tập hoặc gửi lời chào đến{" "}
              {target
                ? contact?.fullName || "người nhận"
                : "mọi người trong trung tâm"}
              .
            </p>
          </div>
        ) : (
          messages.data.data.map((m, index) => (
            <article
              className={
                "workflow-message " + (m.senderId === userId ? "own" : "")
              }
              key={m.id}
            >
              {m.senderId !== userId && <strong>{m.sender?.fullName}</strong>}
              {m.content && <p>{m.content}</p>}
              {m.fileUrl && <ProtectedAttachment url={m.fileUrl} />}
              <small>
                {new Date(m.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {m.senderId === userId &&
                index === messages.data.data.length - 1
                  ? " · Đã gửi"
                  : ""}
              </small>
            </article>
          ))
        )}
        {isTyping && (
          <div className="chat-typing" aria-live="polite">
            <i />
            <i />
            <i />
            <span>đang nhập…</span>
          </div>
        )}
      </div>
      <form className="chat-composer" onSubmit={submit} ref={form}>
        <fieldset disabled={send.isPending}>
          {file && (
            <div className="chat-file">
              <Paperclip size={15} /> <span>{file.name}</span>
              <button
                type="button"
                aria-label="Bỏ tệp"
                onClick={() => setFile(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="chat-compose-row">
            <label className="chat-attach" title="Đính kèm tệp">
              <Paperclip size={19} />
              <span className="sr-only">
                Ảnh (JPEG/PNG/WebP/GIF) hoặc PDF · tối đa 10 MB
              </span>
              <input
                aria-label="Ảnh (JPEG/PNG/WebP/GIF) hoặc PDF · tối đa 10 MB"
                key={send.isSuccess && !file ? "empty" : "file"}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            <label className="chat-input">
              <span className="sr-only">Nội dung</span>
              <textarea
                aria-label="Nội dung"
                placeholder={`Nhắn tin tới ${target ? contact?.fullName || "người nhận" : "phòng chung"}…`}
                maxLength={5000}
                rows={1}
                value={content}
                onChange={(event) => updateTyping(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    form.current?.requestSubmit();
                  }
                }}
              />
            </label>
            <button
              className="chat-send"
              aria-label="Gửi tin nhắn"
              disabled={send.isPending || (!content.trim() && !file)}
            >
              <Send size={19} />
            </button>
          </div>
          {validation && <p role="alert">{validation}</p>}
          {send.error && <ErrorState error={send.error} />}
          {send.isPending && <small role="status">Đang gửi tin nhắn…</small>}
        </fieldset>
      </form>
    </section>
  );
}
