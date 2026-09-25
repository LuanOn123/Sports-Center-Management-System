# Sports Center Management System - Backend

Welcome to the **Sports Center Management System** backend repository. This backend provides a robust REST API for managing users, memberships, class scheduling, and payments for a multi-platform sports center application (Web & Mobile).

## 🚀 Technologies

This project is built using modern Node.js tools and practices:
- **Runtime:** Node.js
- **Framework:** Express.js (v5)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** Zod
- **Authentication:** JWT (JSON Web Tokens) with Access & Refresh tokens
- **API Documentation:** Swagger UI
- **Tooling:** `tsx` for local execution, `helmet` & `cors` for security.

## 📦 Project Structure

```
.
├── prisma/               # Prisma schema and migrations
├── src/
│   ├── config/           # App configuration (Swagger, DB connections, etc.)
│   ├── middlewares/      # Express middlewares (Auth, Error Handler, Zod Validation)
│   ├── modules/          # Feature modules (Controllers, Routes, Services, Schemas)
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Helper utilities (Bcrypt, JWT, Pagination, Response)
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
```

### Core Modules (`src/modules/`)
- **`auth/`**: Registration, Login, Token Management, Password changes.
- **`users/` & `members/` & `coaches/`**: User lifecycle and role-specific profiles.
- **`membership-plans/` & `subscriptions/`**: Subscription tiers (FREE, MEMBERSHIP, PREMIUM) and plan management.
- **`sports/` & `rooms/` & `classes/` & `class-schedules/`**: Core catalog and timetabling.
- **`enrollments/`**: Complex booking logic including capacity, tier, and time-conflict checks.
- **`payments/` & `invoices/`**: Payment tracking and automated invoice generation.
- **`reports/`**: Aggregation APIs for analytics (Revenue, Enrollments, Subscriptions).

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory and add the following variables (adjust according to your setup):
   ```env
   PORT=3000
   DATABASE_URL="postgresql://user:password@localhost:5432/sport_center?schema=public"
   JWT_ACCESS_SECRET="your_access_secret"
   JWT_REFRESH_SECRET="your_refresh_secret"
   JWT_ACCESS_EXPIRES_IN="15m"
   JWT_REFRESH_EXPIRES_IN="7d"

   # ── SePay online payment (chuyển khoản VietQR + webhook) ──
   # Hội viên tự mua gói: BE tạo đơn PENDING + mã thanh toán + ảnh VietQR;
   # SePay gọi webhook khi phát hiện giao dịch ⇒ BE kích hoạt gói + tạo hóa đơn + thông báo.
   SEPAY_WEBHOOK_API_KEY=""            # API key ở bước "Bảo mật" khi tạo webhook trên my.sepay.vn
   SEPAY_QR_BASE_URL="https://qr.sepay.vn/img"
   SEPAY_QR_TEMPLATE="compact"         # compact | qronly | standee | (trống = QR chuẩn VietQR)
   SEPAY_CODE_PREFIX="SEVQR"           # khớp "Cấu trúc mã thanh toán" trên my.sepay.vn (tiền tố 2-5 ký tự)
   SEPAY_CODE_SUFFIX_LENGTH="8"        # hậu tố số, SePay khuyến nghị 6-8
   VIETQR_BANK_ID="Sacombank"          # short_name/alias/code/BIN trong banks.json của SePay
   VIETQR_ACCOUNT_NO="0703339186"      # số tài khoản (hoặc VA) nhận tiền
   VIETQR_ACCOUNT_NAME="NGUYEN TRAN TU"
   VIETQR_PAYMENT_TTL_MINUTES="15"
   SEPAY_MOCK_MODE="true"              # BẮT BUỘC false ở production
   ```

   *SePay chi tiết:* https://developer.sepay.vn — cấu hình tại my.sepay.vn:
   1. **Cấu hình Công ty → Cấu trúc mã thanh toán**: tiền tố `SEVQR`, hậu tố 6-8 ký tự, Loại ký tự **Số nguyên**
      (khớp `SEPAY_CODE_PREFIX` / `SEPAY_CODE_SUFFIX_LENGTH`). Mã đơn BE sinh có dạng `SEVQR12345678`.
   2. **Webhook**: URL `http://<server>/api/v1/payments/sepay/webhook`, chọn xác thực **API Key** và dán key vào
      `SEPAY_WEBHOOK_API_KEY`; bật "Chỉ gửi khi có mã thanh toán: Tiền vào".
   Chạy localhost thì SePay **không gọi được** webhook ⇒ expose BE bằng ngrok, hoặc để `SEPAY_MOCK_MODE=true`
   và xác nhận giao dịch bằng `POST /payments/sepay/mock-confirm` (dev/demo/e2e).
   Giá trị mặc định của từng biến nằm trong `src/config/sepay.ts`.


3. **Database Setup:**
   Run Prisma migrations to set up your PostgreSQL database schema:
   ```bash
   npm run db:migrate
   ```
   *(Optional)* Seed the database with initial data:
   ```bash
   npm run db:seed
   ```

### Running the Application

- **Development Mode:**
  ```bash
  npm run dev
  ```
  The server will start with hot-reloading using `tsx`.

- **Production Build:**
  ```bash
  npm run build
  npm start
  ```

## 📚 API Documentation

Once the server is running, you can view the interactive Swagger API documentation by navigating to:
👉 `http://localhost:<PORT>/api/v1/docs`

## 🗄️ Useful Prisma Scripts

- `npm run db:migrate` - Apply migrations to the database.
- `npm run db:generate` - Generate Prisma Client.
- `npm run db:studio` - Open Prisma Studio to view and edit data visually via browser.
- `npm run db:reset` - Reset the database and re-apply all migrations.

## 🤝 Project Flows (Implemented)
- **Flow 1: User & Membership Management:** Fully functional with tier-based validations.
- **Flow 2: Class Booking & Schedule:** Built with robust logic for conflict handling and capacity limits.
- **Flow 3: Payment & Reports:** End-to-end payment lifecycle and dashboard analytics.

*(Note: AI Workouts, AI Assistant, and advanced Attendance features are planned for future phases).*
