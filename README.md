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
```

> **Lưu ý**: Biến môi trường trong Expo bắt buộc phải có tiền tố `EXPO_PUBLIC_` để app có thể đọc được lúc runtime.

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
├── app/                  # File-based routing (Expo Router)
│   ├── (tabs)/           # 6 Tab chính: Home, Classes, Schedule, Training, Notifications, Profile
│   ├── auth/             # Màn hình Đăng nhập & Đăng ký
│   ├── classes/          # Chi tiết lớp học & Đặt lịch
│   ├── membership/       # Gói hội viên & Đăng ký gói
│   └── schedule/         # Chi tiết lịch học
├── constants/            # Theme màu sắc (Dark Mode/Lime), Font chữ
├── context/              # AuthContext (Xác thực & Lưu phiên đăng nhập)
├── lib/                  # HTTP Client (api.ts), Secure Storage (storage.ts), Types (types.ts)
├── .env.example          # Mẫu cấu hình môi trường
└── app.json              # Cấu hình Expo app
```

---

## Kiểm tra TypeScript

Để kiểm tra lỗi type trong toàn bộ dự án:

```bash
npm run tsc -- --noEmit
# hoặc
npx tsc --noEmit
```
