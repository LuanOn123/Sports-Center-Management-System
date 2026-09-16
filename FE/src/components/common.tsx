import React from "react";
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export interface BadgeProps {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary";
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: "#edfcf2", color: "#12b76a", border: "#abefc6" },
    warning: { bg: "#fffaeb", color: "#b54708", border: "#fedf89" },
    danger: { bg: "#fef3f2", color: "#d92d20", border: "#fecdca" },
    info: { bg: "#f0f9ff", color: "#026aa2", border: "#b9e6fe" },
    primary: { bg: "#f3fbe8", color: "#203d31", border: "#cbe58b" },
    neutral: { bg: "#f8f9fa", color: "#475467", border: "#eaecf0" },
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
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 500 }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(18, 30, 25, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          border: "1px solid #e7ece9",
          animation: "modalFadeIn 0.15s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f0f4f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#203d31" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#7b8982",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
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
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={440}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, color: "#475467", fontSize: 14, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "1px solid #d0d5dd",
              background: "#ffffff",
              color: "#344054",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              background: isDanger ? "#d92d20" : "#203d31",
              color: "#ffffff",
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
        background: "#ffffff",
        borderRadius: 14,
        border: "1px dashed #d0d7d3",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <div style={{ color: "#9aa6a0", marginBottom: 4 }}>
        {icon || <Info size={36} />}
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#203d31" }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: 0, color: "#667085", fontSize: 13, maxWidth: 360 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function LoadingSpinner({ text = "Đang tải dữ liệu..." }: { text?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #e7ece9",
          borderTopColor: "#203d31",
          borderRadius: "50%",
          animation: "spin 0.75s linear infinite",
        }}
      />
      <span style={{ fontSize: 13, color: "#7b8982" }}>{text}</span>
    </div>
  );
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
    info: { bg: "#f0f9ff", border: "#b9e6fe", color: "#026aa2", icon: <Info size={18} /> },
    success: { bg: "#edfcf2", border: "#abefc6", color: "#12b76a", icon: <CheckCircle2 size={18} /> },
    warning: { bg: "#fffaeb", border: "#fedf89", color: "#b54708", icon: <AlertCircle size={18} /> },
    error: { bg: "#fef3f2", border: "#fecdca", color: "#d92d20", icon: <XCircle size={18} /> },
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
        {title && <div style={{ fontWeight: 700, marginBottom: 2 }}>{title}</div>}
        <div>{message}</div>
      </div>
    </div>
  );
}
