import { useEffect, useRef, useState } from "react";
import { turnstileSiteKey } from "../../shared/turnstileConfig";
import "./turnstile.css";

type WidgetOptions = {
  sitekey: string;
  action: string;
  theme: "dark" | "light";
  size: "compact" | "flexible";
  "response-field": boolean;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": (errorCode?: string | number) => void;
  "timeout-callback": () => void;
  "unsupported-callback": () => void;
};
type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (container: HTMLElement, options: WidgetOptions) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;
function loadTurnstile() {
  if (scriptPromise) return scriptPromise;
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    const timeout = window.setTimeout(fail, 15000);
    function fail() {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      script.remove();
      scriptPromise = undefined;
      reject(
        new Error(
          "Không tải được xác minh bảo mật. Kiểm tra kết nối và thử lại.",
        ),
      );
    }
    script.onerror = fail;
    script.onload = () => {
      if (!window.turnstile) {
        fail();
        return;
      }
      // `script.onload` already guarantees the SDK is available. Calling
      // turnstile.ready() with this async/defer loading strategy throws in
      // Cloudflare's SDK, leaving the login form stuck in its loading state.
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      resolve(window.turnstile);
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export function Turnstile({
  onChange,
  theme = "dark",
}: {
  onChange: (token: string) => void;
  theme?: "dark" | "light";
}) {
  const container = useRef<HTMLDivElement>(null);
  const onToken = useRef(onChange);
  onToken.current = onChange;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("Đang tải xác minh bảo mật…");
  const [error, setError] = useState("");
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 380px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 380px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let active = true,
      widget: string | undefined;
    let api: TurnstileApi | undefined;
    onToken.current("");
    setError("");
    setStatus("Đang tải xác minh bảo mật…");
    const invalid = (message: string) => {
      if (!active) return;
      onToken.current("");
      setStatus("");
      setError(message);
    };
    if (!turnstileSiteKey) {
      invalid("Xác minh bảo mật chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
      return () => { active = false; };
    }
    void loadTurnstile()
      .then((loaded) => {
        if (!active || !container.current) return;
        api = loaded;
        setStatus("Vui lòng hoàn tất xác minh bảo mật.");
        widget = api.render(container.current, {
          sitekey: turnstileSiteKey,
          action: "login",
          theme,
          size: compact ? "compact" : "flexible",
          "response-field": false,
          callback: (token) => {
            if (active) {
              onToken.current(token);
              setError("");
              setStatus("Đã xác minh bảo mật.");
            }
          },
          "expired-callback": () =>
            invalid("Xác minh đã hết hạn. Vui lòng xác minh lại."),
          "error-callback": (errorCode) => {
            const code = String(errorCode ?? "");
            const configurationError = /^(110100|110110|110200|400020|400021|400070)$/.test(code);
            invalid(configurationError
              ? `Site Key chưa cho phép địa chỉ website này. Hãy thêm hostname hiện tại vào Cloudflare Turnstile${code ? ` (mã ${code})` : ""}.`
              : `Không thể xác minh bảo mật. Vui lòng thử lại${code ? ` (mã ${code})` : ""}.`);
          },
          "timeout-callback": () =>
            invalid("Xác minh quá thời gian. Vui lòng thử lại."),
          "unsupported-callback": () =>
            invalid(
              "Trình duyệt chưa hỗ trợ xác minh. Vui lòng cập nhật hoặc dùng trình duyệt khác.",
            ),
        });
      })
      .catch(() => invalid("Không tải được xác minh bảo mật. Kiểm tra kết nối và thử lại."));
    return () => {
      active = false;
      if (widget !== undefined) api?.remove(widget);
    };
  }, [attempt, compact, theme]);
  return (
    <div className="login-captcha">
      <div ref={container} role="group" aria-label="Xác minh bảo mật Cloudflare" />
      {status && <p role="status">{status}</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại xác minh
          </button>
        </div>
      )}
    </div>
  );
}
