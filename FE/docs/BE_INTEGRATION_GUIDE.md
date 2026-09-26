# Hướng dẫn tích hợp FE — toàn bộ thay đổi BE (đợt sửa audit A–N)

Ngày: 27/09/2026 · Branch BE: `feature/BE-core-flow-1-2-3` · Trạng thái BE: **đã sửa + đã test e2e (6 suite, ~725 check)**, FE đã được **revert về nguyên trạng** để tích hợp có kiểm soát.

> Mục đích tài liệu: liệt kê MỌI thay đổi BE có ảnh hưởng tới FE, chia rõ **bắt buộc sửa** (breaking) và **nên cập nhật**, kèm snippet code dán trực tiếp + checklist test tay.

---

## 0. Bảng tổng quan theo task audit

| Task | Nội dung BE | Ảnh hưởng FE | Mức |
|---|---|---|---|
| **A01** | FREE 3650 ngày **không còn** cộng vào gói trả phí khi mua/nâng cấp | Copy UI nói "cộng ngày dư" cần nói rõ "gói trả phí" | Nên sửa |
| **A02** | Hoàn tiền (hủy gói) **cap ≤ tiền đã thu** của payment gốc | Không đổi API; số `refundAmount` hiển thị có thể nhỏ hơn trước | Nên biết |
| **A03** | `GET /training-plans` **scope theo actor**: MEMBER chỉ plan của mình (đổi `memberId` người khác ⇒ **403**), COACH chỉ plan mình phụ trách; response không còn `password` | FE member/coach vẫn chạy đúng; cần xử lý 403 + không hiển thị dữ liệu ngoài scope | Nên kiểm tra |
| **A04** | Bỏ `password` hash khỏi mọi response nested (attendance roster, subscriptions, enrollments, classes…) | Không đổi field FE đang dùng (`member.user.fullName`) | Không cần |
| **A05** | `PATCH /payments/{id}/status` trả **400 với giao dịch online (SePay)** | Màn payments KHÔNG được cho đổi trạng thái thủ công với giao dịch SePay | **Bắt buộc** |
| **A06** | `GET /payments/sepay/{id}` thêm `activationStatus`, `requiresReview`, `reviewReason`; tiền đã về nhưng chưa cấp gói ⇒ FE phải hiển thị **"đã nhận tiền — đang đối soát"** (không báo đã kích hoạt) | Modal SePay phải branch theo `requiresReview` | **Bắt buộc** |
| **A06** | Endpoint mới `POST /payments/{id}/retry-activation` (MANAGER) | Tuỳ chọn: thêm nút "Kích hoạt bù" cho quản lý | Tuỳ chọn |
| **A07** | Snapshot offer khi checkout: giá/duration/tier/quota **cố định lúc tạo QR**; hoá đơn = số tiền đã thu | Không đổi API; UI hiển thị đúng snapshot (BE trả `plan` từ snapshot) | Nên biết |
| **A08** | Renew từ gói **FREE** bắt đầu **ngay** + gói FREE cũ → SUSPENDED | Không đổi API; tránh hiển thị "kỳ mới bắt đầu sau 10 năm" | Không cần |
| **A09** | Điểm danh: **cửa sổ server-side** (start−30′ → end+30′), buổi phải `SCHEDULED`; **không ghi đè** kết quả đã chốt; generate QR cũng bị chặn ngoài cửa sổ | FE phải hiển thị message 409 mới; QR chỉ hữu dụng trong cửa sổ | **Bắt buộc** |
| **A10–A12** | Analytics chuyên cần theo lịch sử; guard sức chứa lớp/phòng; dời lịch bị chặn nếu phá chỗ; khoá+CAS khi hủy/complete lịch | FE hiển thị **409 codes mới**; refresh dữ liệu khi gặp `SCHEDULE_STATE_CHANGED` | **Bắt buộc** |
| **A14** | Ledger ngân hàng: 1 movement chỉ cấp gói 1 lần; nội dung chứa nhiều mã đơn ⇒ từ chối | Không đổi API FE (chỉ webhook events nội bộ) | Không cần |
| **B07** | Job vòng đời: gói quá hạn → `EXPIRED` + notify; nhắc trước 3 ngày; đóng SePay PENDING quá TTL. **Endpoint mới không có** | FE có thể thấy status đổi "tự động"; notification `SUBSCRIPTION_EXPIRING/EXPIRED` xuất hiện | Nên biết |
| **C08** | Feedback ẩn danh **không trả `memberId`/`member`**; mọi item có thêm `isOwn` | FE dùng `isOwn` thay vì tự so `memberId` (bản thân dùng `/feedbacks/my`) | Nên sửa |
| **C10** | Report member: `membersByTier.FREE` đếm đúng (không còn bị ghi đè bằng `total - active`) | Số liệu dashboard đổi (chính xác hơn) | Nên biết |
| **C11** | `GET /reports/revenue` thêm `refundedAmount`, `netRevenue`; cohort tách rõ cash (paidAt) vs đơn (createdAt) | Dashboard nên hiển thị **thực nhận (net)** | Nên sửa |
| **D03** | File chat **không còn public**: tải qua `GET /chat/attachments/{id}` (auth + phân quyền); upload allowlist + magic bytes; avatar bắt buộc chữ ký ảnh | **Bắt buộc**: ảnh/file chat phải fetch kèm Bearer token → blob URL; copy lỗi upload | **Bắt buộc** |
| **D04/D05** | Đổi mật khẩu **revoke toàn bộ refresh token + ngắt socket**; khóa/đổi role cũng ngắt socket | FE phải xử lý 401 → về màn login; không giữ phiên "chết" | **Bắt buộc** |
| **D06** | `mock-confirm` bị **chặn khi `NODE_ENV=production`**; server fail-fast nếu `SEPAY_MOCK_MODE=true` ở production | FE giữ `VITE_SEPAY_MOCK_MODE` cho dev; ở prod không được hiện nút mock | Nên kiểm tra |
| **D07** | Webhook HMAC kiểm tra **độ tươi timestamp** (mặc định 3600s) | Không ảnh hưởng FE | Không cần |
| **F01** | Notification ghi qua **outbox** rồi gửi sau commit (+ worker 5s) | Không đổi API; notification có thể tới chậm vài giây | Nên biết |

---

## 1. Breaking changes — FE BẮT BUỘC sửa

### 1.1. D03 — File chat riêng tư (không còn URL công khai)

**BE đã đổi:**

| Hạng mục | Trước | Sau |
|---|---|---|
| Upload | `POST /chat/messages` multipart, field `file` | không đổi field — nhưng **allowlist** jpeg/png/webp/gif/pdf, ≤ **10MB**, + kiểm tra **magic bytes** (khai `image/png` mà nội dung là text ⇒ **400**) |
| `message.fileUrl` | `http://host/uploads/<random>.<ext>` (mở trực tiếp) | `http://host/api/v1/chat/attachments/<attachmentId>?name=<tên-server-sinh>` — **cần Bearer token**, mở trực tiếp bằng `<a href>`/`<img src>` sẽ **401** |
| Tải file | static, ai biết URL cũng tải được | `GET /api/v1/chat/attachments/:id` + phân quyền: người gửi / người nhận / MANAGER; phòng chung (`receiverId = null`) mọi user đã đăng nhập |
| File cũ | URL `/uploads/...` | **không còn phục vụ** (static chỉ còn `/uploads/avatars`) ⇒ hiển thị fallback "tệp cũ không còn khả dụng" |

**Message lỗi cần map (BE):**
- `400` `"Tệp đính kèm phải là ảnh (jpeg/png/webp/gif) hoặc PDF."` (sai loại MIME lúc upload)
- `400` `"Tệp đính kèm tối đa 10MB."` (vượt dung lượng)
- `400` `"Tệp đính kèm không hợp lệ (chỉ nhận jpeg/png/webp/gif/pdf và đúng định dạng thật)."` (giả mạo định dạng)
- `401` thiếu/hết hạn token khi tải; `403` `"Forbidden: bạn không có quyền tải tệp này"`; `404` `"Attachment not found"` / `"Attachment file not found on storage"`.

**FE cần làm:** thay khối render attachment trong `FE/src/shared/Communication.tsx` (quanh dòng 786–817) bằng component fetch blob kèm token:

```tsx
/**
 * D03: file chat cần Authorization: Bearer nên KHÔNG thể dùng <a>/<img src> trực tiếp.
 * Fetch → blob → object URL; thu hồi object URL khi unmount để không rò rỉ bộ nhớ.
 */
function ProtectedAttachment({
  url,
  name,
  label,
}: {
  url: string;
  name: string;
  label: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBlobUrl(null);
    setFailed(false);
    const token = getAccessToken();
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl.current = URL.createObjectURL(blob);
        setBlobUrl(objectUrl.current);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
    };
  }, [url]);

  if (failed)
    return (
      <span className="chat-document" role="alert">
        <Paperclip size={18} /> {label} không còn khả dụng.
      </span>
    );
  if (!blobUrl)
    return (
      <span className="chat-document" role="status">
        Đang tải {label}…
      </span>
    );

  return /\.(png|jpe?g|gif|webp)$/i.test(name) ? (
    <img className="chat-image" src={blobUrl} alt={`Ảnh đính kèm: ${name}`} loading="lazy" />
  ) : (
    <a className="chat-document" href={blobUrl} download={name}>
      <Paperclip size={18} /> {name}
    </a>
  );
}
```

Thay khối cũ trong danh sách tin nhắn (giữ `attachmentUrl` để chặn `javascript:` XSS):

```tsx
{attachmentUrl(m.fileUrl) && (
  <ProtectedAttachment
    url={attachmentUrl(m.fileUrl)!}
    name={
      decodeURIComponent(
        new URL(attachmentUrl(m.fileUrl)!).searchParams.get("name") || "tep-dinh-kem",
      )
    }
    label="Tệp đính kèm"
  />
)}
```

**Lưu ý thêm:**
- Tên file hiển thị nằm ở query `?name=` (server sinh, không phải tên gốc) — không parse từ path URL nữa.
- Copy ở composer: sửa "tối đa 10 MB" → "ảnh (jpeg/png/webp/gif) hoặc PDF, tối đa 10 MB".
- Nút upload cần tự chặn trước (accept + size) để giảm 400, nhưng **vẫn phải map 400** vì server kiểm tra magic bytes.
- Phòng chung: mọi user đã đăng nhập tải được, kể cả người không trong hội thoại — không cần phân quyền FE phía client.

### 1.2. A06 — SePay: tiền đã về nhưng gói CHƯA kích hoạt (`REQUIRES_REVIEW`)

**BE đã thêm vào response `GET /payments/sepay/:id`** (và payload trả về ở các luồng chốt đơn):

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `activationStatus` | `"ACTIVATED" \| "REQUIRES_REVIEW"` (optional — chỉ có khi đơn đã chốt) | Trạng thái **cấp quyền**, tách khỏi trạng thái tiền |
| `requiresReview` | `boolean` (chỉ xuất hiện khi `true`) | Tiền ĐÃ thu nhưng gói chưa được cấp |
| `reviewReason` | `string \| null` | Lý do BE chặn cấp gói (VD bị luật hạ hạng chặn) |

**Quy tắc FE (bắt buộc):**
- `status === "SUCCESS" && requiresReview` ⇒ **KHÔNG** báo "đã kích hoạt", **KHÔNG** invalidate `current-membership`/`member-invoices`, hiển thị banner "**Đã nhận thanh toán — đang đối soát**", cho phép đóng modal.
- `status === "SUCCESS" && !requiresReview` (`activationStatus === "ACTIVATED"`) ⇒ giữ nguyên hành vi cũ (báo thành công + refresh gói).

**Patch 1 — types** (`FE/src/types/member.ts`, interface `SepayCheckout` sau dòng 319):

```ts
export type PaymentActivationStatus = "ACTIVATED" | "REQUIRES_REVIEW";

export interface SepayCheckout {
  // ... các field cũ giữ nguyên
  /** A06: trạng thái cấp quyền — chỉ có khi đơn đã được chốt. */
  activationStatus?: PaymentActivationStatus;
  /** Tiền đã thu nhưng gói chưa cấp ⇒ hiển thị "đang đối soát", KHÔNG báo đã kích hoạt. */
  requiresReview?: boolean;
  reviewReason?: string | null;
}
```

**Patch 2 — toast** (`FE/src/shared/SepayCheckout.tsx`, thay `useEffect` dòng 73–85): thêm `requiresReview` vào key + nhánh thông báo riêng:

```tsx
useEffect(() => {
  if (!current) return;
  const state = `${current.paymentId}:${current.status}:${current.requiresReview ? "R" : "A"}`;
  if (state === announced.current || current.status === "PENDING") return;
  announced.current = state;
  if (current.status === "SUCCESS" && !current.requiresReview)
    toast("success", "Thanh toán thành công. Gói hội viên đã được kích hoạt.", state);
  else if (current.status === "SUCCESS")
    toast(
      "info",
      "Đã nhận thanh toán. Gói hội viên đang được trung tâm đối soát và sẽ kích hoạt trong ít phút.",
      state,
    );
  else toast("error", "Thanh toán thất bại. Vui lòng tạo đơn mới.", state);
}, [current?.paymentId, current?.status, current?.requiresReview]);
```

**Patch 3 — chỉ refresh quyền lợi khi ĐÃ cấp gói** (thay `useEffect` dòng 91–97):

```tsx
useEffect(() => {
  if (current?.status !== "SUCCESS" || current?.requiresReview) return;
  onConfirmed?.();
  queryClient.invalidateQueries({ queryKey: ["current-membership"] });
  queryClient.invalidateQueries({ queryKey: ["member-invoices"] });
  queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
}, [current?.status, current?.requiresReview, current?.paymentId, queryClient]);
```

**Patch 4 — màn SUCCESS chia 2 nhánh** (trong `SepayCheckout.tsx`, nhánh `current.status === "SUCCESS"` dòng ~118):

```tsx
{current.status === "SUCCESS" ? (
  current.requiresReview ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AlertBanner
        type="warning"
        title="Đã nhận thanh toán — đang đối soát"
        message={`Trung tâm đã nhận được tiền cho đơn ${current.orderCode}. Gói hội viên sẽ được kích hoạt sau khi bộ phận vận hành xử lý xong; vui lòng giữ biên lai.${
          current.reviewReason ? ` Ghi chú xử lý: ${current.reviewReason}` : ""
        }`}
      />
      <button type="button" className="button primary" onClick={onClose}>
        Đóng
      </button>
    </div>
  ) : (
    /* ... khối "Thanh toán thành công!" hiện tại giữ nguyên ... */
  )
) : ( /* ... nhánh PENDING/FAILED hiện tại ... */ )}
```

**Tuỳ chọn (MANAGER) — kích hoạt bù:** endpoint mới `POST /payments/{id}/retry-activation`.

```ts
// Gọi từ màn quản lý payments (chỉ role MANAGER)
api<{ payment: unknown; subscription: unknown }>(
  "POST /payments/{id}/retry-activation",
  { params: { id: paymentId } },
);
```

- `200` → `payment.activationStatus = "ACTIVATED"`, `reviewReason = null` ⇒ refresh danh sách + báo thành công.
- `400`: `"Giao dịch chưa được xác nhận thu tiền — không thể kích hoạt."` · `"Giao dịch đã được kích hoạt gói trước đó."` · `"Giao dịch không ở trạng thái cần xử lý (REQUIRES_REVIEW)."` · `404 "SePay payment not found"`.
- `409` code `SEPAY_ACTIVATION_REJECTED` (`"Không kích hoạt được gói: <lý do>"` — vẫn bị luật nghiệp vụ chặn, xử lý tiếp rồi retry) · `SEPAY_PLAN_MISSING` (gói của đơn đã bị xoá — cần hoàn tiền thủ công).
- Gợi ý UI: hiển thị badge "Cần đối soát" khi `activationStatus === "REQUIRES_REVIEW"` để manager lọc đơn.

### 1.3. A05 — `PATCH /payments/{id}/status` bị chặn với giao dịch online

BE trả `400` `"Không thể đổi trạng thái thanh toán online thủ công. Giao dịch SePay được chốt qua webhook/đối soát."` khi payment có `gateway` (đơn tạo qua SePay).

**FE cần sửa `FE/src/features/reception/payments/PaymentsPage.tsx` (dòng ~116–121):** ẩn chuyển trạng thái với đơn online:

```tsx
const online = Boolean(row.gateway); // đơn SePay: trạng thái chỉ chốt qua webhook/đối soát
<StatusAction
  operation="PATCH /payments/{id}/status"
  id={String(row.id)}
  statuses={online ? [] : paymentTransitions(String(row.status), role)}
  explanation={
    online
      ? "Giao dịch chuyển khoản SePay được chốt tự động qua webhook/đối soát; không cập nhật thủ công."
      : "Cập nhật thanh toán sẽ cập nhật hóa đơn tương ứng. Hoàn tiền ở đây chỉ ghi nhận trạng thái, không chuyển tiền qua ngân hàng và không tự hủy quyền lợi gói. Đối chiếu giao dịch thực tế trước khi xác nhận."
  }
/>
```

Hoặc mở rộng `paymentTransitions` (`FE/src/shared/businessRules.ts` dòng 29) — nhớ cập nhật `FE/tests/businessRules.test.ts`:

```ts
export function paymentTransitions(
  status: string,
  role: string,
  gateway?: string | null,
): string[] {
  if (role !== "MANAGER" || gateway) return []; // đơn online chỉ chốt qua webhook/đối soát
  return status === "PENDING"
    ? ["SUCCESS", "FAILED"]
    : status === "SUCCESS"
      ? ["REFUNDED"]
      : [];
}
```

### 1.4. D04/D05 — Đổi mật khẩu thu hồi phiên (mọi thiết bị)

**BE:** đổi mật khẩu thành công ⇒ **revoke toàn bộ refresh token** của user + ngắt socket; khóa tài khoản (`isActive = false`) hoặc đổi role cũng ngắt socket đang mở.

**FE cần làm:**
- Sau khi `PATCH` đổi mật khẩu thành công: **xóa phiên local + điều hướng `/login`** ngay (access token cũ chỉ sống ngắn hạn, nhưng refresh sẽ thất bại ⇒ tránh trạng thái "nửa phiên").
- Tầng API đã có map `localizeApiError` cho `"refresh token has been revoked"` / `"refresh token has expired"` ⇒ khi refresh fail phải clear storage + `window.location.assign("/login")` (kiểm tra interceptor hiện tại có làm việc này chưa).
- Socket: lắng nghe sự kiện `disconnect` với reason `"io server disconnect"` ⇒ hiển thị "Phiên đăng nhập đã kết thúc ở thiết bị khác" và chuyển login; không auto-reconnect vô hạn.
- Màn đổi mật khẩu nên cảnh báo trước: "Đổi mật khẩu sẽ đăng xuất khỏi tất cả thiết bị."

---

## 2. Nên cập nhật (không phá vỡ giao diện)

### 2.1. A01/A08 — Copy "cộng ngày dư" (gói FREE không cộng) + gia hạn từ FREE

BE: khi mua/nâng cấp gói trả phí, **chỉ cộng ngày dư của gói TRẢ PHÍ đang ACTIVE**; gói FREE hệ thống (3650 ngày) không cộng. Gia hạn từ gói FREE bắt đầu **ngay** và gói FREE cũ chuyển `SUSPENDED`.

**Sửa 3 chỗ copy (giữ nguyên câu chữ còn lại):**

1. `FE/src/features/reception/membership/MembershipPage.tsx` (dòng ~95):
   - Cũ: `…Đăng ký gói mới sẽ tạm dừng gói ACTIVE và cộng ngày dư vào gói mới, không cho phép hạ hạng…`
   - Mới: `…Đăng ký gói mới sẽ tạm dừng gói ACTIVE và cộng ngày dư của gói TRẢ PHÍ vào gói mới (gói FREE hệ thống không cộng), không cho phép hạ hạng…`
2. `FE/src/shared/forms/SchemaForm.tsx` (dòng ~267):
   - Cũ: `…Đăng ký gói mới tạm dừng các gói đang hoạt động và cộng ngày dư vào gói mới; gia hạn tạo thêm một kỳ gói.`
   - Mới: `…Đăng ký gói mới tạm dừng các gói đang hoạt động và cộng ngày dư của gói trả phí vào gói mới (gói FREE không cộng); gia hạn tạo thêm một kỳ gói.`
3. `FE/src/shared/Policies.tsx` (dòng ~51):
   - Cũ: `…ngày dư được cộng vào gói mới.`
   - Mới: `…ngày dư của gói trả phí được cộng vào gói mới (gói FREE không cộng).`

Kiểm tra thêm `MembershipPage.tsx` dòng ~160 (explanation của StatusAction subscriptions) đang ghi *"backend hiện chưa áp dụng hoàn tiền và hủy lịch tự động cho gói tạm dừng"* — đối chiếu lại với BE hiện tại trước khi giữ nguyên.

### 2.2. C11 — `GET /reports/revenue`: thêm `refundedAmount`, `netRevenue` (dashboard nên hiển thị "thực nhận")

Cấu trúc response mới (cohort tách rõ):

| Field | Cohort | Ý nghĩa |
|---|---|---|
| `totalRevenue` | `paidAt` | Tiền **thực thu** trong kỳ (payment SUCCESS) |
| `refundedAmount` *(mới)* | `paidAt` | Tiền **đã hoàn** trong kỳ (payment REFUNDED) |
| `netRevenue` *(mới)* | `paidAt` | **Thực nhận** = `totalRevenue − refundedAmount` (không âm) |
| `successPayments` / `refundedPayments` | `paidAt` | Số giao dịch thu được / đã hoàn |
| `totalPayments` | `createdAt` | Tổng số **đơn được tạo** trong kỳ (mọi trạng thái) |
| `pendingPayments` / `failedPayments` | `createdAt` | Đơn tạo trong kỳ đang chờ / thất bại |
| `revenueByMethod` | `paidAt` | `CASH` / `BANK_TRANSFER` / `SEPAY` (chỉ SUCCESS) |
| `recentPayments` | `paidAt` | Tối đa 10 dòng **SUCCESS/REFUNDED**, sort `paidAt desc` — nay chỉ có `paidAt` hợp lệ (không lẫn PENDING) |
| `note` | — | Chuỗi giải thích; lưu ý: **chưa có refund ledger chi tiết** — payment REFUNDED tính hoàn TOÀN BỘ tiền gốc |

Gợi ý dashboard: thêm card "Thực nhận (net)" và cột "Đã hoàn"; nếu đang hiển thị `totalPayments` như "số giao dịch thành công" thì phải đổi nhãn (nay là số **đơn tạo**).

### 2.3. C08 — Feedback ẩn danh + cờ `isOwn`

- `GET /feedbacks?coachId=...`: item `isAnonymous: true` **không còn** `memberId`/`member`; mọi item có thêm **`isOwn`** (chính tác giả).
- FE: nơi nào đang so `memberId === myMemberId` để cho sửa/xóa ⇒ chuyển sang `isOwn`; với item ẩn danh không được hiển thị tên tác giả kể cả khi `isOwn`.
- Bản thân member vẫn dùng `GET /feedbacks/my` như cũ (`FE/src/shared/CoachFeedback.tsx` dòng 44 không cần đổi).

### 2.4. B07/F01 — Gói tập tự hết hạn + notification qua outbox

- BE chạy job nền 15 phút/lần: gói quá `endDate` → `EXPIRED` + notification **"Gói tập đã hết hạn"**; gói còn ≤ 3 ngày → nhắc **"Gói tập sắp hết hạn"** (1 lần/24h).
- FE: danh sách gói có thể đổi trạng thái mà **không do người dùng thao tác** ⇒ khi refetch thấy `EXPIRED` thì hiển thị đúng; không cần code mới, nhưng nên có text phụ "Hệ thống tự cập nhật khi hết hạn".
- F01: notification ghi qua **outbox** (gửi sau commit + worker 5s) ⇒ UI có thể chậm vài giây so với hành động; không giả định realtime tuyệt đối (chuông đang `refetchInterval 20s` là ổn).

### 2.5. Các điểm khác cần biết

- **A03 (scope training plans):** member chỉ xem/sửa plan của mình (đổi `memberId` sang người khác ⇒ `403 "Forbidden: You can only view your own training plans"` / `"…manage your own training plans"`; coach xem plan mình phụ trách, sai scope ⇒ `"Forbidden: bạn không có quyền xem kế hoạch tập luyện"`). **FE: bỏ mọi dropdown cho member/coach chọn member khác** ở màn training plans.
- **A04 (bỏ password hash):** mọi response nested không còn `password`. FE không dùng field này — nếu type nội bộ có khai `password?: string` thì xoá để khỏi hiểu nhầm.
- **A07 (snapshot offer):** `GET /payments/sepay/:id` trả `plan` **theo snapshot lúc tạo đơn** — nếu quản lý đổi giá/gói sau khi member đã tạo QR, màn checkout vẫn hiển thị đúng thỏa thuận cũ; FE **không tự đối chiếu với danh sách plan live**.
- **C10 (report members):** `membersByTier` đếm chính xác hơn (trước đây `FREE` bị ghi đè bằng `total − active`) ⇒ số trên dashboard có thể **khác trước** — không phải lỗi.
- **D03 avatar:** upload avatar từ chối file không đúng chữ ký ảnh:
  - `400 "Avatar must be an image (jpeg, png, webp or gif)"` (sai MIME khai báo)
  - `400 "Avatar image must be at most 5MB"`
  - `400 "Avatar image content is invalid (jpeg, png, webp or gif)"` (nội dung giả ảnh)
  - FE: `accept="image/*"` + chặn 5MB trước khi gửi + map 3 message trên.
- **D06 (mock mode):** production chặn `mock-confirm` → `403 "Chế độ mô phỏng SePay bị chặn trên môi trường production."` (code `SEPAY_MOCK_DISABLED`). FE chỉ bật nút "DEV: giả lập SePay đã thu tiền" khi `VITE_SEPAY_MOCK_MODE === "true"` và **không bật biến này ở build production**.

### 2.6. A09/A10–A12 — Message 409/400 mới khi điểm danh & lịch học

| Ngữ cảnh | HTTP | Message (BE) |
|---|---|---|
| Điểm danh buổi đã hủy/hoàn tất | 409 | `Buổi học đã đóng (hủy hoặc đã hoàn tất) nên không thể điểm danh.` |
| Quét QR **trước** cửa sổ (−30′) | 409 | `Chưa đến thời gian điểm danh. Mã chỉ dùng được từ 30 phút trước khi buổi học bắt đầu.` |
| Quét QR **sau** cửa sổ (+30′) | 409 | `Buổi học đã kết thúc, không thể tự điểm danh nữa. Vui lòng liên hệ HLV hoặc quản lý để được ghi nhận.` |
| Kết quả đã chốt (ABSENT/LATE/EXCUSED) | 409 | `Buổi học đã được điểm danh với trạng thái <X>. Vui lòng liên hệ HLV/quản lý nếu cần điều chỉnh.` |
| Sai mã dự phòng quá nhiều | 429 | `Bạn đã nhập sai mã điểm danh quá nhiều lần. Vui lòng thử lại sau hoặc nhờ HLV điểm danh trực tiếp.` |
| Check-in khi gói hết hạn | 403 | `Gói tập của bạn đã hết hạn. Vui lòng gia hạn để có thể vào lớp học.` |
| Giảm sức chứa lớp dưới chỗ đã giữ | 400 | `Không thể giảm sức chứa lớp xuống <X>: <Y> chỗ đang được giữ ở các buổi sắp tới.` (`errors.code = CLASS_CAPACITY_BELOW_BOOKED`) |
| Giảm sức chứa phòng quá nhỏ | 400 | `Không thể giảm sức chứa phòng xuống <X>: cần tối thiểu <Y> (chỗ đã giữ / sức chứa lớp đang xếp lịch).` (`ROOM_CAPACITY_TOO_SMALL`) |
| Dời/hủy lịch làm member mất chỗ | 409 | `Không thể dời lịch: một số hội viên đã giữ chỗ sẽ bị trùng giờ hoặc ngoài hạn gói.` (`SCHEDULE_MOVE_IMPACT`, kèm `errors.conflicts`, `errors.uncovered` = **tên hội viên**) |
| Lịch vừa bị người khác đổi trạng thái | 409 | `Lịch học đã thay đổi trạng thái, vui lòng tải lại.` / `Lịch học đã được hoàn tất bởi thao tác khác.` (`SCHEDULE_STATE_CHANGED`) |
| Đặt chỗ khi lịch không còn `SCHEDULED` | 409 | `Lịch học không còn khả dụng để đặt chỗ.` (`SCHEDULE_NOT_AVAILABLE`) |

**FE nên làm:**
- Hiển thị trực tiếp message (đã tiếng Việt) ở form/scan; với `SCHEDULE_MOVE_IMPACT` liệt kê `conflicts`/`uncovered`.
- Gặp `SCHEDULE_STATE_CHANGED` ⇒ **refetch** danh sách/lịch trước khi cho thao tác lại (tránh retry mù).
- Màn generate QR: chỉ hiện nút khi buổi `SCHEDULED` và thời điểm hiện tại nằm trong cửa sổ (FE chỉ ẩn/hiện cho UX — server vẫn là nơi quyết định).

**Bổ sung vào `FE/src/shared/apiErrors.ts` (map message lowercase):**

```ts
  "không thể đổi trạng thái thanh toán online thủ công. giao dịch sepay được chốt qua webhook/đối soát.":
    "Giao dịch online được chốt tự động qua webhook/đối soát — không thể cập nhật thủ công.",
  "tệp đính kèm phải là ảnh (jpeg/png/webp/gif) hoặc pdf.":
    "Chỉ gửi được ảnh (JPEG/PNG/WebP/GIF) hoặc PDF.",
  "tệp đính kèm tối đa 10mb.": "Tệp đính kèm tối đa 10MB.",
  "tệp đính kèm không hợp lệ (chỉ nhận jpeg/png/webp/gif/pdf và đúng định dạng thật).":
    "Tệp không đúng định dạng thật (ảnh/PDF). Vui lòng chọn tệp khác.",
  "avatar image content is invalid (jpeg, png, webp or gif)":
    "Nội dung ảnh đại diện không hợp lệ. Vui lòng chọn ảnh JPEG/PNG/WebP/GIF thật.",
  "chưa đến thời gian điểm danh. mã chỉ dùng được từ 30 phút trước khi buổi học bắt đầu.":
    "Chưa đến giờ điểm danh — mã QR chỉ mở từ 30 phút trước buổi học.",
  "buổi học đã kết thúc, không thể tự điểm danh nữa. vui lòng liên hệ hlv hoặc quản lý để được ghi nhận.":
    "Buổi học đã kết thúc. Vui lòng liên hệ HLV/quản lý để được ghi nhận.",
```

---

## 3. Danh sách endpoint mới / thay đổi

### 3.1. Endpoint MỚI

| Method | Path | Role | Ghi chú |
|---|---|---|---|
| `GET` | `/api/v1/chat/attachments/:id` | mọi user đăng nhập | **D03** — tải file chat, `Authorization: Bearer` bắt buộc; owner / receiver / MANAGER; phòng chung ai cũng tải được |
| `POST` | `/api/v1/payments/:id/retry-activation` | MANAGER | **A06** — kích hoạt bù cho đơn `activationStatus = REQUIRES_REVIEW`; xem mục 1.2 |

### 3.2. Endpoint THAY ĐỔI hành vi/response

| Method | Path | Thay đổi chính |
|---|---|---|
| `POST` | `/api/v1/chat/messages` | `message.fileUrl` trỏ về endpoint tải CÓ AUTH; upload allowlist + magic bytes; lỗi 400 mới |
| `POST` | `/api/v1/auth/me/avatar` | Bắt buộc chữ ký ảnh thật (magic bytes); 3 message 400 mới |
| `PATCH` | `/api/v1/auth/me/change-password` | Thu hồi **mọi** refresh token + ngắt socket ⇒ FE phải logout sau khi đổi |
| `PATCH` | `/api/v1/payments/{id}/status` | `400` với giao dịch online (`gateway != null`) — không đổi trạng thái thủ công |
| `GET` | `/api/v1/payments/sepay/{id}` | Thêm `activationStatus`, `requiresReview`, `reviewReason`; `plan` theo snapshot đơn |
| `GET` | `/api/v1/reports/revenue` | Thêm `refundedAmount`, `netRevenue`; cohort cash (`paidAt`) tách order (`createdAt`); `recentPayments` chỉ SUCCESS/REFUNDED |
| `GET` | `/api/v1/reports/members` | `membersByTier` chính xác hơn (FREE không còn bị ghi đè) |
| `GET` | `/api/v1/feedbacks?coachId=` | Thêm `isOwn`; feedback ẩn danh không trả `memberId`/`member` |
| `GET/PATCH` | `/api/v1/training-plans…` | Scope theo actor: member/coach chỉ dữ liệu của mình ⇒ **403** khi vượt scope |
| `GET` | `/api/v1/attendance` (roster) | `member.user` chỉ còn `{ id, fullName }` (bỏ password) — FE không cần đổi |
| `POST` | `/api/v1/attendance/scan-qr`, `/attendance/manual-code`, generate-qr | Thêm cửa sổ điểm danh server-side + không ghi đè kết quả đã chốt (409) |
| `POST/PATCH` | `/api/v1/classes/:id`, `/rooms/:id` (capacity) | Guard sức chứa (400 codes mới) |
| `PATCH/POST/DELETE` | `/api/v1/class-schedules…` | Guard dời lịch + CAS trạng thái (409 codes mới) |
| `POST` | `/api/v1/enrollments…` (book) | Re-check sau lock: lịch không còn `SCHEDULED` ⇒ 409 `SCHEDULE_NOT_AVAILABLE` |

### 3.3. Error code trong `errors.code` (FE nên branch/map)

| Code | HTTP | Ngữ cảnh |
|---|---|---|
| `CLASS_CAPACITY_BELOW_BOOKED` | 400 | Giảm `class.capacity` dưới số chỗ đang giữ |
| `ROOM_CAPACITY_TOO_SMALL` | 400 | Giảm `room.capacity` dưới yêu cầu (chỗ giữ / sức chứa lớp) |
| `SCHEDULE_MOVE_IMPACT` | 409 | Dời lịch làm member trùng giờ / ngoài hạn gói (`conflicts`, `uncovered`) |
| `SCHEDULE_STATE_CHANGED` | 409 | Lịch vừa bị thay đổi bởi thao tác khác ⇒ refetch |
| `SCHEDULE_NOT_AVAILABLE` | 409 | Đặt chỗ khi lịch không còn `SCHEDULED` |
| `SEPAY_ACTIVATION_REJECTED` | 409 | Retry-activation vẫn bị luật nghiệp vụ chặn |
| `SEPAY_PLAN_MISSING` | 409 | Gói của đơn SePay đã bị xoá — cần xử lý thủ công/hoàn tiền |
| `SEPAY_MOCK_DISABLED` | 403 | `mock-confirm` bị tắt hoặc chặn ở production |
| `SEPAY_NOT_CONFIGURED` | 503 | Chưa cấu hình SePay (đã có từ trước) |
| `SEPAY_PAYMENT_PENDING` | 409 | Member đang có giao dịch chờ (đã có từ trước) |

---

## 4. Checklist tích hợp FE

**Bắt buộc (làm trước khi release):**
- [ ] `FE/src/shared/Communication.tsx`: thêm `ProtectedAttachment` + thay khối render file (mục 1.1); sửa copy composer (ảnh/PDF ≤ 10MB); hiển thị fallback với file cũ.
- [ ] `FE/src/types/member.ts`: thêm `PaymentActivationStatus` + 3 field vào `SepayCheckout` (mục 1.2).
- [ ] `FE/src/shared/SepayCheckout.tsx`: 4 patch (toast / invalidate / nhánh SUCCESS review / giữ nguyên nhánh còn lại) (mục 1.2).
- [ ] `FE/src/features/reception/payments/PaymentsPage.tsx`: ẩn đổi trạng thái khi `row.gateway`; nếu mở rộng `paymentTransitions` thì cập nhật `FE/tests/businessRules.test.ts` (mục 1.3).
- [ ] `FE/src/shared/Profile.tsx` + `FE/src/features/coach/CoachProfile.tsx`: sau `PATCH /auth/me/change-password` thành công ⇒ **clear session + redirect `/login`**; thêm copy cảnh báo "đăng xuất khỏi tất cả thiết bị" (mục 1.4).
- [ ] API client: refresh token fail (revoked/expired) ⇒ clear storage + redirect login; socket `io server disconnect` ⇒ thông báo + login (mục 1.4).
- [ ] `FE/src/shared/apiErrors.ts`: thêm mapping message mới (mục 2.6).

**Nên làm:**
- [ ] Copy 3 file: `MembershipPage.tsx`, `SchemaForm.tsx`, `Policies.tsx` (mục 2.1).
- [ ] Dashboard doanh thu: hiển thị `netRevenue`/`refundedAmount`; đổi nhãn `totalPayments` = "số đơn tạo" (mục 2.2).
- [ ] Feedback: chuyển điều kiện sửa/xóa sang `isOwn` (mục 2.3).
- [ ] Avatar: `accept="image/*"` + chặn 5MB + map 3 message (mục 2.5).
- [ ] Điểm danh/lịch học: hiển thị message 409 mới; `SCHEDULE_STATE_CHANGED` ⇒ refetch (mục 2.6).

**Tuỳ chọn (manager):**
- [ ] Nút "Kích hoạt bù" (`POST /payments/{id}/retry-activation`) + badge "Cần đối soát" cho đơn `REQUIRES_REVIEW` (mục 1.2).

### 4.1. Test tay tối thiểu

1. **Chat file:** gửi PNG thật → ảnh hiển thị (không 401); gửi `.txt` → lỗi rõ ràng; mở lại hội thoại cũ có file legacy → hiển thị "không còn khả dụng" (không vỡ UI).
2. **SePay review:** dùng được luồng e2e BE để tạo đơn `REQUIRES_REVIEW` (xem `BE/tests/sepay-payment.e2e.ts` scenario K) → modal hiển thị "Đã nhận thanh toán — đang đối soát", **không** có chữ "đã kích hoạt"; sau khi manager gọi retry → refresh thấy gói ACTIVE.
3. **Payments page:** đơn SePay không có dropdown đổi trạng thái; đơn CASH/BANK_TRANSFER vẫn đổi bình thường.
4. **Đổi mật khẩu:** đổi trên profile → bị đẩy về login; phiên cũ (tab khác) khi refresh API nhận 401 → cũng về login.
5. **Điểm danh:** quét khi buổi ngoài cửa sổ → message "Chưa đến thời gian…"/"Buổi học đã kết thúc…"; HLV chốt ABSENT rồi member quét lại → "Buổi học đã được điểm danh với trạng thái ABSENT…".
6. **Sức chứa/lịch:** giảm capacity lớp dưới chỗ giữ → 400 có message; dời lịch gây trùng → 409 hiển thị danh sách hội viên vướng.
7. **Report:** tạo 1 refund trong kỳ → `totalRevenue` giữ nguyên, `refundedAmount` tăng, `netRevenue` giảm đúng.

---

## 5. Phụ lục

### 5.1. Migration BE đã thêm (đã apply bằng `prisma migrate deploy`)

| Migration | Nội dung |
|---|---|
| `20260927000000_payment_offer_snapshot_activation_status` | `Payment.*Snapshot`, `PaymentActivationStatus`, `reviewReason/reviewedAt/reviewedById`; `MembershipSubscription.maxConcurrentClassesSnapshot` |
| `20260927010000_sepay_bank_ledger_and_notification_outbox` | `SepayBankTransaction` (ledger webhook/đối soát) + `NotificationOutbox` |
| `20260927020000_subscription_cancelled_at` | `MembershipSubscription.cancelledAt` (mốc hủy cho hoàn tiền/analytics) |
| `20260927030000_chat_attachments_private` | Bảng `ChatAttachment` (metadata owner/receiver cho file chat) |

### 5.2. Biến môi trường BE mới

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SEPAY_WEBHOOK_MAX_SKEW_SECONDS` | `3600` | Cửa sổ "tươi" timestamp webhook HMAC (chống replay); `0` = tắt |
| `SEPAY_MOCK_MODE` | `false` | Chỉ bật ở **dev**; production bị chặn cứng (`SEPAY_MOCK_DISABLED`) |

### 5.3. Ghi chú vận hành ảnh hưởng FE

- **Static uploads:** chỉ `/uploads/avatars` còn được phục vụ công khai; file chat đi qua API có auth ⇒ **mọi URL `/uploads/...` cũ trong DB sẽ 404** (FE phải chịu được fallback, xem 1.1).
- **Notification outbox:** row `SENT` chưa có job dọn định kỳ (retention sẽ bổ sung sau) — không ảnh hưởng FE.
- **Job vòng đời gói tập:** chạy lúc boot + mỗi 15 phút; chỉ chạy trong server thật (`BE/src/server.ts`), không chạy trong seed/test.
- **Bộ test BE hiện tại** (đều xanh): `npm run test:e2e:all` gồm quota 382 · attendance 85 · course 84 · sepay 145 · chat 15 · lifecycle 14 checks. Dùng để tái hiện mọi hành vi mô tả trong tài liệu này.

### 5.4. Tài liệu FE cần regenerate sau khi tích hợp

Các file dưới đây đang là bản **cũ trước đợt sửa audit**, nên cập nhật lại từ BE swagger (`/api-docs`) khi xong FE:

- `FE/docs/API_INVENTORY.md`
- `FE/docs/openapi.json`, `FE/docs/openapi-live.json`, `FE/docs/openapi-coach-2026-09-18.json`, `FE/docs/openapi-workflow-2026-09-18.json`
- `FE/docs/WORKFLOW_ALIGNMENT.md` (mục chat/payments/subscriptions)
- `FE/src/shared/operations.json` (nếu regenerate từ swagger)

### 5.5. Đối chiếu nhanh BE ↔ FE khi có tranh chấp

| Hành vi | Nguồn chuẩn (BE) |
|---|---|
| Cửa sổ điểm danh ±30′, chống ghi đè | `BE/src/config/attendance.ts`, `BE/src/modules/attendance/attendance.service.ts` |
| Snapshot offer + REQUIRES_REVIEW + retry | `BE/src/modules/payments/sepay-payments.service.ts` (A06/A07), `payments.routes.ts` |
| File chat riêng tư | `BE/src/modules/chat/chat.controller.ts`, `BE/src/middlewares/upload.ts` |
| Báo cáo doanh thu (gross/refunded/net) | `BE/src/modules/reports/reports.service.ts` |
| Vòng đời gói tập (B07) | `BE/src/modules/subscriptions/subscription-lifecycle.service.ts`, `BE/src/server.ts` |
| Notification outbox | `BE/src/modules/notifications/outbox.service.ts` |









