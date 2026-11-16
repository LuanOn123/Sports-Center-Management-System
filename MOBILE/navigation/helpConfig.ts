// navigation/helpConfig.ts
// Màn mở bằng nút "Mở chức năng" của từng chủ đề trong Hướng dẫn sử dụng (nội dung ở constants/help.ts)

import type { Href } from 'expo-router';
import type { HelpTarget } from '../constants/help';
import { ROUTES } from './routes';

export const HELP_ROUTE: Record<HelpTarget, Href> = {
  classes: ROUTES.classes,
  membershipPlans: ROUTES.membershipPlans,
  profile: ROUTES.profile,
  myAttendance: ROUTES.myAttendance,
  schedule: ROUTES.schedule,
  coachAttendance: ROUTES.coachAttendance,
};
