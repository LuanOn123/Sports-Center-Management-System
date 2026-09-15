import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Dumbbell,
  Eye,
  EyeOff,
  ShieldCheck,
  Trophy,
  Volleyball,
  HeartPulse,
} from "lucide-react";
import { ErrorState } from "../../shared/ui";
import { Brand } from "../../shared/Brand";
export function Login({
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
  useEffect(() => {
    document.title = "Đăng nhập · Pulse Sports Center";
  }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    void onLogin(email.trim(), password);
  }
  return (
    <main className="login-layout">
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
            Sports Center
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
                placeholder="Email của bạn"
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
              Sử dụng tài khoản được cấp bởi trung tâm.
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
    </main>
  );
}
