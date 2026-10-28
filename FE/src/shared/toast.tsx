import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import "./toast.css";

type Kind = "success" | "error" | "info";
type Notice = { id: number; kind: Kind; message: string; key: string };
let notices: Notice[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
function dismiss(id: number) {
  notices = notices.filter((notice) => notice.id !== id);
  emit();
}
export function toast(kind: Kind, message: string, key = `${kind}:${message}`) {
  if (notices.some((notice) => notice.key === key)) return;
  const id = ++sequence;
  notices = [...notices.slice(-3), { id, kind, message, key }];
  emit();
  globalThis.setTimeout(() => dismiss(id), kind === "error" ? 9000 : 5000);
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => notices;
export function ToastViewport() {
  const items = useSyncExternalStore(subscribe, snapshot);
  const [host, setHost] = useState<Element>(document.body);
  useEffect(() => {
    const update = () => {
      const dialogs = document.querySelectorAll("dialog[open]");
      setHost(dialogs[dialogs.length - 1] ?? document.body);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    update();
    return () => observer.disconnect();
  }, []);
  return createPortal(
    <section className="toast-viewport" aria-label="Thông báo thao tác">
      {items.map(({ id, kind, message }) => (
        <div
          key={id}
          className={`toast-notice toast-${kind}`}
          role={kind === "error" ? "alert" : "status"}
        >
          {kind === "success" ? (
            <CheckCircle2 size={22} />
          ) : kind === "error" ? (
            <CircleAlert size={22} />
          ) : (
            <Info size={22} />
          )}
          <div>
            <strong>
              {kind === "success"
                ? "Thành công"
                : kind === "error"
                  ? "Có lỗi xảy ra"
                  : "Thông báo"}
            </strong>
            <p>{message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(id)}
            aria-label="Đóng thông báo"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </section>,
    host,
  );
}
