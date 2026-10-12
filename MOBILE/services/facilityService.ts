// services/facilityService.ts
// Tầng gọi API thuần túy — không có state, không có hook

import { api } from '../lib/api';
import type { Facility } from '../lib/types';

/** GET /facilities — MEMBER/ADMIN thấy mọi cơ sở đang hoạt động, COACH chỉ thấy cơ sở được phân công */
export const getFacilities = () => api.get<Facility[]>('/facilities');
