// constants/assistant.ts
// Trợ lý AI (chat với BE `/ai/chat`): chữ hiển thị, giới hạn nhập và thông số bong bóng nổi.
// Câu chữ mở đầu, câu hỏi gợi ý và hạn mức dưới đây là nguồn duy nhất — component/hook không viết tay lại.

import type { Role } from '../lib/types';

export const AI_CHAT_PATH = '/ai/chat';

/** Tên hiển thị của trợ lý (web: "Trợ lý Sports Center") */
export const ASSISTANT_NAME = 'Trợ lý AI';

/** Lời chào đầu cuộc trò chuyện — giống web (FE/src/features/ai). Không gửi lên BE như một lượt hội thoại. */
export const ASSISTANT_GREETING = 'Chào bạn, mình là Trợ lý Sports Center. Mình có thể giúp gì cho bạn?';

export const ASSISTANT_TEXT = {
  inputPlaceholder: 'Nhập câu hỏi…',
  typing: 'AI đang gõ…',
  send: 'Gửi',
  stop: 'Dừng',
  retry: 'Gửi lại',
  copy: 'Sao chép',
  copied: 'Đã sao chép',
  newChat: 'Cuộc trò chuyện mới',
  newChatConfirmTitle: 'Bắt đầu cuộc trò chuyện mới?',
  newChatConfirmMessage: 'Nội dung cuộc trò chuyện hiện tại sẽ bị xóa khỏi máy.',
  newChatConfirmAction: 'Xóa và bắt đầu lại',
  suggestionsTitle: 'Bạn có thể hỏi',
  stopped: 'Đã dừng trả lời.',
  emptyReply: 'AI chưa trả về nội dung. Vui lòng thử lại.',
  privacy: 'Trợ lý chỉ trả lời dựa trên thông tin chung của trung tâm. Về tài khoản của riêng bạn, vui lòng liên hệ lễ tân.',
} as const;

/** Độ dài tối đa một tin nhắn (BE chưa giới hạn — mobile tự chặn để tránh gửi quá nặng) */
export const ASSISTANT_MAX_MESSAGE_LENGTH = 1000;
/** Chỉ hiện bộ đếm ký tự khi đã dùng từ ngưỡng này (tỷ lệ so với giới hạn) */
export const ASSISTANT_COUNTER_THRESHOLD = 0.8;
/** Số tin gần nhất gửi kèm làm ngữ cảnh (web gửi toàn bộ; mobile chặn để yêu cầu không phình to) */
export const ASSISTANT_HISTORY_LIMIT = 20;

/** Câu hỏi gợi ý — chỉ dùng thông tin mà BE đưa cho mô hình (cơ sở, lớp, gói tập, lịch sắp tới, điều khoản) */
export const ASSISTANT_SUGGESTIONS: Record<'MEMBER' | 'COACH' | 'DEFAULT', readonly string[]> = {
  MEMBER: [
    'Trung tâm có những gói tập nào?',
    'Lớp nào đang mở đăng ký?',
    'Lịch các buổi học sắp tới?',
    'Gói Premium khác gói Membership thế nào?',
  ],
  COACH: [
    'Trung tâm có những lớp nào?',
    'Lịch các buổi học sắp tới?',
    'Các cơ sở của trung tâm ở đâu?',
  ],
  DEFAULT: ['Trung tâm có những gói tập nào?', 'Lịch các buổi học sắp tới?'],
};

export function suggestionsForRole(role: Role | undefined) {
  if (role === 'MEMBER') return ASSISTANT_SUGGESTIONS.MEMBER;
  if (role === 'COACH') return ASSISTANT_SUGGESTIONS.COACH;
  return ASSISTANT_SUGGESTIONS.DEFAULT;
}

/** Câu báo lỗi thân thiện theo mã HTTP (không lộ tên biến môi trường như GROQ_API_KEY của BE) */
export const ASSISTANT_ERRORS = {
  unavailable: 'Trợ lý AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút.',
  tooManyRequests: 'Bạn gửi hơi nhanh. Vui lòng đợi một chút rồi thử lại.',
  tooLong: 'Tin nhắn quá dài. Vui lòng rút gọn rồi gửi lại.',
  generic: 'Không gửi được tin nhắn. Vui lòng thử lại.',
} as const;

// ─── Bong bóng nổi ──────────────────────────────────────────────────────────────

/** Đường kính bong bóng (dp) */
export const BUBBLE_SIZE = 56;
/** Khoảng cách tối thiểu từ bong bóng tới mép màn hình (dp) */
export const BUBBLE_EDGE_MARGIN = 8;
/** Kéo nhích dưới ngưỡng này (dp) vẫn tính là chạm, không phải kéo */
export const BUBBLE_TAP_SLOP = 6;
/** Chạm giữ lâu hơn mức này (ms) không tính là chạm mở chat */
export const BUBBLE_TAP_MAX_MS = 400;

/** Tắt bong bóng bằng dấu "x": sau chừng này (ms) nó hiện lại ở vị trí cố định */
export const BUBBLE_RESPAWN_MS = 10_000;

/**
 * Vị trí cố định khi mới mở app và khi hiện lại sau lúc tắt: sát mép PHẢI màn hình,
 * tâm bong bóng nằm ở 80% chiều cao vùng hiển thị (tính từ trên xuống) — phía dưới bên phải,
 * vẫn nằm trên thanh tab. Muốn đổi chỗ chỉ cần sửa hai hằng số này.
 */
export const BUBBLE_DEFAULT_SIDE = 'right' as const;
export const BUBBLE_DEFAULT_CENTER_Y_RATIO = 0.8;

/**
 * Dấu "x" tắt bong bóng nằm ở góc trên-phải, nhô ra ngoài vòng tròn BUBBLE_CLOSE_OVERHANG (dp).
 * Android chỉ nhận chạm bên trong khung của view cha nên khung kéo thả (BUBBLE_FOOTPRINT) phải bao cả dấu "x".
 */
export const BUBBLE_CLOSE_SIZE = 24;
export const BUBBLE_CLOSE_OVERHANG = 10;
export const BUBBLE_FOOTPRINT = BUBBLE_SIZE + BUBBLE_CLOSE_OVERHANG;

const RESPAWN_SECONDS = Math.round(BUBBLE_RESPAWN_MS / 1000);

/** Dòng nhắc ngắn khi vừa tắt bong bóng (hiện trong khoảng này, ms) */
export const BUBBLE_HINT_MS = 3_000;
export const BUBBLE_HINT_TEXT = `Trợ lý AI sẽ hiện lại sau ${RESPAWN_SECONDS} giây`;

export const BUBBLE_LABELS = {
  open: 'Mở trợ lý AI',
  openUnread: 'Mở trợ lý AI, có câu trả lời mới',
  close: `Tắt bong bóng trợ lý AI trong ${RESPAWN_SECONDS} giây`,
} as const;
