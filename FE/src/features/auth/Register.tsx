import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AuthLink as Link } from "./AuthLink";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { AuthLayout } from "./AuthLayout";
import { api, ApiError, authService } from "../../shared/api";
import type { PostAuthRegisterRequest } from "../../shared/generated";

interface GoogleProfile {
  credential: string;
  email: string;
  fullName: string;
  picture?: string;
}

function parseGoogleCredential(credential: string): {
  email: string;
  name?: string;
  picture?: string;
} | null {
  try {
    const base64Url = credential.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function Register({
  onGoogleRegisterSuccess,
}: {
  onGoogleRegisterSuccess?: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  // State cho luồng đăng ký bằng Google
  const [googleUser, setGoogleUser] = useState<GoogleProfile | null>(null);

  useEffect(() => {
    document.title = "Đăng ký hội viên · Pulse Sports Center";
    window.scrollTo(0, 0);
  }, []);

  const handleGoogleSuccess = (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    setError("");
    const payload = parseGoogleCredential(credentialResponse.credential);
    if (!payload || !payload.email) {
      setError("Không thể đọc thông tin từ tài khoản Google. Vui lòng thử lại.");
      return;
    }

    setGoogleUser({
      credential: credentialResponse.credential,
      email: payload.email,
      fullName: payload.name || payload.email.split("@")[0],
      picture: payload.picture,
    });
  };

  // Submit đăng ký thông thường
  async function submitNormal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const password = String(form.get("password") || "");
    const next: Record<string, string> = {};

    if (!fullName) next.fullName = "Vui lòng nhập họ và tên.";
    if (!phone) next.phone = "Vui lòng nhập số điện thoại.";
    else if (!/^[0-9+]{9,15}$/.test(phone))
      next.phone = "Số điện thoại phải gồm 9-15 chữ số.";
    if (password.length < 6) next.password = "Mật khẩu cần ít nhất 6 ký tự.";
    if (password !== form.get("confirmPassword"))
      next.confirmPassword = "Mật khẩu xác nhận chưa khớp.";

    setFields(next);
    setError("");
    if (Object.keys(next).length) return;

    const gender = String(form.get("gender") || "") as "MALE" | "FEMALE" | "OTHER" | "";
    const dateOfBirth = String(form.get("dateOfBirth") || "").trim();
    const fitnessGoal = String(form.get("fitnessGoal") || "").trim();

    const body: PostAuthRegisterRequest = {
      fullName,
      email: String(form.get("email") || "").trim(),
      password,
      phone,
      ...(gender ? { gender } : {}),
      ...(dateOfBirth ? { dateOfBirth } : {}),
      ...(fitnessGoal ? { fitnessGoal } : {}),
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

  // Submit đăng ký với Google (sau khi điền thông tin bổ sung)
  async function submitGoogleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!googleUser || submitting.current) return;
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") || "").trim();
    const next: Record<string, string> = {};

    if (!phone) {
      next.phone = "Vui lòng nhập số điện thoại.";
      setFields(next);
      setError("Vui lòng nhập số điện thoại.");
      return;
    } else if (!/^[0-9+]{9,15}$/.test(phone)) {
      next.phone = "Số điện thoại phải gồm 9-15 chữ số.";
      setFields(next);
      setError("Số điện thoại phải gồm 9-15 chữ số.");
      return;
    }

    const gender = String(form.get("gender") || "") as "MALE" | "FEMALE" | "OTHER" | "";
    const dateOfBirth = String(form.get("dateOfBirth") || "").trim();
    const fitnessGoal = String(form.get("fitnessGoal") || "").trim();

    submitting.current = true;
    setBusy(true);
    setError("");
    setFields({});
    try {
      await authService.googleRegister({
        credential: googleUser.credential,
        phone,
        ...(gender ? { gender } : {}),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(fitnessGoal ? { fitnessGoal } : {}),
      });

      if (onGoogleRegisterSuccess) {
        await onGoogleRegisterSuccess();
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Đăng ký bằng Google chưa thành công. Vui lòng thử lại.",
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
      ) : googleUser ? (
        /* MÀN HÌNH HOÀN TẤT ĐĂNG KÝ VỚI GOOGLE */
        <>
          <span className="p-register-badge">
            <UserCheck size={20} />
          </span>
          <div className="auth-eyebrow">GOOGLE REGISTRATION</div>
          <h1>Hoàn tất thông tin.</h1>
          <p className="auth-intro">
            Tài khoản Google đã liên kết. Hãy điền thêm số điện thoại và
            mục tiêu luyện tập của bạn để bắt đầu.
          </p>

          <div className="auth-google-preview">
            {googleUser.picture ? (
              <img src={googleUser.picture} alt={googleUser.fullName} />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#263143",
                  display: "grid",
                  placeItems: "center",
                  color: "#d4ff00",
                  fontWeight: 700,
                }}
              >
                {googleUser.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="auth-google-preview-info">
              <h4>{googleUser.fullName}</h4>
              <p>{googleUser.email}</p>
            </div>
          </div>

          <form onSubmit={submitGoogleRegister} aria-busy={busy}>
            <fieldset disabled={busy}>
              <div className="auth-floating">
                <input
                  id="google-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="090 123 4567"
                  required
                  aria-invalid={!!fields.phone}
                  aria-describedby={fields.phone ? "google-phone-error" : undefined}
                />
                <label htmlFor="google-phone">
                  Số điện thoại <span>*</span>
                </label>
              </div>
              {fields.phone && (
                <small className="p-field-error" id="google-phone-error">
                  {fields.phone}
                </small>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <label htmlFor="google-gender" style={{ marginTop: 0, marginBottom: 8 }}>
                    Giới tính
                  </label>
                  <select id="google-gender" name="gender" className="auth-select" defaultValue="MALE">
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="google-dob" style={{ marginTop: 0, marginBottom: 8 }}>
                    Ngày sinh
                  </label>
                  <input id="google-dob" name="dateOfBirth" type="date" />
                </div>
              </div>

              {/* Nhập fitnessGoal hiển thị "Mục tiêu của bạn" */}
              <div className="auth-floating" style={{ marginTop: 16 }}>
                <input
                  id="google-fitnessGoal"
                  name="fitnessGoal"
                  type="text"
                  placeholder="Ví dụ: Giảm mỡ, tăng cơ, cải thiện sức bền..."
                  aria-invalid={!!fields.fitnessGoal}
                  aria-describedby={fields.fitnessGoal ? "google-goal-error" : undefined}
                />
                <label htmlFor="google-fitnessGoal">
                  Mục tiêu của bạn <small>(tập luyện & thể lực)</small>
                </label>
              </div>
              {fields.fitnessGoal && (
                <small className="p-field-error" id="google-goal-error">
                  {fields.fitnessGoal}
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
                  <LoaderCircle className="auth-spinner" size={18} /> Đang hoàn tất…
                </>
              ) : (
                <>
                  Hoàn tất đăng ký & Bắt đầu <ArrowUpRight size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              className="auth-cancel-btn"
              disabled={busy}
              onClick={() => {
                setGoogleUser(null);
                setError("");
                setFields({});
              }}
            >
              <ArrowLeft size={14} /> Chọn phương thức hoặc tài khoản khác
            </button>
          </form>
        </>
      ) : (
        /* MÀN HÌNH ĐĂNG KÝ BAN ĐẦU (ĐIỀN FORM VÀ ĐĂNG KÝ GOOGLE Ở DƯỚI) */
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

          <form onSubmit={submitNormal} aria-busy={busy}>
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
                  required
                  aria-invalid={!!fields.phone}
                  aria-describedby={fields.phone ? "phone-error" : undefined}
                />
                <label htmlFor="phone">
                  Số điện thoại <span>*</span>
                </label>
              </div>
              {fields.phone && (
                <small className="p-field-error" id="phone-error">
                  {fields.phone}
                </small>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <label htmlFor="gender" style={{ marginTop: 0, marginBottom: 8 }}>
                    Giới tính
                  </label>
                  <select id="gender" name="gender" className="auth-select" defaultValue="MALE">
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="dateOfBirth" style={{ marginTop: 0, marginBottom: 8 }}>
                    Ngày sinh
                  </label>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" />
                </div>
              </div>

              {/* Nhập fitnessGoal hiển thị "Mục tiêu của bạn" */}
              <div className="auth-floating" style={{ marginTop: 16 }}>
                <input
                  id="fitnessGoal"
                  name="fitnessGoal"
                  type="text"
                  placeholder="Ví dụ: Giảm cân, tăng cơ, cải thiện vóc dáng..."
                  aria-invalid={!!fields.fitnessGoal}
                  aria-describedby={fields.fitnessGoal ? "goal-error" : undefined}
                />
                <label htmlFor="fitnessGoal">
                  Mục tiêu của bạn <small>(tập luyện & thể lực)</small>
                </label>
              </div>
              {fields.fitnessGoal && (
                <small className="p-field-error" id="goal-error">
                  {fields.fitnessGoal}
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

          {/* Đăng ký bằng Google đặt ở DƯỚI button Tạo tài khoản miễn phí */}
          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <div className="auth-oauth-divider">HOẶC ĐĂNG KÝ NHANH VỚI</div>
            <div className="auth-google-btn-row">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Đăng ký Google không thành công. Vui lòng thử lại.")}
                theme="outline"
                size="large"
                shape="pill"
                text="signup_with"
                width="360"
              />
            </div>
          </div>
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
