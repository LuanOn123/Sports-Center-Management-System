// lib/help.ts
// Quy tắc thuần của màn Hướng dẫn sử dụng: chủ đề theo vai trò, tìm kiếm (web: HelpPanel)

import { COACH_GUIDES, MEMBER_GUIDES, type HelpGuide } from '../constants/help';
import type { Role } from './types';

/** Chủ đề của vai trò: HLV có bộ riêng, còn lại là Hội viên */
export const guidesForRole = (role: Role | undefined): readonly HelpGuide[] => (role === 'COACH' ? COACH_GUIDES : MEMBER_GUIDES);

/** Chữ thường và bỏ dấu tiếng Việt (đ → d) để gõ "lich" vẫn khớp "lịch" — rộng hơn web, nơi phải gõ đúng dấu */
export function normalizeSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Giữ chủ đề có từ khóa trong tiêu đề hoặc các bước; ô tìm trống thì giữ nguyên */
export function filterGuides(guides: readonly HelpGuide[], query: string): HelpGuide[] {
  const q = normalizeSearch(query.trim());
  if (!q) return [...guides];
  return guides.filter((guide) => normalizeSearch(`${guide.title} ${guide.steps.join(' ')}`).includes(q));
}
