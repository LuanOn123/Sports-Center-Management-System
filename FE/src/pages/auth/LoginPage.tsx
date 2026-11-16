import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Activity, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { AlertBanner } from "../../components/common";
import { Turnstile } from "../../features/auth/Turnstile";

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !captchaToken) return;
    setError(null);
    setLoading(true);

    try {
      const user = await login({ email, password, turnstileToken: captchaToken });
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "MANAGER") {
        navigate("/manager", { replace: true });
      } else {
        navigate("/member/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
      setCaptchaToken(""); setCaptchaAttempt((value) => value + 1);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (loading || !credentialResponse.credential) return;
    setError(null);
    setLoading(true);

    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "MANAGER") {
        navigate("/manager", { replace: true });
      } else {
        navigate("/member/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đăng nhập Google thất bại. Vui lòng thử lại.");
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
          maxWidth: 440,
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
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: "#203d31",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d3f879",
              marginBottom: 12,
            }}
          >
            <Activity size={28} strokeWidth={2.6} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#203d31", letterSpacing: -0.6, margin: "0 0 6px" }}>
            Chào mừng trở lại
          </h1>
          <p style={{ margin: 0, color: "#7b8982", fontSize: 13 }}>
            Đăng nhập để quản lý lịch học, tập luyện và thẻ hội viên
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 18 }}>
            <AlertBanner type="error" message={error} />
            {error.toLowerCase().includes("chưa được đăng ký") && (
              <p style={{ margin: "8px 0 0", fontSize: 13, textAlign: "center" }}>
                Chưa có tài khoản?{" "}
                <Link to="/register" style={{ color: "#203d31", fontWeight: 700, textDecoration: "underline" }}>
                  Đăng ký hội viên ngay
                </Link>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
              Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={17}
                color="#98a2b3"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#344054", margin: 0 }}>
                Mật khẩu
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: "#203d31", fontWeight: 600, textDecoration: "none" }}
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div style={{ position: "relative" }}>
              <Lock
                size={17}
                color="#98a2b3"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingLeft: 38, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#98a2b3",
                  display: "flex",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Turnstile key={captchaAttempt} onChange={setCaptchaToken} theme="light" />
          <button
            type="submit"
            disabled={loading || !captchaToken}
            style={{
              marginTop: 6,
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
              boxShadow: "0 4px 12px rgba(32, 61, 49, 0.18)",
              transition: "background 0.15s, transform 0.15s",
            }}
          >
            {loading ? "Đang xác thực..." : "Đăng nhập ngay"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Nút đăng nhập Google đặt ở DƯỚI button Đăng nhập */}
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
            <span style={{ padding: "0 10px" }}>HOẶC TIẾP TỤC VỚI</span>
            <hr style={{ flex: 1, border: "none", borderTop: "1px solid #e2eae5" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Đăng nhập bằng Google không thành công.")}
              theme="outline"
              size="large"
              shape="pill"
              text="signin_with"
              width="370"
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: "1px solid #f0f4f2",
            textAlign: "center",
            fontSize: 13,
            color: "#667085",
          }}
        >
          Chưa có tài khoản hội viên?{" "}
          <Link
            to="/register"
            style={{ color: "#203d31", fontWeight: 700, textDecoration: "underline" }}
          >
            Đăng ký tham gia
          </Link>
        </div>
      </div>
    </div>
  );
}
