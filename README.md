# Sports Center Mobile App (pulse. SPORTS CENTER)

Ứng dụng di động dành cho Hội viên (Member) và Huấn luyện viên (Coach) của Hệ thống Quản lý Trung tâm Thể thao **pulse. SPORTS CENTER**, phát triển bằng **React Native**, **Expo** và **TypeScript**.

---

## Hướng dẫn cài đặt và chạy ứng dụng

### 1. Yêu cầu môi trường
- **Node.js**: Phiên bản 18+ hoặc 20+
- **npm** (hoặc `yarn` / `pnpm`)
- Ứng dụng **Expo Go** trên điện thoại (tải từ App Store hoặc Google Play Store), hoặc máy ảo Android Emulator / iOS Simulator.

---

### 2. Cài đặt Dependencies

Di chuyển vào thư mục `MOBILE`:

```bash
cd MOBILE
npm install
```

---

### 3. Cấu hình Biến môi trường (.env)

Tạo file `.env` từ file mẫu `.env.example`:

```bash
# Windows PowerShell
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Nội dung file `.env`:

```env
# Backend API Base URL (Render Server)
EXPO_PUBLIC_API_BASE_URL=https://sports-center-management-system.onrender.com/api/v1
EXPO_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAAFSemj8jOA4n9j1n
EXPO_PUBLIC_TURNSTILE_ORIGIN=https://localhost
```

> **Lưu ý**: Expo đóng gói các biến `EXPO_PUBLIC_` vào bundle. Sau khi thay đổi `.env`, khởi động lại Expo bằng `npx expo start --clear`.

Mobile dùng cùng API với web: `POST /auth/login`, gửi `email`, `password` và `turnstileToken`. Bản web mobile hiển thị Cloudflare Turnstile; Android/iOS dùng WebView. Nút đăng nhập chỉ bật khi đã xác minh, token được thay mới sau mỗi lần gửi. Sau khi đăng ký thành công, ứng dụng chuyển về màn đăng nhập.

Site Key công khai phải cùng widget với web. Hostname chạy mobile web và origin WebView cần được cho phép trong Cloudflare. Không đưa Secret Key vào mobile. Luồng này sử dụng `/auth/login` đang có trên Render, không cần triển khai endpoint mới.

---

### 4. Khởi chạy ứng dụng

Chạy lệnh:

```bash
npx expo start
```

Sau khi server Metro Bundler khởi động:
- **Chạy trên điện thoại thật**: Mở ứng dụng **Expo Go** và quét mã QR hiển thị trên Terminal.
- **Chạy trên Android Emulator**: Nhấn phím `a` trên Terminal.
- **Chạy trên iOS Simulator (chỉ macOS)**: Nhấn phím `i` trên Terminal.
- **Xóa cache nếu gặp lỗi**: `npx expo start -c`

---

## Cấu trúc dự án

```text
MOBILE/
├── app/                  # Route (Expo Router) — CHỈ đọc params + render 1 View, không chứa logic/UI
│   ├── _layout.tsx       # Provider + AuthGuard (chặn theo đăng nhập & vai trò)
│   ├── auth/             # Đăng nhập, đăng ký, quên mật khẩu
│   ├── (tabs)/           # Trang chủ, Tin nhắn, Hồ sơ (+ các tab ẩn: classes, enrollments,
│   │                     #   schedule, notifications, coach-attendance)
│   ├── classes/[id].tsx, schedule/[scheduleId].tsx, payment/[paymentId].tsx, chat/[userId].tsx
│   ├── membership/plans.tsx
│   └── attendance/my.tsx
├── components/
│   ├── shared/           # Dùng chung mọi vai trò (Icon, ScreenHeader, InfoBanner, ScheduleDetailView…)
│   ├── member/           # Màn/khối của Hội viên (membership/, payment/, …)
│   └── coach/            # Màn/khối của Huấn luyện viên (Lịch dạy, Điểm danh, …)
├── hooks/{shared,member,coach}/   # State + business logic (React Query)
├── services/             # Gọi API thuần, đặt tên theo nghiệp vụ (attendanceService, coachService…)
├── navigation/           # routes.ts (ROUTES + quyền theo vai trò), tabConfig, quickAccessConfig
├── constants/            # theme, membership, payment, schedule, attendance — không hard code trong màn
├── lib/                  # api, storage, socket, format, date, businessRules (bản sao FE web), types
└── context/              # AuthContext (phiên đăng nhập, cơ sở)
```

### Quy tắc khi code
1. **Không hard code logic**: số/cấu hình → `constants/`, định dạng & luật nghiệp vụ → `lib/`.
2. **Tách lớp đúng kiến trúc**: `app/` mỏng → `components/` (UI) → `hooks/` (logic) → `services/` (API).
3. **Theo flow của web**: đọc trang FE tương ứng (`FE/src/...`) trước khi làm màn mobile.
4. **Điều hướng** luôn dùng `ROUTES` trong `navigation/routes.ts`; route chỉ dành cho một vai trò
   phải khai báo trong `ROUTE_ROLES` của cùng file.

---

## Kiểm tra TypeScript

Để kiểm tra lỗi type trong toàn bộ dự án:

```bash
npm run typecheck
# hoặc
npx tsc --noEmit
```

## Kiểm thử và đối chiếu với web

```bash
npm test
npx expo export --platform all --output-dir .expo/audit-export
```

Xem [báo cáo đồng bộ Member/Coach](docs/MOBILE_WEB_SYNC_2026-10-12.md) để biết các luồng đã bổ sung, hợp đồng API và giới hạn kiểm chứng thực tế.
