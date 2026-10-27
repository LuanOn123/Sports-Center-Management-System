// lib/coachProfile.ts
// Nội dung hồ sơ HLV trong chi tiết lớp — ưu tiên dữ liệu đầy đủ từ GET /coaches/:userId, thiếu thì dùng dữ liệu
// đã có trong lớp (giống web CoachProfileDialog: profile?.bio ?? coach.bio…). Hồ sơ hiện ngay, dữ liệu đầy đủ tới sau.

import { COACH_PROFILE_TEXT as T } from '../constants/coachProfile';
import type { ClassCoach, CoachDetails } from './types';

export interface CoachProfileView {
  name: string;
  avatarUrl: string | null;
  roleLine: string;
  specialties: string[];
  experience: string;
  hasExperience: boolean;
  bio: string;
  hasBio: boolean;
}

/** "HIIT Cardio, Boxing cơ bản" → ["HIIT Cardio", "Boxing cơ bản"]; bỏ trùng (không phân biệt hoa thường) */
export function splitSpecialties(text: string | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of (text ?? '').split(/[,;]/)) {
    const item = part.trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function coachProfileView(assigned: ClassCoach, details?: CoachDetails | null): CoachProfileView {
  const coach = assigned.coach;
  const profile = details?.coachProfile;
  const years = profile?.experienceYears ?? coach?.experienceYears;
  const bio = (profile?.bio ?? coach?.bio)?.trim();
  return {
    name: details?.fullName || coach?.user?.fullName || T.defaultName,
    avatarUrl: details?.avatarUrl ?? null,
    roleLine: assigned.isPrimary ? T.rolePrimary : T.roleSupport,
    specialties: splitSpecialties(profile?.specialization ?? coach?.specialization),
    experience: years != null ? T.years(years) : T.noExperience,
    hasExperience: years != null,
    bio: bio || T.noBio,
    hasBio: Boolean(bio),
  };
}

/** Nhãn vai trò trên thẻ HLV */
export function coachCardRole(isPrimary: boolean) {
  return isPrimary ? T.cardRolePrimary : T.cardRoleSupport;
}
