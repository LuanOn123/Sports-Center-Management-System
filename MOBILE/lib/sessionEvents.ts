// lib/sessionEvents.ts
// Phát sự kiện khi phiên đăng nhập bị BE thu hồi (đổi mật khẩu / khóa tài khoản /
// đổi role — BE giờ revoke toàn bộ refresh token + ngắt socket ở mọi thiết bị).
// AuthContext lắng nghe để tự đăng xuất — tránh "nửa phiên": UI vẫn hiện như đã
// đăng nhập nhưng mọi API đều 401 âm thầm vì refresh token đã bị thu hồi.

type Listener = () => void;
let listeners: Listener[] = [];

export function onSessionExpired(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function emitSessionExpired() {
  listeners.forEach((l) => l());
}
