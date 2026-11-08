# Sports Center Mobile App (pulse. SPORTS CENTER)

Ứng dụng di động dành cho Hội viên (Member) và Huấn luyện viên (Coach) của Hệ thống Quản lý Trung tâm Thể thao **pulse. SPORTS CENTER**, phát triển bằng **React Native**, **Expo** và **TypeScript**.

---

## Hướng dẫn cài đặt và chạy ứng dụng

### 1. Yêu cầu môi trường
- **Node.js**: 22.13+ hoặc 24.3+ (React Native 0.88 yêu cầu; nên dùng Node 24 LTS)
- **npm** (hoặc `yarn` / `pnpm`)
- Ứng dụng **Expo Go** trên điện thoại (tải từ App Store hoặc Google Play Store), hoặc máy ảo Android Emulator / iOS Simulator.
  Đăng nhập bằng Google **không chạy trong Expo Go** — xem mục "Đăng nhập bằng Google" bên dưới.

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

Đăng ký (`POST /auth/register`) **bắt buộc số điện thoại**; giới tính, ngày sinh (tuổi 12–80 theo quy tắc của mobile) và mục tiêu là tùy chọn.

---

### 3.1. Đăng nhập / đăng ký bằng Google (development build)

Mobile gọi `POST /auth/google-login` và `POST /auth/google-register` với **Google ID token**. Thư viện `@react-native-google-signin/google-signin` cần code native nên **không chạy trong Expo Go** (nút Google vẫn hiện, bấm vào sẽ giải thích). Email và mật khẩu hoạt động bình thường ở mọi bản chạy.

1. Trên Google Cloud, dùng chung dự án với web: lấy **Web client ID** (đúng giá trị `VITE_GOOGLE_CLIENT_ID` của web và `GOOGLE_CLIENT_ID` của BE — BE chỉ nhận ID token có audience này), tạo thêm OAuth client **Android** (package `com.pulsecenter.mobile` + SHA-1 của khóa ký) và **iOS** (bundle `com.pulsecenter.mobile`).
2. Điền vào `.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` và (chỉ cho iOS) `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. `app.config.js` tự suy ra URL scheme của iOS từ iOS client ID và thêm config plugin Google.
3. Cài `expo-dev-client` rồi build bản riêng bằng EAS (cấu hình ở `eas.json`):

```bash
npx expo install expo-dev-client
npx eas-cli build --profile development --platform android
```

4. Chạy Metro cho development build bằng `npx expo start --dev-client`. Khi đã cài `expo-dev-client`, lệnh `npx expo start` mặc định mở development build — muốn quay lại Expo Go thì dùng `npx expo start --go`.

Chọn Google khi chưa có tài khoản → app mời hoàn tất đăng ký (số điện thoại bắt buộc) rồi vào app luôn, giống web.

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
│   ├── auth/             # Đăng nhập, đăng ký, hoàn tất đăng ký Google, quên mật khẩu
│   ├── (tabs)/           # Trang chủ, Tin nhắn, Hồ sơ (+ các tab ẩn: classes, enrollments,
│   │                     #   schedule, notifications, coach-attendance)
│   ├── classes/[id].tsx, schedule/[scheduleId].tsx, payment/[paymentId].tsx, chat/[userId].tsx
│   ├── policies.tsx      # Chính sách sử dụng (nội dung ở constants/policies.ts)
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
├── context/              # AuthContext (phiên đăng nhập, cơ sở)
├── app.config.js         # Cấu hình Expo động: thêm config plugin Google khi có iOS client ID
└── eas.json              # Profile build EAS (development / preview / production)
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

Bộ test hợp đồng (`tests/mobile-contract.test.cjs`) chạy các service và luật nghiệp vụ thật với máy chủ HTTP giả cục bộ, không cần BE và không chạm database.
Khi BE đổi hợp đồng (route, body, mã lỗi) hoặc web đổi luồng, cập nhật mobile theo web rồi thêm/sửa test tương ứng.
