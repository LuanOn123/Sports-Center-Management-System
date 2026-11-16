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
3. Khai báo các biến môi trường cho bản build trên EAS (mục 3.2 — EAS không đọc file `.env`), rồi build bản riêng (cấu hình ở `eas.json`). Chỉ để thử đăng nhập Google thì bản `preview` (APK chạy độc lập, không cần Metro) là đủ:

```bash
npx eas-cli build --profile preview --platform android
```

   Muốn vừa dùng bản riêng vừa sửa code nóng thì dùng profile `development`, cần cài `expo-dev-client` trước:

```bash
npx expo install expo-dev-client
npx eas-cli build --profile development --platform android
```

4. (Chỉ với bản `development`) Chạy Metro bằng `npx expo start --dev-client`. Khi đã cài `expo-dev-client`, lệnh `npx expo start` mặc định mở development build — muốn quay lại Expo Go thì dùng `npx expo start --go`.

SHA-1 cho OAuth client Android: chạy `eas credentials`, chọn Android, profile cần dùng, mục Keystore — EAS hiện SHA-1 của khóa ký (tạo keystore ngay tại đó nếu chưa có). Bản iOS cần thêm tài khoản Apple Developer.

Chọn Google khi chưa có tài khoản → app mời hoàn tất đăng ký (số điện thoại bắt buộc) rồi vào app luôn, giống web.

---

### 3.2. Biến môi trường cho bản build EAS

Máy chủ build của EAS **không đọc file `.env`** (file nằm trong `.gitignore` nên không được tải lên). Bản build thiếu `EXPO_PUBLIC_API_BASE_URL` sẽ báo lỗi ngay khi mở app, thiếu khóa Turnstile thì không đăng nhập bằng email được, thiếu ID Google thì nút Google báo "chưa có cấu hình". Vì vậy mỗi biến phải được khai báo trên EAS; `eas.json` đã gắn ba profile `development`, `preview`, `production` với môi trường EAS cùng tên.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Có | URL backend, không có `/` ở cuối |
| `EXPO_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` | Có | Site Key công khai, cùng widget với web |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Có nếu dùng Google | Web client ID chung với web và BE |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Có cho bản iOS | Cần lúc BUILD: `app.config.js` suy ra URL scheme iOS từ biến này |
| `EXPO_PUBLIC_TURNSTILE_ORIGIN` | Không | Mặc định `https://localhost` |
| `EXPO_PUBLIC_PAYMENT_RETURN_URL` | Không | Xem `.env.example` |
| `EXPO_PUBLIC_SEPAY_MOCK_MODE` | Không | Chỉ `true` cho profile `development`; bản thật để `false` hoặc không khai báo |

`EXPO_TOKEN` chỉ dùng cho CLI trên máy — **không** đưa lên EAS.

Cài EAS CLI một lần, đăng nhập (hoặc đặt `EXPO_TOKEN` trong shell) và gắn thư mục `MOBILE` với một dự án EAS (lần đầu; lệnh ghi `projectId` vào `app.json`):

```bash
npm install -g eas-cli
eas login
eas init
```

Khai báo từng biến cho cả ba môi trường (các giá trị này công khai nên dùng `plaintext`; lặp lại cho các biến khác trong bảng):

```bash
eas env:set --name EXPO_PUBLIC_API_BASE_URL --value "https://sports-center-management-system.onrender.com/api/v1" --environment development --environment preview --environment production --visibility plaintext --non-interactive
eas env:set --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<web client id>.apps.googleusercontent.com" --environment development --environment preview --environment production --visibility plaintext --non-interactive
```

Hoặc đẩy một lần từ file chỉ chứa các biến `EXPO_PUBLIC_*` (đừng đẩy `.env` nguyên bản vì có `EXPO_TOKEN`): `eas env:push preview --path .env.eas`. Kiểm tra bằng `eas env:list preview`.

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
│   ├── (tabs)/           # Tab theo vai trò: index, classes, schedule, chat, account, coach-attendance (+ enrollments ẩn)
│   │                     #   account/ là Stack lồng nhau: menu Tài khoản → Thông tin cá nhân (thanh tab vẫn hiện, tab Tài khoản sáng)
│   ├── notifications.tsx # Thông báo — đẩy lên trên tabs để vuốt từ trái sang phải quay về đúng màn vừa bấm chuông
│   ├── classes/[id].tsx, schedule/[scheduleId].tsx, payment/[paymentId].tsx, chat/[userId].tsx
│   ├── policies.tsx      # Chính sách sử dụng (nội dung ở constants/policies.ts)
│   ├── assistant.tsx     # Màn chat Trợ lý AI (route mỏng, mở từ bong bóng nổi hoặc menu)
│   ├── membership/plans.tsx
│   └── attendance/my.tsx
├── components/
│   ├── assistant/        # Bong bóng AI nổi (kéo thả, dấu "x") + màn chat (tin nhắn, Markdown, ô nhập)
│   ├── shared/           # Dùng chung mọi vai trò (Icon, ScreenHeader, InfoBanner, ScheduleDetailView…)
│   ├── member/           # Màn/khối của Hội viên (membership/, payment/, …)
│   └── coach/            # Màn/khối của Huấn luyện viên (Lịch dạy, Điểm danh, …)
├── hooks/{shared,member,coach}/   # State + business logic (React Query)
├── services/             # Gọi API thuần, đặt tên theo nghiệp vụ (attendanceService, coachService…)
├── navigation/           # routes.ts (ROUTES + quyền theo vai trò), tabConfig, quickAccessConfig, stackOptions (vuốt từ trái sang phải để quay lại — dùng cho mọi Stack)
├── constants/            # theme, membership, payment, schedule, attendance — không hard code trong màn
├── lib/                  # api, storage, socket, format, date, businessRules (bản sao FE web), types
├── context/              # AuthContext (phiên đăng nhập, cơ sở), AssistantContext (cuộc trò chuyện AI)
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

## Trợ lý AI (bong bóng nổi)

Sau khi đăng nhập, một **bong bóng AI** nổi trên mọi màn hình (gắn ở `app/_layout.tsx`, chỉ khi đã đăng nhập):

- **Kéo thả** tới bất kỳ đâu trên màn hình (chỉ giữ trong màn hình, cách mép 8dp); **chạm** để mở màn chat `/assistant`.
- **Dấu "x" nhỏ** ở góc trên-phải: tắt khi bị vướng. Sau **10 giây** bong bóng tự **hiện lại ở vị trí cố định**
  (sát mép phải, tâm ở 80% chiều cao màn hình — trên thanh tab); chỗ đã kéo tới không được nhớ.
- Bong bóng quay vòng khi AI đang trả lời và hiện chấm khi có câu trả lời mới lúc đang ở màn khác.
- Cuộc trò chuyện sống ở `context/AssistantContext.tsx` (chỉ trong bộ nhớ, không ghi ra máy): thoát màn chat rồi vào lại vẫn còn;
  đăng xuất / đổi tài khoản / đổi cơ sở thì xóa. Gọi `POST /ai/chat` (`services/aiService.ts`), gửi kèm tối đa 20 tin gần nhất
  đã được trả lời; tin lỗi có nút "Gửi lại", đang chờ có nút "Dừng"; khối `<think>` của mô hình lập luận bị lọc khỏi câu trả lời.
- Đổi vị trí cố định, thời gian ẩn, kích thước… chỉ cần sửa `constants/assistant.ts`
  (`BUBBLE_DEFAULT_CENTER_Y_RATIO`, `BUBBLE_DEFAULT_SIDE`, `BUBBLE_RESPAWN_MS`, …); hình học thuần ở `lib/assistantBubble.ts`.

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
