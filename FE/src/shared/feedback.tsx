import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "./api";
import { label } from "./config";
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>Chưa thể hoàn tất yêu cầu</strong>
        <p>{error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định."}</p>
        {error instanceof ApiError &&
          error.errors?.map((e, i) => (
            <p key={i}>
              {label(e.field)}: {e.message}
            </p>
          ))}
        {retry && (
          <button className="button small" onClick={retry}>
            <RefreshCw size={13} />
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
export type SkeletonVariant =
  "page" | "table" | "details" | "cards" | "chart" | "field";
export function Loading({
  variant = "table",
  text = "Đang tải dữ liệu…",
}: {
  variant?: SkeletonVariant;
  text?: string;
}) {
  return (
    <div
      className={`skeleton skeleton-${variant}`}
      role="status"
      aria-label={text}
    >
      <span className="sr-only">{text}</span>
      <div aria-hidden="true" className="skeleton-content">
        {Array.from(
          { length: variant === "field" ? 1 : variant === "cards" ? 3 : 5 },
          (_, i) => (
            <div className="skeleton-row" key={i}>
              <span className="skeleton-block" />
              <span className="skeleton-block" />
              <span className="skeleton-block" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
export function Empty({
  text = "Chưa có dữ liệu",
  detail = "Dữ liệu sẽ xuất hiện tại đây khi trung tâm có hoạt động.",
  icon,
  action,
}: {
  text?: string;
  detail?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>{icon || <Inbox size={24} />}</span>
      <h3>{text}</h3>
      <p>{detail}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
