import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import { AuthLink as Link } from "./AuthLink";
import { ErrorState } from "../../shared/ui";
import { AuthLayout } from "./AuthLayout";
import { AuthGoogle } from "./AuthGoogle";
import {
  apiFieldErrors,
  emailError,
  fieldErrorProps,
  focusFirstError,
  type AuthFieldErrors,
} from "./authFields";
import { ApiError } from "../../shared/api";

const Turnstile = lazy(() =>
  import("./Turnstile").then((module) => ({ default: module.Turnstile })),
);

export function Login({
  onLogin,
  onGoogleLogin,
  busy,
  error,
  passwordReset = false,
}: {
  onLogin: (e: string, p: string, turnstileToken: string) => Promise<void>;
  onGoogleLogin?: (credential: string) => Promise<void>;
  busy: boolean;
  error: unknown;
  passwordReset?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [fields, setFields] = useState<AuthFieldErrors>({});
  const [dismissedError, setDismissedError] = useState<unknown>();
  const visibleError = error === dismissedError ? undefined : error;
  const credentialsError =
    visibleError instanceof ApiError &&
    visibleError.status === 401 &&
    visibleError.message === "Email hoặc mật khẩu không chính xác.";
  const serverFields = apiFieldErrors(visibleError);
  const emailIssue =
    fields.email ||
    serverFields.email ||
    (credentialsError ? visibleError.message : undefined);
  const passwordIssue = fields.password || serverFields.password;

  useEffect(() => {
    document.title = "Đăng nhập · Pulse Sports Center";
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !captchaToken) return;
    const next = {
      email: emailError(
        email,
        e.currentTarget.elements.namedItem("email") as HTMLInputElement,
      ),
      password: password ? undefined : "Vui lòng nhập mật khẩu.",
    };
    setFields(next);
    if (next.email || next.password) {
      setDismissedError(error);
      focusFirstError(e.currentTarget, next);
      return;
    }
    try {
      await onLogin(email.trim().toLowerCase(), password, captchaToken);
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
        Đăng nhập để xem lịch tập và theo dõi mục tiêu của bạn.
      </p>
      {passwordReset && (
        <p className="auth-success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" /> Mật khẩu đã được đặt lại
          thành công. Vui lòng đăng nhập lại.
        </p>
      )}

      {onGoogleLogin && (
        <AuthGoogle mode="login" busy={busy} onCredential={onGoogleLogin} />
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <div className="auth-floating">
          <input
            id="login-email"
            name="email"
            autoFocus
            type="email"
            placeholder="Email của bạn"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFields((current) => ({ ...current, email: undefined }));
              setDismissedError(error);
            }}
            {...fieldErrorProps(emailIssue, "login-email-error")}
            autoComplete="username"
            required
            disabled={busy}
          />
          <label htmlFor="login-email">Email</label>
        </div>
        {emailIssue && (
          <small className="p-field-error" id="login-email-error">
            {emailIssue}
          </small>
        )}
        <div className="auth-floating">
          <div className="auth-password">
            <input
              id="login-password"
              name="password"
              type={show ? "text" : "password"}
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFields((current) => ({ ...current, password: undefined }));
                setDismissedError(error);
              }}
              {...fieldErrorProps(
                passwordIssue || (credentialsError ? emailIssue : undefined),
                passwordIssue ? "login-password-error" : "login-email-error",
              )}
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
        {passwordIssue && (
          <small className="p-field-error" id="login-password-error">
            {passwordIssue}
          </small>
        )}
        <div className="auth-label-row">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </div>
        {visibleError != null &&
          !credentialsError &&
          !serverFields.email &&
          !serverFields.password && (
            <div>
              <ErrorState error={visibleError} />
              {visibleError instanceof Error &&
                visibleError.message
                  .toLowerCase()
                  .includes("chưa được đăng ký") && (
                  <p style={{ marginTop: 8, fontSize: 13, color: "#d4ff00" }}>
                    Chưa có tài khoản?{" "}
                    <Link
                      to="/register"
                      style={{ textDecoration: "underline", fontWeight: 600 }}
                    >
                      Nhấn vào đây để đăng ký hội viên ngay
                    </Link>
                  </p>
                )}
            </div>
          )}
        <Suspense fallback={<p role="status">Đang tải xác minh bảo mật…</p>}>
          <Turnstile key={captchaAttempt} onChange={setCaptchaToken} />
        </Suspense>
        <button className="auth-submit" disabled={busy || !captchaToken}>
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
    </AuthLayout>
  );
}
