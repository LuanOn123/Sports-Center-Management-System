// lib/memberCard.ts
// Thẻ hội viên QR dùng cho check-in cơ sở: mã QR chứa đúng userId (theo BE). Lễ tân quét mã rồi ghi nhận bằng
// POST /facility-visits/reception-check-in { memberId } — BE nhận cả id lẫn userId của hồ sơ hội viên.
// Định dạng nội dung mã nằm ở MỘT chỗ này để đổi khi BE/lễ tân thống nhất định dạng khác (tiền tố, chữ ký, hạn dùng…).

/** Nội dung mã QR của hội viên; null khi chưa có userId */
export function memberCardPayload(userId: string | null | undefined): string | null {
  const id = userId?.trim();
  return id ? id : null;
}
