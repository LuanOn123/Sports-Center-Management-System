import React from "react";
import { StatusBadge as SharedStatusBadge } from "../shared/StatusBadge";
import { Modal as SharedModal } from "../shared/ui";
import { Empty, Loading, type SkeletonVariant } from "../shared/feedback";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

export interface BadgeProps {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary";
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <SharedStatusBadge value={status} />;
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
      <div className="confirmation-body">
        <p>{message}</p>
        <div className="confirmation-actions">
          <button className="button" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button
            className={"button " + (isDanger ? "danger" : "primary")}
            onClick={onConfirm}
            disabled={loading}
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
    <Empty
      text={title}
      detail={description || ""}
      icon={icon}
      action={action}
    />
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
