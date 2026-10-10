import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { AuthLink as Link } from "./AuthLink";
import { ErrorState } from "../../shared/ui";
import { AuthLayout } from "./AuthLayout";

const Turnstile = lazy(() =>
  import("./Turnstile").then((module) => ({ default: module.Turnstile })),
);

export function Login({
  onLogin,
  busy,
  error,
}: {
  onLogin: (e: string, p: string, turnstileToken: string) => Promise<void>;
  busy: boolean;
  error: unknown;
}) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  useEffect(() => {
    document.title = "Đăng nhập · Pulse Sports Center";
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !captchaToken) return;
    try {
      await onLogin(
        email.trim().toLowerCase(),
        password,
        captchaToken,
      );
    } finally {
      setCaptchaToken("");
      setCaptchaAttempt((value) => value + 1);
    }
  }
  return (
    <AuthLayout>
      <span className="auth-eyebrow">
        <span className="auth-dot" /> CHÀO MỪNG TRỞ LẠI
      </span>
      <h1>Sẵn sàng giữ nhịp?</h1>
      <p className="auth-intro">
        Đăng nhập để xem lịch tập và tiếp tục
        <br />
        những mục tiêu còn đang chờ bạn.
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <div className="auth-floating">
          <input
            id="login-email"
            autoFocus
            type="email"
            placeholder="Email của bạn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            disabled={busy}
          />
          <label htmlFor="login-email">Email</label>
        </div>
        <div className="auth-floating">
          <div className="auth-password">
            <input
              id="login-password"
              type={show ? "text" : "password"}
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={busy}
            />
            <button
              type="button"
              aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={show}
              onClick={() => setShow(!show)}
            >
              {show ? (
                <EyeOff key="hide" size={18} />
              ) : (
                <Eye key="show" size={18} />
              )}
            </button>
          </div>
          <label htmlFor="login-password">Mật khẩu</label>
        </div>
        <div className="auth-label-row">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </div>
        {error != null && <ErrorState error={error} />}
        <Suspense fallback={<p role="status">Đang tải xác minh bảo mật…</p>}>
          <Turnstile key={captchaAttempt} onChange={setCaptchaToken} />
        </Suspense>
        <button
          className="auth-submit"
          disabled={busy || !captchaToken}
        >
          {busy ? (
            <>
              <LoaderCircle size={18} className="auth-spinner" /> Đang đăng
              nhập…
            </>
          ) : (
            <>
              Đăng nhập <ArrowUpRight size={20} />
            </>
          )}
        </button>
      </form>
      <p className="auth-switch">
        Chưa có tài khoản?{" "}
        <Link to="/register">
          Đăng ký hội viên <ArrowUpRight size={14} />
        </Link>
      </p>
      <div className="auth-note">
        <span className="auth-dot" />
        <p>
          Một tài khoản, đúng không gian của bạn.
          <br />
          Dành cho hội viên và đội ngũ Pulse.
        </p>
      </div>
    </AuthLayout>
  );
}
