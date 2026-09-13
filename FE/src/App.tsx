import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CreditCard,
  Dumbbell,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Volleyball,
  Warehouse,
  X,
  ClipboardList,
  ContactRound,
  HeartPulse,
} from "lucide-react";
import { authService, clearSession, hasSession } from "./api";
import type { ProfileOk } from "./generated";
import { resources } from "./config";
import { Dashboard } from "./Dashboard";
import { ResourcePage } from "./ResourcePage";
import { ErrorState, Loading, SchemaForm } from "./ui";
import "./styles.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Session />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Activity size={25} strokeWidth={2.7} />
      </span>
      <span>
        pulse<span className="brand-dot">.</span>
        <small>SPORTS CENTER</small>
      </span>
    </span>
  );
}
function Session() {
  const cache = useQueryClient();
  const [session, setSession] = useState(hasSession());
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => authService.me(),
    enabled: session,
    retry: false,
  });
  useEffect(() => {
    const expired = () => {
      setSession(false);
      cache.clear();
      setError(
        new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."),
      );
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [cache]);
  async function login(email: string, password: string) {
    setLoginBusy(true);
    setError(undefined);
    try {
      const profile = await authService.login({ email, password });
      cache.setQueryData(["me"], profile);
      setSession(true);
    } catch (e) {
      clearSession();
      setError(e);
    } finally {
      setLoginBusy(false);
    }
  }
  async function logout() {
    try {
      await authService.logout();
    } catch {
      setError(
        new Error(
          "Đã đăng xuất trên trình duyệt. Máy chủ chưa xác nhận thu hồi phiên do lỗi kết nối.",
        ),
      );
    } finally {
      setSession(false);
      cache.clear();
    }
  }
  if (!session) return <Login onLogin={login} busy={loginBusy} error={error} />;
  if (q.isPending)
    return (
      <div className="fullscreen">
        <Brand />
        <Loading />
      </div>
    );
  if (q.isError)
    return (
      <div className="fullscreen">
        <ErrorState error={q.error} retry={() => q.refetch()} />
        <button className="button" onClick={logout}>
          Quay lại đăng nhập
        </button>
      </div>
    );
  if (q.data.data.role !== "MANAGER" || !q.data.data.isActive)
    return (
      <div className="fullscreen">
        <ShieldCheck size={42} />
        <h1>Không có quyền truy cập</h1>
        <p>Khu vực này dành cho tài khoản quản lý trung tâm đang hoạt động.</p>
        <button className="button primary" onClick={logout}>
          Đăng nhập tài khoản khác
        </button>
      </div>
    );
  return <Shell user={q.data.data} onLogout={logout} />;
}
function Login({
  onLogin,
  busy,
  error,
}: {
  onLogin: (e: string, p: string) => Promise<void>;
  busy: boolean;
  error: unknown;
}) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    void onLogin(email.trim(), password);
  }
  return (
    <div className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story-copy">
          <span className="hero-kicker">
            <span /> BUILT FOR YOUR NEXT MOVE
          </span>
          <h1>
            Năng lượng mới.
            <br />
            Giới hạn mới.
            <br />
            <em>Khởi đầu từ bạn.</em>
          </h1>
          <p>
            Một không gian quản lý. Kết nối cả cộng đồng.
            <br />
            Đưa trung tâm của bạn tiến xa hơn mỗi ngày.
          </p>
          <div className="login-sport">
            <div>
              <Dumbbell size={32} />
            </div>
            <div>
              <Volleyball size={32} />
            </div>
            <div>
              <Trophy size={32} />
            </div>
            <span>
              MOVE TOGETHER.
              <br />
              <strong>GROW TOGETHER.</strong>
            </span>
          </div>
        </div>
        <div className="login-track" aria-hidden="true" />
        <div className="login-story-footer">
          <span>THE ENERGY TO GO FURTHER</span>
          <span>↗</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-top">
          <span>KHÔNG GIAN QUẢN LÝ</span>
          <span className="badge">
            <ShieldCheck size={13} />
            Center Manager
          </span>
        </div>
        <div className="login-form-wrap">
          <span className="login-icon">
            <HeartPulse size={26} />
          </span>
          <div className="eyebrow">CHÀO MỪNG TRỞ LẠI</div>
          <h2>Sẵn sàng giữ nhịp?</h2>
          <p>Đăng nhập để bắt đầu quản lý trung tâm của bạn.</p>
          <form onSubmit={submit}>
            <label>
              Email
              <input
                autoFocus
                type="email"
                placeholder="Email quản lý của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Mật khẩu
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error != null && <ErrorState error={error} />}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-help">
            <ShieldCheck size={16} />
            <p>
              Sử dụng tài khoản quản lý được cấp bởi trung tâm.
              <br />
              Cần hỗ trợ? Liên hệ quản trị viên hệ thống.
            </p>
          </div>
        </div>
        <footer>
          © {new Date().getFullYear()} Pulse Sports Center{" "}
          <span>Make every move count.</span>
        </footer>
      </section>
    </div>
  );
}
const navGroups = [
  { title: "TỔNG QUAN", items: [["dashboard", "Tổng quan", LayoutDashboard]] },
  {
    title: "CON NGƯỜI",
    items: [
      ["users", "Người dùng", Users],
      ["members", "Hội viên", ContactRound],
      ["coaches", "Huấn luyện viên", Dumbbell],
      ["staff", "Đội ngũ lễ tân", UserRound],
    ],
  },
  {
    title: "VẬN HÀNH",
    items: [
      ["membership-plans", "Gói thành viên", CreditCard],
      ["sports", "Bộ môn", Volleyball],
      ["rooms", "Phòng tập", Warehouse],
      ["classes", "Lớp học", Trophy],
      ["schedules", "Lịch hoạt động", CalendarDays],
    ],
  },
  {
    title: "QUẢN TRỊ",
    items: [
      ["reports", "Báo cáo & phân tích", ChartNoAxesCombined],
      ["roles", "Vai trò & quyền hạn", ShieldCheck],
      ["audit-logs", "Nhật ký hoạt động", ClipboardList],
    ],
  },
];
function Shell({
  user,
  onLogout,
}: {
  user: ProfileOk["data"];
  onLogout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const slug = location.pathname.split("/").pop();
  const title =
    navGroups.flatMap((g) => g.items).find((i) => i[0] === slug)?.[1] ||
    "Tài khoản";
  return (
    <div className="app-layout">
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={"sidebar " + (open ? "is-open" : "")}>
        <Link to="/manager/dashboard" className="brand-link">
          <Brand />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="workspace-chip">
          <span className="workspace-icon">
            <Warehouse size={18} />
          </span>
          <div>
            <strong>Trung tâm thể thao</strong>
            <small>Manager workspace</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav>
          {navGroups.map((g) => (
            <div className="nav-group" key={g.title}>
              <span>{g.title}</span>
              {g.items.map(([path, name, Icon]) => {
                const I = Icon as typeof Users;
                return (
                  <NavLink key={String(path)} to={"/manager/" + path}>
                    <I size={18} />
                    <span>{String(name)}</span>
                    {path === "dashboard" && (
                      <span className="nav-active-dot" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-motto">
            <Activity size={20} />
            <span>Better every day.</span>
            <ArrowRight size={15} />
          </div>
          <button
            className="logout"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              await onLogout();
              setLoggingOut(false);
            }}
          >
            <LogOut size={17} />
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>Không gian quản lý</span>
            <ChevronRight size={14} />
            <strong>{String(title)}</strong>
          </div>
          <Link to="/manager/profile" className="profile-link">
            <div>
              <strong>{user.fullName}</strong>
              <small>Quản lý trung tâm</small>
            </div>
            <span className="avatar">
              {user.fullName
                .split(" ")
                .slice(-2)
                .map((s) => s[0])
                .join("")}
            </span>
          </Link>
        </header>
        <main>
          <Routes>
            <Route path="/manager/dashboard" element={<Dashboard />} />
            <Route path="/manager/reports" element={<Dashboard reports />} />
            {resources.map((r) => (
              <Route
                key={r.slug}
                path={"/manager/" + r.slug}
                element={<ResourcePage key={r.slug} resource={r} />}
              />
            ))}
            <Route path="/manager/profile" element={<Profile user={user} />} />
            <Route
              path="/manager/roles"
              element={<Unavailable type="roles" />}
            />
            <Route
              path="/manager/audit-logs"
              element={<Unavailable type="audit" />}
            />
            <Route
              path="/"
              element={<Navigate replace to="/manager/dashboard" />}
            />
            <Route
              path="/login"
              element={<Navigate replace to="/manager/dashboard" />}
            />
            <Route
              path="*"
              element={
                <div className="fullscreen">
                  <h1>Không tìm thấy trang</h1>
                  <Link className="button primary" to="/manager/dashboard">
                    Về tổng quan
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="main-footer">
          <span>© {new Date().getFullYear()} Pulse Sports Center</span>
          <span>
            <span className="mini-dot" /> Make every move count.
          </span>
        </footer>
      </div>
    </div>
  );
}
function Profile({ user }: { user: ProfileOk["data"] }) {
  const client = useQueryClient();
  const [tab, setTab] = useState("profile");
  const [success, setSuccess] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TÀI KHOẢN CỦA BẠN</div>
          <h1>Thông tin cá nhân</h1>
          <p>Quản lý hồ sơ và bảo mật tài khoản.</p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => {
            setTab("profile");
            setSuccess("");
          }}
        >
          Hồ sơ
        </button>
        <button
          className={tab === "password" ? "active" : ""}
          onClick={() => {
            setTab("password");
            setSuccess("");
          }}
        >
          Đổi mật khẩu
        </button>
      </div>
      <section className="panel profile-panel">
        {success && (
          <div className="success" role="status">
            {success}
          </div>
        )}
        <SchemaForm
          key={tab}
          operation={
            tab === "profile"
              ? "PATCH /auth/me"
              : "PATCH /auth/me/change-password"
          }
          initial={tab === "profile" ? user : {}}
          onSuccess={() => {
            setSuccess("Cập nhật thành công.");
            void client.invalidateQueries({ queryKey: ["me"] });
          }}
          onCancel={() => {
            setTab("profile");
          }}
        />
      </section>
    </>
  );
}
function Unavailable({ type }: { type: "roles" | "audit" }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">QUẢN TRỊ HỆ THỐNG</div>
          <h1>
            {type === "roles" ? "Vai trò & quyền hạn" : "Nhật ký hoạt động"}
          </h1>
          <p>
            {type === "roles"
              ? "Quyền truy cập gắn với vai trò của từng tài khoản."
              : "Theo dõi các thay đổi quan trọng tại trung tâm."}
          </p>
        </div>
      </div>
      {type === "roles" && (
        <div className="role-grid">
          {[
            ["MANAGER", "Quản lý trung tâm"],
            ["COACH", "Huấn luyện viên"],
            ["MEMBER", "Hội viên"],
            ["STAFF", "Lễ tân"],
          ].map(([key, name]) => (
            <section className="panel role-card" key={key}>
              <ShieldCheck />
              <h3>{name}</h3>
              <code>{key}</code>
            </section>
          ))}
        </div>
      )}
      <section className="panel unavailable">
        <span className="unavailable-icon">
          <ShieldCheck size={30} />
        </span>
        <h2>
          {type === "roles"
            ? "Chưa hỗ trợ tùy chỉnh quyền"
            : "Nhật ký chưa khả dụng"}
        </h2>
        <p>
          {type === "roles"
            ? "Backend hiện cung cấp bốn vai trò cố định. Chưa có API đọc hoặc thay đổi quyền chi tiết cho từng vai trò."
            : "Backend hiện chưa cung cấp API nhật ký hoạt động để hiển thị dữ liệu tại đây."}
        </p>
        <Link
          className="button"
          to={type === "roles" ? "/manager/users" : "/manager/dashboard"}
        >
          {type === "roles" ? "Quản lý tài khoản" : "Về tổng quan"}
          <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
