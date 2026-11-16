import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth.api";
import { Activity, Lock, Mail, User as UserIcon, Phone, ArrowRight, Target, ArrowLeft, CheckCircle2 } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { AlertBanner } from "../../components/common";

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

export function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // State luồng đăng ký bằng Google
  const [googleUser, setGoogleUser] = useState<GoogleProfile | null>(null);

  const handleGoogleSuccess = (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    setError(null);
    const payload = parseGoogleCredential(credentialResponse.credential);
    if (!payload || !payload.email) {
      setError("Không thể đọc thông tin từ Google. Vui lòng thử lại.");
      return;
    }

    setGoogleUser({
      credential: credentialResponse.credential,
      email: payload.email,
      fullName: payload.name || payload.email.split("@")[0],
      picture: payload.picture,
    });
  };

  const handleNormalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await authApi.register({
        fullName,
        email,
        password,
        phone: phone.trim(),
        gender,
        dateOfBirth: dateOfBirth || undefined,
        fitnessGoal: fitnessGoal || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng ký không thành công. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!googleUser) return;
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await authApi.registerWithGoogle({
        credential: googleUser.credential,
        phone: phone.trim(),
        gender,
        dateOfBirth: dateOfBirth || undefined,
        fitnessGoal: fitnessGoal || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate("/member/dashboard");
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng ký bằng Google thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f6f8f7 0%, #e8efe9 100%)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#ffffff",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 20px 25px -5px rgba(32, 61, 49, 0.08), 0 8px 10px -6px rgba(32, 61, 49, 0.04)",
          border: "1px solid #e2eae5",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "#203d31",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d3f879",
              marginBottom: 12,
            }}
          >
            <Activity size={26} strokeWidth={2.6} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#203d31", letterSpacing: -0.6, margin: "0 0 6px" }}>
            {googleUser ? "Hoàn tất đăng ký Google" : "Tạo tài khoản Hội viên"}
          </h1>
          <p style={{ margin: 0, color: "#7b8982", fontSize: 13 }}>
            {googleUser
              ? "Bổ sung số điện thoại và mục tiêu tập luyện để kích hoạt tài khoản"
              : "Tham gia cộng đồng thể thao hàng đầu tại Pulse Sports Center"}
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 18 }}>
            <AlertBanner type="error" message={error} />
          </div>
        )}

        {success && (
          <div style={{ marginBottom: 18 }}>
            <AlertBanner
              type="success"
              message={
                googleUser
                  ? "Đăng ký tài khoản thành công! Đang chuyển đến bảng điều khiển..."
                  : "Đăng ký thành công! Đang chuyển về trang đăng nhập..."
              }
            />
          </div>
        )}

        {googleUser ? (
          /* FORM HOÀN TẤT ĐĂNG KÝ GOOGLE */
          <form onSubmit={handleGoogleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "#f3f7f4",
                borderRadius: 12,
                border: "1px solid #dce8e0",
              }}
            >
              {googleUser.picture ? (
                <img
                  src={googleUser.picture}
                  alt={googleUser.fullName}
                  style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "#203d31",
                    color: "#d3f879",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                  }}
                >
                  {googleUser.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#203d31" }}>{googleUser.fullName}</div>
                <div style={{ fontSize: 12, color: "#667085" }}>{googleUser.email}</div>
              </div>
              <CheckCircle2 size={18} color="#2e7d32" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Số điện thoại *
                </label>
                <div style={{ position: "relative" }}>
                  <Phone size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Giới tính
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")}
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                Ngày sinh
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            {/* Nhập fitnessGoal hiển thị "Mục tiêu của bạn" */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                Mục tiêu của bạn
              </label>
              <div style={{ position: "relative" }}>
                <Target size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={fitnessGoal}
                  onChange={(e) => setFitnessGoal(e.target.value)}
                  placeholder="Ví dụ: Giảm mỡ, tăng cơ, cải thiện sức bền..."
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: "13px 20px",
                backgroundColor: "#203d31",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {loading ? "Đang hoàn tất..." : "Hoàn tất đăng ký & Bắt đầu"}
              {!loading && <ArrowRight size={16} />}
            </button>

            <button
              type="button"
              onClick={() => {
                setGoogleUser(null);
                setError(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#667085",
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: 6,
              }}
            >
              <ArrowLeft size={14} /> Quay lại phương thức khác
            </button>
          </form>
        ) : (
          /* FORM ĐĂNG KÝ BÌNH THƯỜNG */
          <>
            <form onSubmit={handleNormalSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Họ và tên *
                </label>
                <div style={{ position: "relative" }}>
                  <UserIcon size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Email *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@domain.com"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Mật khẩu (tối thiểu 6 ký tự) *
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                    Số điện thoại *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912345678"
                      style={{ paddingLeft: 38 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                    Giới tính
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")}
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>

              {/* Nhập fitnessGoal hiển thị "Mục tiêu của bạn" */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Mục tiêu của bạn
                </label>
                <div style={{ position: "relative" }}>
                  <Target size={17} color="#98a2b3" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    value={fitnessGoal}
                    onChange={(e) => setFitnessGoal(e.target.value)}
                    placeholder="Ví dụ: Giảm cân, tăng cơ, cải thiện vóc dáng..."
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 8,
                  padding: "13px 20px",
                  backgroundColor: "#203d31",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            {/* Đăng ký bằng Google đặt ở DƯỚI nút Tạo tài khoản */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: "14px 0",
                  color: "#8c9b92",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e2eae5" }} />
                <span style={{ padding: "0 10px" }}>HOẶC ĐĂNG KÝ NHANH VỚI</span>
                <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e2eae5" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Đăng ký bằng Google không thành công.")}
                  theme="outline"
                  size="large"
                  shape="pill"
                  text="signup_with"
                  width="416"
                />
              </div>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #f0f4f2",
            textAlign: "center",
            fontSize: 13,
            color: "#667085",
          }}
        >
          Đã có tài khoản?{" "}
          <Link
            to="/login"
            style={{ color: "#203d31", fontWeight: 700, textDecoration: "underline" }}
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
