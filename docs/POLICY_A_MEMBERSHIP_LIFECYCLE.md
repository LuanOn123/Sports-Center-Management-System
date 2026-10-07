# FINAL Policy A — Membership Subscription lifecycle (backend)

> Backend only. Không đổi FE. Không thêm QUEUED/freeze/fallback FREE.

## State machine

```text
            ┌──────────────┐
            │    ACTIVE    │  duy nhất/member, cấp entitlement
            └──────┬───────┘
                   │ mua/gia hạn mới (atomic replacement)
                   ↓
            ┌──────────────┐
            │  SUSPENDED   │  gói cũ bị thay thế — terminal
            └──────────────┘

ACTIVE ── quá endDate (job) ──> EXPIRED
ACTIVE ── hủy (workflow + hoàn riêng) ──> CANCELLED

Cấm:
SUSPENDED → ACTIVE
EXPIRED → ACTIVE
CANCELLED → ACTIVE
```

FREE tuân cùng nguyên tắc lịch sử:

```text
FREE ACTIVE ── mua paid ──> FREE SUSPENDED + PAID ACTIVE
PAID ACTIVE ── hết hạn ──> PAID EXPIRED (không hồi FREE cũ)
```

Member vẫn là MEMBER sau expiry, nhưng không có entitlement paid cho tới khi mua mới.

## Replacement nguyên tử

- `activateSubscriptionForPayment` (quầy + SePay dùng chung):
  1. `lockMemberSubscription(memberId)` trước mọi đọc/ghi.
  2. `applyPlanSwitchRules` CAS `SUSPEND` gói ACTIVE cũ (`updateMany id + ACTIVE`).
  3. Tạo gói mới `ACTIVE`, `start = now` (quầy cho phép startDate), `end = start + durationDays`.
  4. `Payment → SUCCESS + paidAt + subscriptionId`, `Invoice` snapshot số tiền đã thu.
- Không cộng ngày dư; FREE `remainingDays = 0`; `remainingDays/suspendedAt` chỉ audit.
- Renew = replacement mới, không mutate `endDate` gói cũ, không tạo ACTIVE tương lai.

## Resolver/lifecycle/cancel

- Entitlement duy nhất: `status ACTIVE + startDate <= now <= endDate` (`findActiveSubscription`
  dùng cho quota/booking/check-in/attendance/purchase/renew/cancel/lifecycle).
- Job `expireStaleSubscriptions`: `ACTIVE/SUSPENDED + endDate < now → EXPIRED` (CAS),
  không hồi SUSPENDED/FREE, không tạo fallback.
- Cancel/hoàn giữ nguyên (30% member tự hủy, prorated Manager, origin facility,
  hủy booking GLOBAL); `CANCELLED` là lịch sử.

## Đồng thời

- Lock member `membership:member:<memberId>` + CAS suspend + transaction chung
  purchase/renew/webhook-settlement. Settlement lỗi → `REQUIRES_REVIEW`, không resume cũ.

## DB

- Không thêm unique ACTIVE vì `ACTIVE` còn mang nghĩa stored-state (job quét theo `endDate`);
  cơ chế authoritative là lock + CAS + transaction. Cần kiểm tra duplicate ACTIVE lịch sử
  bằng query trước khi tuyên bố sạch, không tự sửa production.
