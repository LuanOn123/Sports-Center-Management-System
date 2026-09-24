// tailwind.config.js
// Map 1:1 các token trong constants/theme.ts sang Tailwind — giữ nguyên UI khi convert dần từng file.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  // App luôn ép dark theme (app.json: userInterfaceStyle "dark"), không theo
  // system preference — cần 'class' để RN Web set màu thủ công không bị lỗi
  // "Cannot manually set color scheme, as dark mode is type 'media'".
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0A0A',
          surface: '#1A1A1A',
          elevated: '#242424',
          card: '#1E1E1E',
        },
        primary: '#A3E635',
        primaryDark: '#65A30D',
        accent: '#22C55E',
        text: {
          primary: '#F5F5F5',
          secondary: '#A3A3A3',
          muted: '#525252',
          inverse: '#0A0A0A',
        },
        status: {
          active: '#A3E635',
          expired: '#EF4444',
          suspended: '#F59E0B',
          cancelled: '#6B7280',
          scheduled: '#3B82F6',
          completed: '#22C55E',
          booked: '#8B5CF6',
          pending: '#F59E0B',
          success: '#22C55E',
          failed: '#EF4444',
        },
        border: '#2A2A2A',
        divider: '#1F1F1F',
        overlay: 'rgba(0,0,0,0.7)',
        tier: {
          FREE: '#6B7280',
          MEMBERSHIP: '#3B82F6',
          PREMIUM: '#F59E0B',
        },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        xxl: '24px',
        xxxl: '32px',
        section: '40px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '999px',
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        md: '15px',
        lg: '17px',
        xl: '20px',
        xxl: '24px',
        xxxl: '30px',
        display: '36px',
      },
      // Tên khác với font-weight mặc định của Tailwind (font-medium/semibold/bold
      // đã là class weight có sẵn) để tránh 2 utility trùng tên nhưng khác thuộc tính.
      fontFamily: {
        'bevn-regular': ['BeVietnamPro_400Regular'],
        'bevn-medium': ['BeVietnamPro_500Medium'],
        'bevn-semibold': ['BeVietnamPro_600SemiBold'],
        'bevn-bold': ['BeVietnamPro_700Bold'],
        'bevn-extrabold': ['BeVietnamPro_800ExtraBold'],
      },
      boxShadow: {
        sm: '0px 1px 3px rgba(0, 0, 0, 0.3)',
        md: '0px 4px 8px rgba(0, 0, 0, 0.4)',
        glow: '0px 0px 12px rgba(163, 230, 53, 0.3)',
      },
    },
  },
  plugins: [],
};
