-- Global Membership scope (2026-10-06).
-- MembershipSubscription là GLOBAL cho hội viên; `facilityId` chỉ còn là ORIGIN facility
-- (cơ sở phát hành gói) dùng cho báo cáo/audit — KHÔNG còn là phạm vi hiệu lực của gói.
--
-- An toàn với dữ liệu hiện có:
--   * KHÔNG xoá/cập nhật row nào; mọi subscription đang có giữ nguyên facilityId làm origin.
--   * Chỉ bỏ DEFAULT + NOT NULL để gói FREE cấp lúc đăng ký không phải trỏ về 'legacy-main'
--     (trước đây đăng ký phụ thuộc facility 'legacy-main' chỉ để thoả FK).
--   * FK `MembershipSubscription_facilityId_fkey` được GIỮ NGUYÊN (nullable FK).

-- AlterTable
ALTER TABLE "MembershipSubscription" ALTER COLUMN "facilityId" DROP DEFAULT;
ALTER TABLE "MembershipSubscription" ALTER COLUMN "facilityId" DROP NOT NULL;
