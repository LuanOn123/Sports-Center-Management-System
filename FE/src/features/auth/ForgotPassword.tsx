import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Brand } from "../../shared/Brand";
import { authService } from "../../shared/api";
import { ErrorState } from "../../shared/ui";

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
    try {
      const normalized = email.trim().toLowerCase();
      await authService.forgotPassword(normalized);
      setEmail(normalized);
      setOtp("");
      setExpiresAt(Date.now() + 5 * 60 * 1000);
      setSent(true);
      otpInput.current?.focus();
    } catch (e) {
      setError(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!sent) return sendOtp();
    setError(undefined);
    if (password !== confirm) {
      setError(new Error("Mật khẩu xác nhận chưa khớp."));
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await authService.resetPassword({ email, otp, newPassword: password });
      await onComplete();
    } catch (e) {
      setError(e);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Link to="/" aria-label="Về trang chủ">
          <Brand />
        </Link>
        <div className="login-story-copy">
          <h1>
            Trở lại.
            <br />
            <em>Tiếp nhịp đam mê.</em>
          </h1>
          <p>Khôi phục mật khẩu để tiếp tục hành trình tập luyện của bạn.</p>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <span className="login-icon">
            <KeyRound size={26} />
          </span>
          <h2>{sent ? "Đặt lại mật khẩu" : "Quên mật khẩu?"}</h2>
          <p>
            {sent
              ? `Nếu email ${email} tồn tại trong hệ thống, mã OTP đã được gửi. Vui lòng kiểm tra hộp thư và thư rác.`
              : "Nhập email tài khoản để nhận mã OTP đặt lại mật khẩu."}
          </p>
          <form onSubmit={submit} aria-busy={busy}>
            {!sent ? (
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ) : (
              <>
                <label>
                  Mã OTP
                  <input
                    ref={otpInput}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    value={otp}
                    disabled={busy}
                    aria-describedby="otp-help"
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </label>
                <p id="otp-help">
                  Nhập mã gồm 6 chữ số. Mã chỉ dùng được một lần.
                </p>
                <p role="timer" aria-label="Thời gian còn lại của OTP">
                  {remaining > 0
                    ? `Mã OTP còn khoảng ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                    : "Mã OTP đã hết hạn. Vui lòng gửi lại OTP."}
                </p>
                <label>
                  Mật khẩu mới
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    placeholder="Ít nhất 6 ký tự"
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Xác nhận mật khẩu mới
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    value={confirm}
                    disabled={busy}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              </>
            )}
            {error != null && <ErrorState error={error} />}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? "Đang xử lý…" : sent ? "Đặt lại mật khẩu" : "Gửi mã OTP"}
            </button>
            {sent && (
              <>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void sendOtp()}
                >
                  Gửi lại OTP
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setSent(false);
                    setExpiresAt(0);
                    setOtp("");
                    setPassword("");
                    setConfirm("");
                    setError(undefined);
                  }}
                >
                  Đổi email
                </button>
              </>
            )}
          </form>
          <p>
            <Link to="/login">← Quay lại đăng nhập</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
