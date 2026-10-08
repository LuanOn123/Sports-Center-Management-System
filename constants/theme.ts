import { Platform } from 'react-native';

// Design System Tokens — Sports Center Mobile
export const Colors = {
  // Backgrounds
  bg: {
    primary: '#0A0A0A',
    surface: '#1A1A1A',
    elevated: '#242424',
    card: '#1E1E1E',
  },
  // Brand
  primary: '#A3E635',     // lime-400
  primaryDark: '#65A30D', // lime-700
  accent: '#22C55E',      // green-500
  // Text
  text: {
    primary: '#F5F5F5',
    secondary: '#A3A3A3',
    muted: '#525252',
    inverse: '#0A0A0A',
  },
  // Status
  status: {
    active: '#A3E635',
    expired: '#EF4444',
    suspended: '#F59E0B',
    cancelled: '#EF4444',
    scheduled: '#3B82F6',
    completed: '#22C55E',
    booked: '#8B5CF6',
    pending: '#F59E0B',
    success: '#22C55E',
    failed: '#EF4444',
  },
  // UI
  border: '#2A2A2A',
  divider: '#1F1F1F',
  overlay: 'rgba(0,0,0,0.7)',
  // Tiers
  tier: {
    FREE: '#6B7280',
    MEMBERSHIP: '#3B82F6',
    PREMIUM: '#F59E0B',
  },
  // Logo thương hiệu — khớp FE web (public/brand/pulse-member.svg + shared/portal-theme.css)
  brand: {
    markBg: '#1C2534',
    markBorder: '#293445',
    ink: '#0B0F17',
    accent: '#D4FF00',
    pulse: '#38BDF8',
    text: '#F1F4F9',
    tagline: '#9BAAC0',
  },
  // Màu nhấn cho ô Truy cập nhanh (navigation/quickAccessConfig.ts)
  feature: {
    lime: '#A3E635',
    violet: '#8B5CF6',
    cyan: '#06B6D4',
    amber: '#F59E0B',
    emerald: '#10B981',
    pink: '#EC4899',
  },
} as const;

/** Hậu tố alpha (hex) cho nền nhạt của icon: màu + TINT_ALPHA */
export const TINT_ALPHA = '18';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

export const Shadow = {
  sm: Platform.select({
    web: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.3)' },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
    },
  }) as object,
  md: Platform.select({
    web: { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.4)' },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
  }) as object,
  glow: Platform.select({
    web: { boxShadow: '0px 0px 12px rgba(163, 230, 53, 0.3)' },
    default: {
      shadowColor: '#A3E635',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
  }) as object,
};
