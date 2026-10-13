// tailwind.config.js
// Token giao diện cho className (màu khớp constants/theme.ts — nơi code JS lấy màu cho style/props).

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
          primary: '#0B1018',
          surface: '#131A26',
          elevated: '#192332',
          card: '#131A26',
        },
        primary: '#D4FF00',
        primaryDark: '#526222',
        accent: '#64DFB4',
        text: {
          primary: '#F1F4F9',
          secondary: '#9BAAC0',
          muted: '#8498B2',
          inverse: '#0B1018',
        },
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
        border: '#263143',
        divider: '#1D2635',
        overlay: 'rgba(0,0,0,0.7)',
        tier: {
          FREE: '#8498B2',
          MEMBERSHIP: '#65CFFF',
          PREMIUM: '#F5CB65',
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
        glow: '0px 0px 12px rgba(212, 255, 0, 0.3)',
      },
    },
  },
  plugins: [],
};
