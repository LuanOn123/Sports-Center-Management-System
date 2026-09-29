import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Brand } from "../../shared/Brand";
import "./auth.css";
import { AmbientMotion, usePublicMotion } from "../../shared/PublicMotion";

export function AuthLayout({
  children,
  registration = false,
}: {
  children: ReactNode;
  registration?: boolean;
}) {
  const motionRoot = usePublicMotion<HTMLElement>();
  return (
    <main
      ref={motionRoot}
      className={`pulse-auth${registration ? " pulse-auth-register" : ""}`}
    >
      <section className="auth-story" aria-label="Pulse Sports Center">
        <img
          className="auth-story-photo"
          src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=85"
          alt=""
        />
        <Link to="/" className="auth-brand" aria-label="Pulse — Trang chủ">
          <Brand member />
        </Link>
        <div className="auth-story-copy">
          <span className="auth-eyebrow">YOUR TIME. YOUR PACE.</span>
          <h2>
            {registration ? (
              <>
                Một khởi đầu.
                <br />
                Một nhịp <em>mới.</em>
              </>
            ) : (
              <>
                Giữ một giờ.
                <br />
                Cho chính <em>bạn.</em>
              </>
            )}
          </h2>
          <p>
            Một lớp tập hợp gu. Một cuộc hẹn với bản thân.
            <br />
            Hẹn bạn ở buổi tập tới.
          </p>
        </div>
        <div className="auth-story-footer">
          <span>MOVE AT YOUR PACE.</span>
          <ArrowUpRight size={28} />
        </div>
      </section>
      <section className="auth-content">
        <AmbientMotion />
        <header className="auth-top">
          <Link to="/">
            <ArrowLeft size={16} /> Trang chủ
          </Link>
          <span>PULSE / {registration ? "THAM GIA" : "CHÀO MỪNG"}</span>
        </header>
        <div className="auth-form-wrap">{children}</div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} Pulse Sports Center</span>
          <span>KEEP SHOWING UP.</span>
        </footer>
      </section>
    </main>
  );
}
