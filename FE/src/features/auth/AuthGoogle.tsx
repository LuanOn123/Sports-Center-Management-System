import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useRef, useState } from "react";

export function AuthGoogle({
  mode,
  busy,
  onCredential,
}: {
  mode: "login" | "register";
  busy: boolean;
  onCredential: (credential: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const resize = () =>
      setWidth(Math.min(400, Math.floor(element.clientWidth)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="auth-oauth">
      <div ref={row} className="auth-google-btn-row" inert={busy}>
        {width > 0 && (
          <GoogleLogin
            onSuccess={({ credential }) => {
              setFailed(!credential);
              if (credential && !busy) onCredential(credential);
            }}
            onError={() => setFailed(true)}
            theme="filled_black"
            size="large"
            shape="rectangular"
            logo_alignment="left"
            text={mode === "login" ? "signin_with" : "signup_with"}
            width={String(width)}
          />
        )}
      </div>
      {failed && (
        <p className="p-form-error" role="alert">
          Xác thực Google chưa thành công. Vui lòng thử lại.
        </p>
      )}
      <div className="auth-oauth-divider">Hoặc dùng email</div>
    </div>
  );
}
