import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AuthLink as Link } from "./AuthLink";
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { api, ApiError } from "../../shared/api";
import type { PostAuthRegisterRequest } from "../../shared/generated";

export function Register() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    document.title = "Đăng ký hội viên · Pulse Sports Center";
    window.scrollTo(0, 0);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const password = String(form.get("password") || "");
    const next: Record<string, string> = {};
    if (!fullName) next.fullName = "Vui lòng nhập họ và tên.";
    if (password.length < 6) next.password = "Mật khẩu cần ít nhất 6 ký tự.";
    if (password !== form.get("confirmPassword"))
      next.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
    setFields(next);
    setError("");
    if (Object.keys(next).length) return;
    const phone = String(form.get("phone") || "").trim();
    const body: PostAuthRegisterRequest = {
      fullName,
      email: String(form.get("email") || "").trim(),
      password,
      ...(phone ? { phone } : {}),
    };
    submitting.current = true;
    setBusy(true);
    try {
      await api("POST /auth/register", { body });
      setSuccess(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Đăng ký chưa thành công. Vui lòng thử lại.",
      );
      if (e instanceof ApiError)
        setFields(
          Object.fromEntries(
            (e.errors || []).map((item) => [item.field, item.message]),
          ),
        );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout registration>
      {success ? (
        <div className="p-register-success" role="status">
          <CheckCircle2 size={56} />
          <div className="auth-eyebrow">WELCOME TO PULSE</div>
          <h1>Bạn đã sẵn sàng!</h1>
          <p>
            Tài khoản hội viên đã được tạo thành công. Đăng nhập để khám phá lớp
            học và bắt đầu hành trình của bạn.
          </p>
          <Link className="auth-submit" to="/login">
            Đăng nhập ngay <ArrowUpRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          <span className="p-register-badge">
            <ShieldCheck size={20} />
          </span>
          <div className="auth-eyebrow">JOIN THE MOVEMENT</div>
          <h1>Bắt đầu cùng Pulse.</h1>
          <p className="auth-intro">
            Một vài thông tin. Một khởi đầu mới.
            <br />
            Tìm lớp tập và nhịp sống phù hợp với bạn.
          </p>
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={busy}>
              <div className="auth-floating">
                <input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Nguyễn Minh Anh"
                  required
                  aria-invalid={!!fields.fullName}
                  aria-describedby={
                    fields.fullName ? "fullName-error" : undefined
                  }
                />
                <label htmlFor="fullName">
                  Họ và tên <span>*</span>
                </label>
              </div>
              {fields.fullName && (
                <small className="p-field-error" id="fullName-error">
                  {fields.fullName}
                </small>
              )}
              <div className="auth-floating">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ban@email.com"
                  required
                  aria-invalid={!!fields.email}
                  aria-describedby={fields.email ? "email-error" : undefined}
                />
                <label htmlFor="email">
                  Email <span>*</span>
                </label>
              </div>
              {fields.email && (
                <small className="p-field-error" id="email-error">
                  {fields.email}
                </small>
              )}
              <div className="auth-floating">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="090 123 4567"
                  aria-invalid={!!fields.phone}
                  aria-describedby={fields.phone ? "phone-error" : undefined}
                />
                <label htmlFor="phone">
                  Số điện thoại <small>(không bắt buộc)</small>
                </label>
              </div>
              {fields.phone && (
                <small className="p-field-error" id="phone-error">
                  {fields.phone}
                </small>
              )}
              <div className="auth-floating">
                <div className="auth-password">
                  <input
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Ít nhất 6 ký tự"
                    required
                    aria-invalid={!!fields.password}
                    aria-describedby="password-hint"
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
                <label htmlFor="password">
                  Mật khẩu <span>*</span>
                </label>
              </div>
              <small
                id="password-hint"
                className={fields.password ? "p-field-error" : "p-field-hint"}
              >
                {fields.password ||
                  "Dùng ít nhất 6 ký tự để bảo vệ tài khoản của bạn."}
              </small>
              <div className="auth-floating">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={show ? "text" : "password"}
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  required
                  aria-invalid={!!fields.confirmPassword}
                  aria-describedby={
                    fields.confirmPassword ? "confirm-error" : undefined
                  }
                />
                <label htmlFor="confirmPassword">
                  Xác nhận mật khẩu <span>*</span>
                </label>
              </div>
              {fields.confirmPassword && (
                <small className="p-field-error" id="confirm-error">
                  {fields.confirmPassword}
                </small>
              )}
            </fieldset>
            {error && (
              <div className="p-form-error" role="alert">
                {error}
              </div>
            )}
            <button className="auth-submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="auth-spinner" size={18} /> Đang tạo
                  tài khoản…
                </>
              ) : (
                <>
                  Tạo tài khoản miễn phí <ArrowUpRight size={18} />
                </>
              )}
            </button>
            <p className="p-register-disclaimer">
              <ShieldCheck size={15} /> Không cần thẻ thanh toán. Bạn có thể
              chọn gói tập sau.
            </p>
          </form>
        </>
      )}
      {!success && (
        <p className="auth-switch">
          Đã có tài khoản?{" "}
          <Link to="/login">
            Đăng nhập <ArrowUpRight size={14} />
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
