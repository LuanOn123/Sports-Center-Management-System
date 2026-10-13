// lib/secureText.ts
// iOS: ô mật khẩu (secureTextEntry) đã có chữ, rời ô rồi quay lại gõ thì hệ điều hành XOÁ SẠCH nội dung
// ở phím đầu tiên (gõ ký tự → chỉ còn ký tự đó; bấm xoá → rỗng). Hàm này khôi phục lại để người dùng
// gõ tiếp như bình thường.

/**
 * Giá trị đúng sau phím đầu tiên kể từ khi quay lại ô mật khẩu.
 * - Gõ / xoá bình thường (iOS không xoá sạch) → giữ nguyên `next`.
 * - iOS xoá sạch khi bấm xoá → bỏ ký tự cuối của mật khẩu cũ.
 * - iOS xoá sạch khi gõ 1 ký tự → nối ký tự đó vào mật khẩu cũ.
 * - Dán / tự điền mật khẩu (nhiều ký tự) → thay toàn bộ như người dùng muốn.
 */
export function restoreSecureText(prev: string, next: string) {
  if (!prev || next.startsWith(prev) || (next.length === prev.length - 1 && prev.startsWith(next))) return next;
  if (next === '') return prev.slice(0, -1);
  if (next.length === 1) return prev + next;
  return next;
}
