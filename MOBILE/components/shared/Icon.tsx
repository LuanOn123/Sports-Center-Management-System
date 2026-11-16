// components/shared/Icon.tsx
// Bộ icon dùng chung — cùng bộ lucide mà FE web đang dùng (lucide-react).
// Nhận tên icon kiểu MaterialIcons cũ (name="place", name="chevron-right"...) để
// map sang lucide tương ứng. Icon nào lucide không có tương đương phù hợp thì
// rơi về MaterialIcons gốc (@expo/vector-icons) làm fallback.
//
// Icon của tab, menu Tài khoản và lối tắt Trang chủ dùng ĐÚNG icon web dùng cho cùng chức năng
// (FE: features/user/UserLayout, shared/PortalLayout, shared/ProfileMenu, shared/QuickActions, shared/HelpPanel, features/ai/AIChatBubble).
// Lưu ý: web dùng lucide-react 0.468, mobile dùng lucide-react-native 1.47 — cùng tên icon có thể khác nét vẽ đôi chút giữa hai phiên bản.

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LucideIcon } from 'lucide-react-native';
import {
  Clock, Plus, BellRing, BellOff, ArrowLeft, ChevronDown, ArrowRight, ClipboardCheck,
  Sparkles, RefreshCw, Calendar, Camera, XCircle, IdCard, MessageCircle, CircleCheck,
  CircleCheckBig, ChevronRight, BookOpen, X, ArrowLeftRight, CalendarRange, Trash2,
  FileText, AlertCircle, CalendarCheck, CalendarX, CalendarClock, BadgePlus, Dumbbell,
  Users, UserX, History, Home, Hourglass, Timer, UserCheck, Info, BarChart3, Bell,
  CreditCard, Wallet, UsersRound, User, UserPlus, Phone, MapPin, QrCode, ScanLine,
  CircleMinus, GraduationCap, Search, Send, Activity, Star, CalendarDays, Target,
  TrendingUp, RotateCw, Eye, EyeOff, TriangleAlert, Award, UserRound, Copy, Landmark, Download,
  Bot, CheckCheck, CircleAlert, CircleHelp, HeartPulse, Inbox, LayoutDashboard, LifeBuoy, Lock,
  LogOut, Mail, Paperclip, ReceiptText, ShieldCheck, SlidersHorizontal,
} from 'lucide-react-native';

const ICON_MAP: Record<string, LucideIcon> = {
  'access-time': Clock,
  'account-balance': Landmark,
  add: Plus,
  alarm: BellRing,
  'alarm-off': BellOff,
  'arrow-back': ArrowLeft,
  'arrow-drop-down': ChevronDown,
  'arrow-forward': ArrowRight,
  assignment: ClipboardCheck,
  'attach-file': Paperclip,
  'auto-awesome': Sparkles,
  autorenew: RefreshCw,
  'calendar-today': Calendar,
  'camera-alt': Camera,
  cancel: XCircle,
  'card-membership': IdCard,
  chat: MessageCircle,
  'chat-bubble-outline': MessageCircle,
  // Dấu tích thành công: web dùng CheckCircle2 (vòng tròn kín có dấu tích) = CircleCheck
  'check-circle': CircleCheck,
  'check-circle-outline': CircleCheckBig,
  'chevron-right': ChevronRight,
  class: BookOpen,
  'content-copy': Copy,
  close: X,
  'currency-exchange': ArrowLeftRight,
  dashboard: LayoutDashboard,
  'date-range': CalendarRange,
  'delete-outline': Trash2,
  description: FileText,
  'done-all': CheckCheck,
  download: Download,
  email: Mail,
  error: CircleAlert,
  'error-outline': AlertCircle,
  event: Calendar,
  'event-available': CalendarCheck,
  'event-busy': CalendarX,
  'event-note': CalendarClock,
  explore: Search,
  favorite: HeartPulse,
  'fiber-new': BadgePlus,
  'fitness-center': Dumbbell,
  group: Users,
  'group-off': UserX,
  'help-outline': CircleHelp,
  history: History,
  home: Home,
  'hourglass-empty': Hourglass,
  'hourglass-top': Timer,
  'how-to-reg': UserCheck,
  inbox: Inbox,
  info: Info,
  'info-outline': Info,
  insights: BarChart3,
  lock: Lock,
  'lock-outline': Lock,
  logout: LogOut,
  'manage-accounts': UserRound,
  notifications: Bell,
  'notifications-none': Bell,
  payment: CreditCard,
  payments: Wallet,
  people: Users,
  'people-outline': UsersRound,
  person: User,
  'person-outline': UserRound,
  'person-add': UserPlus,
  phone: Phone,
  'photo-camera': Camera,
  place: MapPin,
  policy: ShieldCheck,
  'qr-code-2': QrCode,
  'qr-code-scanner': ScanLine,
  'receipt-long': ReceiptText,
  refresh: RefreshCw,
  'remove-circle-outline': CircleMinus,
  school: GraduationCap,
  schedule: Clock,
  search: Search,
  send: Send,
  'show-chart': Activity,
  'smart-toy': Bot,
  sports: Dumbbell,
  star: Star,
  'star-border': Star,
  'star-outline': Star,
  'support-agent': LifeBuoy,
  'swap-horiz': ArrowLeftRight,
  timeline: Activity,
  today: CalendarDays,
  'track-changes': Target,
  'trending-up': TrendingUp,
  tune: SlidersHorizontal,
  update: RotateCw,
  visibility: Eye,
  'visibility-off': EyeOff,
  warning: TriangleAlert,
  'workspace-premium': Award,
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Tô đầy biểu tượng (lucide chỉ có nét viền; vd. sao đã chọn khác sao chưa chọn khi đánh giá) */
  filled?: boolean;
}

export function Icon({ name, size = 24, color = '#000', style, filled }: IconProps) {
  const LucideIcon = ICON_MAP[name];
  if (LucideIcon) return <LucideIcon size={size} color={color} style={style} fill={filled ? color : 'none'} />;
  return <MaterialIcons name={name as never} size={size} color={color} style={style} />;
}
