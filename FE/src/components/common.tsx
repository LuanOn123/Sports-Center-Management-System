import React from "react";
import { Modal as SharedModal } from "../shared/ui";
import { Loading, type SkeletonVariant } from "../shared/feedback";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

export interface BadgeProps {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary";
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  const styles: Record<string, { bg: string; color: string; border: string }> =
    {
      success: {
        bg: "var(--member-success-soft, #edfcf2)",
        color: "var(--member-success, #267346)",
        border: "var(--member-success-border, #abefc6)",
      },
      warning: {
        bg: "var(--member-warning-soft, #fffaeb)",
        color: "var(--member-warning, #b54708)",
        border: "var(--member-warning-border, #fedf89)",
      },
      danger: {
        bg: "var(--member-danger-soft, #fef3f2)",
        color: "var(--member-danger, #d92d20)",
        border: "var(--member-danger-border, #fecdca)",
      },
      info: {
        bg: "var(--member-info-soft, #f0f9ff)",
        color: "var(--member-info, #026aa2)",
        border: "var(--member-info-border, #b9e6fe)",
      },
      primary: {
        bg: "var(--member-accent-soft, #f3fbe8)",
        color: "var(--member-text, #203d31)",
        border: "var(--member-accent-border, #cbe58b)",
      },
      neutral: {
        bg: "var(--member-surface-alt, #f8f9fa)",
        color: "var(--member-muted, #475467)",
        border: "var(--member-border, #eaecf0)",
      },
    };

  const current = styles[variant] || styles.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: current.bg,
        color: current.color,
        border: `1px solid ${current.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
    case "BOOKED":
    case "SUCCESS":
    case "COMPLETED":
      return <Badge variant="success">{status}</Badge>;
    case "EXPIRING_SOON":
    case "PENDING":
    case "SCHEDULED":
      return <Badge variant="warning">{status}</Badge>;
    case "EXPIRED":
    case "CANCELLED":
    case "FAILED":
      return <Badge variant="danger">{status}</Badge>;
    case "PREMIUM":
      return <Badge variant="primary">★ PREMIUM</Badge>;
    case "REGULAR":
    case "MEMBERSHIP":
      return <Badge variant="info">{status}</Badge>;
    default:
      return <Badge variant="neutral">{status || "UNKNOWN"}</Badge>;
  }
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
  dismissible?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 500,
  dismissible = true,
}: ModalProps) {
  if (!isOpen) return null;
  return (
    <SharedModal
      title={title}
      onClose={onClose}
      maxWidth={maxWidth}
      dismissible={dismissible}
    >
      <div className="member-modal-body">{children}</div>
    </SharedModal>
  );
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  isDanger = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={440}
      dismissible={!loading}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p
          style={{
            margin: 0,
            color: "var(--member-muted, #475467)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 8,
          }}
        >
          <button
            className="member-button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "1px solid var(--member-border, #d0d5dd)",
              background: "var(--member-surface, #ffffff)",
              color: "var(--member-text, #344054)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelText}
          </button>
          <button
            className="member-button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              background: isDanger
                ? "var(--member-danger-soft, #d92d20)"
                : "var(--member-accent, #203d31)",
              color: isDanger
                ? "var(--member-danger, #ffffff)"
                : "var(--member-ink, #ffffff)",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Đang xử lý..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--member-surface, #ffffff)",
        borderRadius: 14,
        border: "1px dashed var(--member-border, #d0d7d3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <div style={{ color: "var(--member-muted, #9aa6a0)", marginBottom: 4 }}>
        {icon || <Info size={36} />}
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: "var(--member-text, #203d31)",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: 0,
            color: "var(--member-muted, #667085)",
            fontSize: 13,
            maxWidth: 360,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function LoadingSpinner({
  text = "Đang tải dữ liệu…",
  variant = "cards",
}: {
  text?: string;
  variant?: SkeletonVariant;
}) {
  return <Loading text={text} variant={variant} />;
}

export function AlertBanner({
  type = "info",
  title,
  message,
}: {
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
}) {
  const config = {
    info: {
      bg: "var(--member-info-soft, #f0f9ff)",
      border: "var(--member-info-border, #b9e6fe)",
      color: "var(--member-info, #026aa2)",
      icon: <Info size={18} />,
    },
    success: {
      bg: "var(--member-success-soft, #edfcf2)",
      border: "var(--member-success-border, #abefc6)",
      color: "var(--member-success, #267346)",
      icon: <CheckCircle2 size={18} />,
    },
    warning: {
      bg: "var(--member-warning-soft, #fffaeb)",
      border: "var(--member-warning-border, #fedf89)",
      color: "var(--member-warning, #b54708)",
      icon: <AlertCircle size={18} />,
    },
    error: {
      bg: "var(--member-danger-soft, #fef3f2)",
      border: "var(--member-danger-border, #fecdca)",
      color: "var(--member-danger, #d92d20)",
      icon: <XCircle size={18} />,
    },
  }[type];

  return (
    <div
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        padding: "12px 16px",
        borderRadius: 10,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontSize: 13,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}>{config.icon}</div>
      <div>
        {title && (
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>
        )}
        <div>{message}</div>
      </div>
    </div>
  );
}
