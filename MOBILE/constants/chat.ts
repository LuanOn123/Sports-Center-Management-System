// constants/chat.ts
// Tin nhắn: nhãn vai trò, giới hạn gửi tệp / độ dài, chữ hiển thị (web: Communication.tsx)

import { Colors } from './theme';

export const CHAT_ROLE_LABEL: Record<string, string> = {
  COACH: 'Huấn luyện viên',
  MEMBER: 'Hội viên',
  RECEPTIONIST: 'Lễ tân',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
};

export const CHAT_ROLE_COLOR: Record<string, string> = {
  COACH: Colors.accent,
  MEMBER: Colors.status.scheduled,
  RECEPTIONIST: Colors.status.suspended,
  MANAGER: Colors.primary,
  ADMIN: Colors.primary,
};

/** Một tin nhắn dài tối đa chừng này ký tự */
export const CHAT_MESSAGE_MAX_LENGTH = 1000;

/** Tệp đính kèm: ảnh JPEG/PNG/WebP/GIF hoặc PDF, tối đa 10 MB (web: HelpPanel "Tệp đính kèm") */
export const CHAT_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_FILE_ERROR = {
  tooLarge: 'Tệp tối đa 10 MB.',
  badType: 'Chỉ gửi được ảnh JPEG/PNG/WebP/GIF hoặc PDF.',
} as const;

/** Huy hiệu tin chưa đọc trên tab Tin nhắn tự làm mới mỗi chừng này */
export const CHAT_UNREAD_REFRESH_MS = 30_000;

/** Tên "phòng chung" — kênh chung của cả trung tâm */
export const GENERAL_CHAT_TITLE = 'Phòng chung';

export const CHAT_TEXT = {
  inboxTitle: 'Tin nhắn',
  searchPlaceholder: 'Tìm theo tên hoặc email...',
  generalSubtitle: 'Không gian trao đổi của trung tâm',
  generalThreadSubtitle: 'Không gian chung của trung tâm',
  noContacts: 'Chưa có ai để nhắn tin',
  noContactsHint: 'Chưa có huấn luyện viên/đội ngũ phù hợp',
  noMatch: 'Không tìm thấy liên hệ',
  noMatchHint: (query: string) => `Không có ai khớp với "${query}"`,
  startConversation: 'Chưa có tin nhắn — bấm để bắt đầu',
  attachmentPreview: '[Tệp đính kèm]',
  threadEmpty: 'Bắt đầu cuộc trò chuyện',
  composerPlaceholder: 'Nhắn tin...',
  unknownUser: 'Người dùng',
  sendFailed: 'Không gửi được tin nhắn',
  retryHint: 'Vui lòng thử lại.',
  pickFailed: 'Không chọn được tệp',
  fileTooLarge: 'Tệp quá lớn',
  attachLabel: 'Chọn ảnh hoặc PDF',
  send: 'Gửi tin nhắn',
  removeAttachment: 'Bỏ tệp đính kèm',
} as const;
