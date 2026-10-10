# Cloudflare Turnstile — tích hợp đăng nhập bắt buộc

## 1. Audit kiến trúc

- FE: React 19, Vite, TypeScript. `Session` dùng `features/auth/Login`, `shared/api.ts` và `/auth/me` để chuyển hướng theo `roleHome`.
- Form cũ `pages/auth/LoginPage` + `AuthContext` + `api/auth.api.ts` chưa được mount; vẫn được cập nhật để không bỏ sót client khi tái sử dụng.
- BE: Express 5 + Zod + TypeScript. Một endpoint `POST /api/v1/auth/login` cho mọi role, không có endpoint login riêng từng role.
- Credentials nằm trong MongoDB; mật khẩu kiểm tra bằng bcrypt. JWT access/refresh và bản ghi refresh-token giữ nguyên. Nhánh phục hồi gói FREE của MEMBER giữ nguyên.
- Trước thay đổi, widget chỉ chặn FE khi có site key; BE chưa xác minh và Zod bỏ trường CAPTCHA. Nay BE bắt buộc xác minh.
- Không tìm thấy rate limit/brute-force lockout riêng cho login. Trạng thái khóa tài khoản `isActive` vẫn được kiểm tra; đây không phải rate limit. Không thêm hệ thống giới hạn mới trong phạm vi này.
- BE có Helmet, nhưng chỉ phục vụ API/Swagger/avatar, không phục vụ HTML của FE. Không thấy CSP của host FE trong repository; giữ nguyên Helmet, không nới CSP.

## 2. Thực thi

```text
Login schema (token bắt buộc, trim, 1–2048 ký tự)
→ verifyTurnstile(token)
→ truy vấn tài khoản + kiểm tra trạng thái hiện có + bcrypt
→ ký access/refresh JWT + lưu refresh token
→ FE lấy /auth/me → redirect theo role → kiểm tra phân công cơ sở
```

Payload trên endpoint hiện có:

```json
{ "email": "person@example.com", "password": "...", "turnstileToken": "<fresh widget token>" }
```

`BE/src/modules/auth/turnstile.service.ts` dùng native fetch, POST form-urlencoded `secret` + `response` tới Siteverify. Timeout 8 giây áp dụng cả đọc response; không tự retry, không theo redirect. Chỉ chấp nhận `success === true` và `action === "login"`. Token hết hạn/dùng lại do Cloudflare từ chối; không dùng cache kết quả thành công. Không có bypass theo môi trường hoặc role.

Không gửi `remoteip`: ứng dụng chưa cấu hình proxy tin cậy, không lấy IP từ header do client tự gửi. Hostname phải được giới hạn trong cấu hình widget ở Cloudflare; service chưa có danh sách hostname riêng vì chưa có domain triển khai được xác nhận.

## Tình trạng local hiện tại

Trang đang chạy ở `http://127.0.0.1:5173/login`. Sau khi sửa SDK loader, widget phản hồi mã Cloudflare **110200 (Domain not authorized)**: site key hoạt động nhưng hostname hiện tại chưa nằm trong Hostname Management của widget. Thêm `127.0.0.1` và `localhost` để thử local; thêm hostname FE production cho site thật. Thay đổi này phải thực hiện trong Cloudflare dashboard, không phải trong source code. [Cloudflare error codes](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/), [Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

## 3. FE, trạng thái và theme

- Shared widget được lazy-load trên form chính; SDK chính thức tải từ `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`.
- Widget nằm sau mật khẩu/trước nút đăng nhập, action `login`, giữ theme dark trên form chính và theme light vốn có trên form legacy.
- Token chỉ nằm trong React state, không ghi vào storage/cookie.
- Hết hạn, timeout, lỗi SDK hoặc trình duyệt không hỗ trợ đều xóa token và hiển thị thông báo an toàn/nút thử lại.
- Sau mỗi lần gửi đăng nhập, xóa token và mount widget mới. Nhập sai mật khẩu không tái sử dụng token cũ; giữ nội dung form.
- Thiếu public site key: hiển thị lỗi cấu hình, nút đăng nhập bị khóa; không bỏ CAPTCHA.
- ≤380px dùng compact 150×140; rộng hơn dùng flexible với min-width 300px. Không sửa width của login card hay theme CSS hiện có.

## 4. Lỗi API

| Tình huống | Kết quả |
| --- | --- |
| Thiếu/null/rỗng/quá dài token | 400 từ validation |
| CAPTCHA không hợp lệ/hết hạn/dùng lại/sai action | 400, yêu cầu xác minh lại |
| Thiếu secret, network, timeout, HTTP upstream lỗi, JSON sai cấu trúc | 503, xác minh tạm thời không khả dụng |
| CAPTCHA hợp lệ, sai credentials | 401 như trước |
| CAPTCHA hợp lệ, tài khoản ngừng hoạt động | 403 như trước |

Lỗi xác minh kết thúc trước truy vấn credentials/cấp JWT/lưu phiên. Không chuyển nguyên lỗi Cloudflare, secret hay token vào response/log. Controller vẫn dùng error envelope chung.

## 5. Cấu hình chủ dự án

Frontend (public, dùng lúc build):

```dotenv
VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAAFSemj8jOA4n9j1n
```

Đã có public key trong `.env.example`, `.env.development`, `.env.production`; biến môi trường của host có thể override. Tên biến cũ `VITE_TURNSTILE_SITE_KEY` không còn dùng.

Backend (chỉ ở runtime BE/Render Environment hoặc `BE/.env` được Git ignore):

```dotenv
CLOUDFLARE_TURNSTILE_SECRET_KEY=<OWNER_PROVIDED_SECRET>
```

`BE/.env.example` chỉ khai báo trống. Không thay đổi `.env` thật. Audit thấy local BE đã có giá trị cho biến này, nhưng không in/chép secret và chưa xác nhận đó là secret đúng cặp site key trên production.

### Triển khai

1. Xác nhận secret BE thuộc đúng widget có site key bên trên.
2. Trong Cloudflare Turnstile, cho phép các hostname FE thực tế; thêm localhost/127.0.0.1 nếu cần kiểm thử local với widget này.
3. Cấu hình secret trên host BE và restart/redeploy BE; thiếu secret thì mọi login bị từ chối 503.
4. Deploy FE mới đồng bộ với BE vì request login cũ không có token sẽ bị từ chối. Rebuild FE khi đổi public key; không chỉ restart static host.
5. BE cần outbound HTTPS tới `challenges.cloudflare.com`.
6. Nếu CDN/host FE đang áp CSP ngoài repository, bổ sung riêng `https://challenges.cloudflare.com` vào `script-src` và `frame-src`, giữ các origin hiện có; không dùng wildcard. Với pre-clearance, đối chiếu thêm yêu cầu `connect-src` trong docs Cloudflare.
7. Smoke-test bằng widget thật + tài khoản thử trên domain triển khai. Kiểm tra login sai/đúng, hết hạn, từng role và coach chưa được phân công.

## 6. File thay đổi trong phần Turnstile

- BE: `src/config/env.ts`; `src/modules/auth/{auth.schema,auth.controller,auth.service,auth.routes,turnstile.service}.ts`; `.env.example`; `package.json`.
- FE: `src/features/auth/{Login,Session,Turnstile}.tsx`, `turnstile.css`; `src/shared/{api,turnstileConfig}.ts`; `src/api/auth.api.ts`; `src/pages/auth/LoginPage.tsx`.
- Contract được sinh từ Swagger local: `src/shared/generated.ts`, `src/shared/operations.json`, `docs/openapi.json`, `docs/API_INVENTORY.md`.
- FE config: `.env.example`, `.env.development`, `.env.production`, `playwright.turnstile.config.ts`, `playwright.config.ts`, `package.json`.
- Tests: `BE/tests/turnstile.integration.test.ts`; fixture login trong `BE/tests/membership-reports.integration.ts`; `FE/tests/turnstile-config.test.ts`; `FE/tests/browser/turnstile.spec.ts`.
- Những thay đổi coach/dashboard đã có trong working tree không thuộc phần CAPTCHA.

## 7. Kiểm chứng

- BE `npm run test:captcha`: 27/27 (26 ca + suite). Gọi HTTP thật tới auth router/controller/service, giữ bcrypt/JWT thật; mock database và Cloudflare trong process test. Kiểm tra thứ tự thực thi, thiếu/giả/hết hạn/replay token, response không hợp lệ, outage, timeout 8 giây, thiếu secret, sai password, tài khoản inactive và JWT của 5 role.
- Đã gọi service BE với token giả tới Cloudflare thật: bị từ chối 400. Chưa kiểm thử thành công bằng widget thật/tài khoản thật trên domain triển khai.
- FE `npm run verify`: conflict check, typecheck, 103 unit tests, production build đều đạt.
- BE `npm run build`: Prisma generate + TypeScript đạt; không migrate/ghi database.
- FE `npm run test:captcha`: 14/14; ADMIN/MANAGER/RECEPTIONIST/COACH/MEMBER, expired/reset/SDK error, coach chưa có cơ sở, kích thước 320/375/430/768/1440. Sau khi mô phỏng đúng kích thước widget, chạy lại 5 ca responsive đều đạt; ảnh 320/1440 đã kiểm tra.
- Browser tests mock SDK/API, không chứng minh Cloudflare production đã được cấu hình đúng. Test unassigned coach từng timeout trong lần chạy cùng build; chạy riêng và chạy lại cả suite đều đạt.
- Build FE có cảnh báo một chunk khoảng 500.14 kB, không phải lỗi compile.
- Typecheck riêng hai file test BE đã sửa cũng đạt.
- Không có lint script trong package.json. Không chạy các integration suite cần database thật; fixture MF-08 đã được cập nhật để gửi token qua mock chỉ trong test.
- Các API test/công cụ ngoài ứng dụng gọi login nay cũng phải gửi token mới hợp lệ. Không tạo ngoại lệ cho client cũ.

## 8. Audit cuối

**THEME CHANGE AUDIT: NONE** — không đổi CSS/theme có sẵn, màu, font, nền, button/input hoặc AuthLayout. CSS widget chỉ xử lý kích thước/khoảng cách.

**SECRET EXPOSURE AUDIT:** không có biến secret BE trong FE source/build; đối chiếu giá trị secret local với tracked files và FE build cho 0 kết quả. Không có `.env` thật trong tracked files. Không tạo commit trong tác vụ này; không thêm secret thật vào source hoặc docs. Test secret sinh ngẫu nhiên trong process test.

## Tài liệu chính thức

- [Server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/)
