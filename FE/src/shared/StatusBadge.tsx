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
  ].includes(status)
    ? "success"
    : ["PENDING", "SUSPENDED", "LATE", "LIMITED"].includes(status)
      ? "warning"
      : [
            "FALSE",
            "FAILED",
            "CANCELLED",
            "EXPIRED",
            "ABSENT",
            "INACTIVE",
            "UNAVAILABLE",
          ].includes(status)
        ? "danger"
        : ["SCHEDULED", "ISSUED", "PREMIUM", "REFUNDED", "RESERVED"].includes(
              status,
            )
          ? "info"
          : "neutral";
  return <span className={`badge badge-${tone}`}>{display(value)}</span>;
}
