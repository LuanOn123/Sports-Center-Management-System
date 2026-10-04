# Luồng FE tích hợp API Avatar (upload ảnh đại diện)

> BE đã hoàn tất: `POST /api/v1/auth/me/avatar` (multipart, field `avatar`) — lưu Cloudinary
> (hoặc local `uploads/avatars` tuỳ env `AVATAR_STORAGE`), trả về **profile đầy đủ** như `GET /auth/me` kèm `avatarUrl`.
> Tài liệu này dành cho FE (React + React Query + helper `src/shared/api.ts`). BE không cần đổi gì thêm.

## 1. Contract

| Mục | Giá trị |
|---|---|
| Endpoint | `POST /auth/me/avatar` |
| Auth | Bearer access token — mọi role, chỉ đổi avatar của chính mình |
| Body | `multipart/form-data`, đúng 1 field tên **`avatar`** = File ảnh |
| Ảnh hợp lệ | `image/jpeg` / `image/png` / `image/webp` / `image/gif`, **≤ 5MB** |
| Response 200 | `{ success, message, data: <profile giống GET /auth/me, có avatarUrl> }` |
| Lỗi | `400` thiếu file / sai định dạng / quá 5MB · `401` token · `404` user · `502` lỗi Cloudinary |

`avatarUrl` là **URL tuyệt đối** (Cloudinary CDN), có tham số `v...` (version) → URL đổi mỗi lần thay ảnh
nên browser tự tải ảnh mới, **không cần cache-busting ở FE**. Khi chưa cấu hình cloud, URL là
`http(s)://<host>/uploads/avatars/<file>` (filename cũng mới mỗi lần upload).

## 2. Luồng tổng thể

```
FE                                                             BE
 │ chọn file (input type=file, accept=image/*)                   │
 │ validate client: đúng 4 MIME + size ≤ 5MB                     │
 │ FormData.set("avatar", file)                                  │
 ├── POST /auth/me/avatar (Bearer; KHÔNG tự set Content-Type) ──▶ multer memoryStorage (5MB, image-only)
 │                                                                 │ adapter chọn nơi lưu:
 │                                                                 ├─ Cloudinary: resize 512x512, q_auto/f_auto,
 │                                                                 │   public_id = userId ⇒ upload lại GHI ĐÈ
 │                                                                 └─ local: uploads/avatars + xoá file cũ
 │                                                                 │ User.avatarUrl = URL mới
 │◀── 200 { data: profile có avatarUrl } ──────────────────────────┘
 │ đồng bộ state:
 │   • Member portal : updateUser(updated)                      (context/AuthContext)
 │   • Portal chung  : queryClient.invalidateQueries({queryKey:["me"]})   (Session.tsx)
 │ <img src={user.avatarUrl}> ở profile / header / (chat nếu có)
```

## 3. Cập nhật contract FE (bắt buộc trước khi gọi qua `api()`)

`src/shared/api.ts` chặn mọi operation không có trong `operations.json` (báo `Undocumented operation`).
Chọn 1 trong 2 cách:

### Cách A — không cần deploy BE (khuyến nghị cho dev local)

Thêm vào `FE/docs/workflow-contract-overrides.json` (file merge trong `npm run generate:api`):

```json
"POST /auth/me/avatar": {
  "path": "/auth/me/avatar",
  "method": "POST",
  "summary": "Upload avatar image for the current user profile",
  "security": [{ "bearerAuth": [] }],
  "parameters": [],
  "body": {
    "type": "object",
    "properties": { "avatar": { "type": "string", "format": "binary" } },
    "required": ["avatar"]
  },
  "statusCodes": ["200", "400", "401", "404", "500"]
}
```

rồi chạy `npm run generate:api` → cập nhật `src/shared/operations.json`, `src/shared/generated.ts`, `docs/API_INVENTORY.md`.

### Cách B — sau khi BE deploy lên Render

`npm run generate:api -- --live` (script fetch swagger từ production rồi regenerate). Khi đó `generated.ts`
cũng có `ProfileOk` kèm `avatarUrl`.

## 4. Types (FE)

`src/types/member.ts` → `interface User` thêm 1 dòng:

```ts
avatarUrl?: string | null;
```

## 5. API layer (FE)

`src/api/auth.api.ts` — thêm method vào `authApi`:

```ts
import { api } from "../shared/api"; // đã import sẵn nếu file đang dùng apiClient

async uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.set("avatar", file); // ĐÚNG tên field BE nhận
  const r = await api<User>("POST /auth/me/avatar", { body: form });
  return r.data;
}
```

Ghi chú:

- `api()` **đã hỗ trợ `FormData`** (không set `Content-Type`, không stringify) và tự refresh token khi 401 —
  dùng y hệt cách chat đang gửi file: `api("POST /chat/messages", { body })` trong `shared/Communication.tsx`.
- **Không dùng `apiClient.post`** (`src/api/client.ts`) cho upload: helper đó `JSON.stringify` body nên không gửi được file.
  Nếu muốn dùng chung, thêm method `postForm` truyền thẳng `FormData` xuống `api()`.

## 6. UI — ví dụ hoàn chỉnh (Member: `src/pages/member/ProfilePage.tsx`)

Tái sử dụng pattern `useState` + `AlertBanner` sẵn có của trang:

```tsx
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { authApi } from "../../api/auth.api";
import { useAuth } from "../../context/AuthContext";

const MAX_AVATAR_MB = 5;
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function AvatarUploader() {
  const { user, updateUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pick = async (file?: File) => {
    if (!file || uploading) return;
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type))
      return setMsg({ type: "error", text: "Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF." });
    if (file.size > MAX_AVATAR_MB * 1024 * 1024)
      return setMsg({ type: "error", text: `Ảnh tối đa ${MAX_AVATAR_MB}MB.` });

    setUploading(true);
    setMsg(null);
    try {
      const updated = await authApi.uploadAvatar(file); // 200 ⇒ profile mới có avatarUrl
      updateUser(updated); // context + cache ["me"] đồng bộ ngay
      setMsg({ type: "success", text: "Cập nhật ảnh đại diện thành công!" });
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Tải ảnh thất bại." });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = ""; // cho phép chọn lại đúng file đó
    }
  };

  return (
    <div className="avatar-uploader">
      <button type="button" className="avatar" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="Ảnh đại diện" />
        ) : (
          <span>{user?.fullName.slice(0, 1)}</span>
        )}
        <i>
          <Camera size={14} /> {uploading ? "Đang tải..." : "Đổi ảnh"}
        </i>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {msg && <p className={msg.type === "success" ? "success" : "error"}>{msg.text}</p>}
    </div>
  );
}
```

CSS `object-fit: cover; border-radius: 50%` cho `img` — có thể thêm vào file CSS sẵn có của trang.

## 7. Đồng bộ state sau upload

| Khu vực | Cách cập nhật (đã có sẵn pattern trong repo) |
|---|---|
| Member portal | `updateUser(updated)` — `MemberSessionProvider` trong `context/AuthContext.tsx` cũng ghi lại cache `["me"]` |
| Portal chung (dùng `useQuery(["me"])` ở `features/auth/Session.tsx`) | `queryClient.invalidateQueries({ queryKey: ["me"] })` — giống `shared/Profile.tsx` |
| Coach profile | idem (invalidate `["me"]` như `features/coach/CoachProfile.tsx`) |

## 8. Hiển thị avatar ở nơi đang dùng chữ cái đầu

Gợi ý component dùng chung `src/shared/UserAvatar.tsx`:

```tsx
import { useState } from "react";

export function UserAvatar({
  user,
  size = 35,
}: {
  user?: { fullName: string; avatarUrl?: string | null } | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  if (user?.avatarUrl && !broken)
    return (
      <img
        className="avatar"
        width={size}
        height={size}
        style={{ objectFit: "cover" }}
        src={user.avatarUrl}
        alt={user.fullName}
        onError={() => setBroken(true)} // URL hỏng ⇒ fallback chữ cái đầu
      />
    );
  return <span className="avatar">{user?.fullName?.slice(0, 1) ?? "?"}</span>;
}
```

Các điểm cần thay (đang `fullName.slice(0,1)` / `.slice(0,2)`):

- `src/shared/PortalLayout.tsx` (header portal chung)
- `src/layouts/MemberLayout.tsx` (header member)
- `src/shared/Profile.tsx`, `src/pages/member/ProfilePage.tsx`, `src/features/coach/CoachProfile.tsx`
- `src/shared/Communication.tsx` (chat) — xem mục 9
- Danh sách: `src/features/coach/CoachWorkspace.tsx`, `src/features/manage/ResourcePage.tsx` — dữ liệu **đã có `avatarUrl`**
  từ `GET /members`, `GET /coaches`, `GET /users`, `GET /members/:id`, `GET /coaches/:id`.

## 9. Chat & các API khác (tuỳ chọn)

- `GET /chat/contacts` **chưa** trả `avatarUrl` → muốn avatar thật trong chat, BE chỉ cần thêm `avatarUrl: true`
  vào select contacts (1 dòng, báo nếu cần).
- `GET /users`, `GET /members`, `GET /coaches`, `GET /members/:id`, `GET /coaches/:id`: **đã trả `avatarUrl`**.

## 10. (Tuỳ chọn) Map lỗi Cloudinary sang tiếng Việt

BE trả 502 với message tiếng Anh (`Avatar upload to Cloudinary failed: ...`). Muốn toast tiếng Việt, thêm vào
`src/shared/apiErrors.ts`:

```ts
if (/cloudinary/i.test(message))
  return { message: "Không thể lưu ảnh lên kho đám mây. Vui lòng thử lại.", errors: [] };
```

## 11. Checklist test FE

1. Upload JPG mới → toast thành công, ảnh hiện ngay ở profile + header (URL có `v...`).
2. Thay ảnh lần 2 → ảnh cũ biến mất, URL mới (không bị cache).
3. Chọn `.txt`/PDF → FE chặn (và BE cũng trả 400 nếu vượt qua FE).
4. File > 5MB → FE chặn; nếu vượt → BE 400 `Avatar image must be at most 5MB`.
5. Ngắt mạng → toast lỗi mạng, ảnh cũ giữ nguyên.
6. Access token hết hạn → transport tự refresh rồi retry upload (không cần code thêm).
7. URL ảnh hỏng → fallback chữ cái đầu nhờ `onError`.
