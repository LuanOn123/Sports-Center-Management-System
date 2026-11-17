import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { ApiError, authService } from "../../shared/api";
import { ErrorState } from "../../shared/ui";
import { AuthLayout } from "./AuthLayout";
import {
  apiFieldErrors,
  emailError,
  fieldErrorProps,
  focusFirstError,
  type AuthFieldErrors,
} from "./authFields";

export function ForgotPassword({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [fields, setFields] = useState<AuthFieldErrors>({});
  const submitting = useRef(false);
  const otpInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.title = "Quên mật khẩu · Pulse Sports Center";
  }, []);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  useEffect(() => {
    if (sent) otpInput.current?.focus();
  }, [sent]);

  async function sendOtp() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    setFields({});
    try {
      const normalized = email.trim().toLowerCase();
      await authService.forgotPassword(normalized);
      setEmail(normalized);
      setOtp("");
      setExpiresAt(Date.now() + 5 * 60 * 1000);
      setSent(true);
      otpInput.current?.focus();
    } catch (e) {
      const invalid = apiFieldErrors(e);
      if (!sent && invalid.email) setFields(invalid);
      else setError(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(undefined);
    const form = event.currentTarget;
    const next: AuthFieldErrors = sent
      ? {
          otp: !/^\d{6}$/.test(otp)
            ? "Vui lòng nhập mã OTP gồm 6 chữ số."
            : undefined,
          password:
            password.length < 6 ? "Mật khẩu cần ít nhất 6 ký tự." : undefined,
          confirm: !confirm
            ? "Vui lòng nhập lại mật khẩu."
            : password !== confirm
              ? "Mật khẩu xác nhận chưa khớp."
              : undefined,
        }
      : {
          email: emailError(
            email,
            form.elements.namedItem("email") as HTMLInputElement,
          ),
        };
    setFields(next);
    if (Object.values(next).some(Boolean)) {
      focusFirstError(form, next);
      return;
    }
    if (!sent) return sendOtp();
    submitting.current = true;
    setBusy(true);
    try {
      await authService.resetPassword({ email, otp, newPassword: password });
      await onComplete();
    } catch (e) {
      const invalid = apiFieldErrors(e);
      const otpError =
        invalid.otp ||
        (e instanceof ApiError && e.status === 400 && /OTP/i.test(e.message)
          ? e.message
          : undefined);
      if (otpError || invalid.newPassword)
        setFields({ otp: otpError, password: invalid.newPassword });
      else setError(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout recovery>
      <KeyRound className="auth-recovery-icon" size={25} aria-hidden="true" />
      <h1>{sent ? "Đặt lại mật khẩu" : "Quên mật khẩu?"}</h1>
      <p className="auth-intro">
        {sent
          ? `Nếu ${email} đã đăng ký, mã OTP sẽ được gửi đến email này. Hãy kiểm tra cả thư rác.`
          : "Nhập email tài khoản để nhận mã OTP đặt lại mật khẩu."}
      </p>
      <form
        onSubmit={submit}
        onChange={(event) => {
          if (event.target instanceof HTMLInputElement) {
            const name = event.target.name;
            setFields((current) => ({ ...current, [name]: undefined }));
          }
        }}
        noValidate
        aria-busy={busy}
      >
        {!sent ? (
          <>
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              {...fieldErrorProps(fields.email, "reset-email-error")}
            />
            {fields.email && (
              <small className="p-field-error" id="reset-email-error">
                {fields.email}
              </small>
            )}
          </>
        ) : (
          <>
            <label htmlFor="reset-otp">Mã OTP</label>
            <input
              id="reset-otp"
              name="otp"
              className="auth-otp"
              ref={otpInput}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={otp}
              disabled={busy}
              {...fieldErrorProps(fields.otp, "reset-otp-error")}
              aria-describedby={
                fields.otp ? "reset-otp-error otp-help" : "otp-help"
              }
              onChange={(e) => setOtp(e.target.value)}
            />
            {fields.otp && (
              <small className="p-field-error" id="reset-otp-error">
                {fields.otp}
              </small>
            )}
            <p className="p-field-hint" id="otp-help">
              Mã gồm 6 chữ số và dùng một lần.
            </p>
            <p
              className="auth-otp-timer"
              role="timer"
              aria-label="Thời gian còn lại của OTP"
              data-expired={remaining === 0}
            >
              <Clock3 size={16} aria-hidden="true" />
              {remaining > 0
                ? `Mã OTP còn khoảng ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                : "Mã OTP đã hết hạn. Vui lòng gửi lại OTP."}
            </p>
            <label htmlFor="reset-password">Mật khẩu mới</label>
            <input
              id="reset-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
              placeholder="Ít nhất 6 ký tự"
              value={password}
              disabled={busy}
              {...fieldErrorProps(fields.password, "reset-password-error")}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fields.password && (
              <small className="p-field-error" id="reset-password-error">
                {fields.password}
              </small>
            )}
            <label htmlFor="reset-confirm">Xác nhận mật khẩu mới</label>
            <input
              id="reset-confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              disabled={busy}
              {...fieldErrorProps(fields.confirm, "reset-confirm-error")}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {fields.confirm && (
              <small className="p-field-error" id="reset-confirm-error">
                {fields.confirm}
              </small>
            )}
          </>
        )}
        {error != null && <ErrorState error={error} />}
        <button className="auth-submit" disabled={busy}>
          {busy ? "Đang xử lý…" : sent ? "Đặt lại mật khẩu" : "Gửi mã OTP"}
          {busy ? (
            <LoaderCircle
              className="auth-spinner"
              size={18}
              aria-hidden="true"
            />
          ) : (
            <ArrowUpRight size={18} aria-hidden="true" />
          )}
        </button>
        {sent && (
          <div className="auth-recovery-actions">
            <button
              type="button"
              className="auth-cancel-btn"
              disabled={busy}
              onClick={() => void sendOtp()}
            >
              Gửi lại OTP
            </button>
            <button
              type="button"
              className="auth-cancel-btn"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setExpiresAt(0);
                setOtp("");
                setPassword("");
                setConfirm("");
                setError(undefined);
                setFields({});
              }}
            >
              Đổi email
            </button>
          </div>
        )}
      </form>
      <p className="auth-switch">
        <Link to="/login">
          <ArrowLeft size={15} aria-hidden="true" /> Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
