# Kiểm tra đặt chỗ giữa các cơ sở — 06/10/2026

> ## ⚠️ CẬP NHẬT 2026-10-06 — phần SCOPE CỦA GÓI trong tài liệu này đã lỗi thời
>
> Sau đợt **Global Membership** (`MembershipSubscription` không còn thuộc `facilityRoots`):
> - **ĐÃ SAI:** các câu *"DAL tự lọc gói và quota theo cơ sở"*, *"Gói tại A không cấp quyền đặt chỗ ở B"*,
>   *"quyền hiện dựa vào gói tại từng cơ sở"*. Giờ **gói / tier / hạn / quota đều GLOBAL** —
>   hội viên mua ở cơ sở A đặt được ở cơ sở B, C.
> - **VẪN ĐÚNG và còn nguyên:** kiểm tra **trùng giờ là GLOBAL**; `Class` / `Room` / `ClassSchedule` /
>   `Enrollment` / `Attendance` vẫn **FACILITY-scoped**; doanh thu vẫn theo cơ sở phát hành.
> - Nguồn chính hiện tại: `docs/MEMBERSHIP_FACILITY_COMPREHENSIVE_AUDIT_2026-10-06.md` (§2, §16).
>
> Phần bên dưới được giữ nguyên như biên bản điều tra cũ.

Phạm vi: source `main` và kiểm thử service thật với PostgreSQL schema thử có tiền tố `scms_verify_`. Không tạo đặt chỗ hoặc đổi lịch trên database chính/Render.

## Logic đã có trong source

- Một memberProfile dùng chung; MembershipSubscription có `facilityId` — **chỉ là ORIGIN (nơi phát hành) cho báo cáo**, không còn là phạm vi hiệu lực. ~~DAL tự lọc gói và quota theo cơ sở trong requestContext.~~ **(ĐÃ SAI — entitlement/quota là GLOBAL.)**
- ~~Gói tại A không cấp quyền đặt chỗ ở B.~~ **(ĐÃ SAI — gói tại A cấp quyền đặt chỗ ở B/C khi còn hiệu lực và còn quota.)** MEMBER chọn cơ sở nào cũng đặt được nếu có gói phù hợp.
- `assertCanBook` kiểm tra trùng giờ bằng truy vấn Enrollment của chính member, bỏ riêng bộ lọc facilityId. Hai buổi giao nhau khi `old.startTime < new.endTime` và `old.endTime > new.startTime`.
- `evaluateCourseEligibility` cũng kiểm tra lịch member trên toàn hệ thống và trả blocker TIME_CONFLICT. Việc đăng ký toàn khóa kiểm tra lại sau lock và rollback toàn bộ khi không đủ điều kiện.
- Booking, whole-course và transfer dùng cùng advisory lock theo memberId, không chứa facilityId; hai request đặt đồng thời ở hai cơ sở vẫn phải xếp hàng.
- Transfer chỉ đổi buổi trong cùng lớp; dùng lại assertCanBook nên không thể đổi sang buổi trùng với chỗ tại cơ sở khác.
- Gói phải đủ hạn đến hết buổi cuối của khóa. ~~Hạng PREMIUM không tự cấp quyền liên cơ sở.~~ **[ĐÃ LỖI THỜI — tier/entitlement là GLOBAL, không giới hạn theo cơ sở.]**

## Lỗi phát hiện và thay đổi

`assertScheduleMoveKeepsBookingsValid` trước đây truy vấn Enrollment bằng context của cơ sở đang dời lịch. Nó bỏ sót chỗ member đã đặt tại cơ sở khác, dù booking ban đầu đã được kiểm tra đúng.

Đã thêm context không lọc cơ sở **chỉ cho truy vấn phát hiện trùng lịch của các member bị ảnh hưởng**. ~~Truy vấn quyền lợi gói vẫn giữ scope của cơ sở có buổi bị dời; không dùng gói tại A để hợp thức hóa buổi ở B.~~ **[ĐÃ LỖI THỜI — entitlement/quota là GLOBAL; chỉ conflict lookup là global.]**

Test trước sửa tái hiện lỗi: các case booking/whole-course/transfer qua, nhưng dời lịch trùng khác cơ sở không bị từ chối (`Missing expected rejection`).

## Ca kiểm thử hồi quy

Lệnh từ BE: `npm run test:operations:cross-facility`.

Kết quả sau sửa: toàn bộ các trường hợp dưới đây đã qua, tiến trình kết thúc với exit code 0; fixture đã được dọn. TypeScript BE `npx tsc --noEmit` cũng qua.

1. ~~Chỉ có gói A, đặt tại B → 403.~~ **[ĐÃ LỖI THỜI — giờ được phép; test đã đổi thành “một gói duy nhất đặt được ở mọi cơ sở”.]**
2. Có gói A và B, đã đặt A, đặt B trùng giờ → 409.
3. Đăng ký trọn khóa B có buổi trùng A → 409.
4. A kết thúc đúng lúc B bắt đầu → cho phép. Chuyển chỗ B sang buổi trùng A → 409, giữ nguyên chỗ cũ.
5. Quản lý dời buổi B đã có booking sang giờ trùng A → 409, giữ nguyên giờ cũ.
6. Hai request đặt A/B trùng giờ chạy đồng thời → đúng một request thành công và một chỗ được tạo.

Test dùng hai HLV và hai phòng riêng để không nhầm lỗi trùng tài nguyên với lỗi trùng lịch hội viên. Fixture được xóa sau khi chạy. Kiểm tra TypeScript BE đã qua.

## Phần giao diện/chính sách chưa có như đề xuất trước

- ~~“Lịch của tôi” đang gọi GET /enrollments/my với header cơ sở đang chọn; kết quả vẫn theo cơ sở, chưa phải lịch tổng hợp mọi cơ sở.~~ **[ĐÃ SỬA (MF-03) — `GET /enrollments/my` giờ trả lịch cá nhân GLOBAL, nhất quán với quota.]**
- Bộ chọn cơ sở dùng nhãn chung “Cơ sở đang làm việc”, chưa đổi riêng thành “Cơ sở tập luyện” cho MEMBER.
- Chưa có thời gian đệm di chuyển giữa cơ sở; lịch chỉ chạm biên được phép đăng ký.
- ~~Chưa có sản phẩm gói liên cơ sở riêng; quyền hiện dựa vào gói tại từng cơ sở.~~ **[ĐÃ LỖI THỜI — không cần “gói liên cơ sở riêng”: Membership đã là GLOBAL dùng được ở mọi facility.]**

Không suy ra BE Render đã có cùng hành vi chỉ từ source main. Lượt kiểm thử này không xác minh deployment production. Ca chạy đồng thời ở đây kiểm tra hai request đặt chỗ; không kiểm chứng mọi tổ hợp đồng thời giữa quản lý dời lịch và các request nghiệp vụ khác.
