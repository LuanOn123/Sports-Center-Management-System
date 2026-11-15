// services/termService.ts
// Tầng gọi API kỳ học — thuần túy, không có state, không có hook

import { api } from '../lib/api';
import { allPages } from '../lib/pagedApi';
import type { Term } from '../lib/types';

/** GET /terms/current — kỳ học hiện tại (web: banner kỳ học ở Dashboard và Khám phá lớp học) */
export const getCurrentTerm = () => api.get<Term>('/terms/current');

/** GET /terms — các kỳ học, dùng cho bộ lọc "kỳ học" ở Khám phá lớp học (BE trả kỳ học của mọi cơ sở) */
export const getTerms = () => allPages<Term>('/terms');
