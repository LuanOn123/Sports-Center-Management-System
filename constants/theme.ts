import { Platform } from 'react-native';

// Design System Tokens — Sports Center Mobile
export const Colors = {
  // Backgrounds
  bg: {
    primary: '#0B1018',
    surface: '#131A26',
    elevated: '#192332',
    card: '#131A26',
  },
  // Brand
  primary: '#D4FF00',     // lime-400
  primaryDark: '#526222', // lime-700
  accent: '#64DFB4',      // green-500
  // Text
  text: {
    primary: '#F1F4F9',
    secondary: '#9BAAC0',
    muted: '#8498B2',
    inverse: '#0B1018',
  },
  // Status
  status: {
    active: '#D4FF00',
    expired: '#FF8D9A',
    suspended: '#F5CB65',
    cancelled: '#FF8D9A',
    scheduled: '#65CFFF',
    completed: '#64DFB4',
    booked: '#C8B4FF',
    pending: '#F5CB65',
    success: '#64DFB4',
    failed: '#FF8D9A',
  },
  // UI
  border: '#263143',
  divider: '#1D2635',
  overlay: 'rgba(0,0,0,0.7)',
  // Tiers
  tier: {
    FREE: '#8498B2',
    MEMBERSHIP: '#65CFFF',
    PREMIUM: '#F5CB65',
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
    lime: '#D4FF00',
    violet: '#C8B4FF',
    cyan: '#65CFFF',
    amber: '#F5CB65',
    emerald: '#64DFB4',
    pink: '#FF8D9A',
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
    web: { boxShadow: '0px 0px 12px rgba(212, 255, 0, 0.3)' },
    default: {
      shadowColor: '#D4FF00',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
  }) as object,
};
