import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { display } from "./config";

export function StatusBadge({ value }: { value: unknown }) {
  const status = String(value).toUpperCase();
  const tone = [
    "TRUE",
    "ACTIVE",
    "SUCCESS",
    "BOOKED",
    "PRESENT",
    "COMPLETED",
    "PAID",
    "AVAILABLE",
    "APPROVED",
    "RESOLVED",
  ].includes(status)
    ? "success"
    : ["PENDING", "SUSPENDED", "LATE", "LIMITED", "OPEN", "IN_PROGRESS"].includes(status)
      ? "warning"
      : [
            "FALSE",
            "FAILED",
            "CANCELLED",
            "EXPIRED",
            "ABSENT",
            "INACTIVE",
            "UNAVAILABLE",
            "REJECTED",
            "CLOSED",
          ].includes(status)
        ? "danger"
        : ["SCHEDULED", "ISSUED", "PREMIUM", "REFUNDED", "RESERVED"].includes(
              status,
            )
          ? "info"
          : "neutral";

  const Icon = ["APPROVED", "SUCCESS", "COMPLETED", "RESOLVED"].includes(status)
    ? CheckCircle2
    : ["PENDING", "IN_PROGRESS", "OPEN"].includes(status)
      ? Clock
      : ["REJECTED", "FAILED", "CANCELLED", "CLOSED"].includes(status)
        ? XCircle
        : null;

  return (
    <span
      className={`badge badge-${tone}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      <span>{display(value)}</span>
    </span>
  );
}
