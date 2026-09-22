// components/shared/Icon.tsx
// Bộ icon dùng chung — cùng bộ lucide mà FE web đang dùng (lucide-react).
// Nhận đúng tên icon kiểu MaterialIcons (name="place", name="chevron-right"...) để
// không phải sửa lại từng chỗ gọi <MaterialIcons name="..." />, chỉ đổi import.
// Icon nào lucide không có tương đương phù hợp thì rơi về MaterialIcons gốc.

import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { LucideIcon } from 'lucide-react-native';
import {
  Clock, Plus, BellRing, BellOff, ArrowLeft, ChevronDown, ArrowRight, ClipboardCheck,
  Sparkles, RefreshCw, Calendar, Camera, XCircle, IdCard, MessageCircle, CheckCircle,
  CircleCheckBig, ChevronRight, BookOpen, X, ArrowLeftRight, CalendarRange, Trash2,
  FileText, AlertCircle, CalendarCheck, CalendarX, CalendarClock, BadgePlus, Dumbbell,
  Users, UserX, History, Home, Hourglass, Timer, UserCheck, Info, BarChart3, Bell,
  CreditCard, Wallet, UsersRound, User, UserPlus, Phone, MapPin, QrCode, ScanLine,
  CircleMinus, GraduationCap, Search, Send, Activity, Star, CalendarDays, Target,
  TrendingUp, RotateCw, Eye, EyeOff, TriangleAlert, Award,
} from 'lucide-react-native';

const ICON_MAP: Record<string, LucideIcon> = {
  'access-time': Clock,
  add: Plus,
  alarm: BellRing,
  'alarm-off': BellOff,
  'arrow-back': ArrowLeft,
  'arrow-drop-down': ChevronDown,
  'arrow-forward': ArrowRight,
  assignment: ClipboardCheck,
  'auto-awesome': Sparkles,
  autorenew: RefreshCw,
  'calendar-today': Calendar,
  'camera-alt': Camera,
  cancel: XCircle,
  'card-membership': IdCard,
  chat: MessageCircle,
  'chat-bubble-outline': MessageCircle,
  'check-circle': CheckCircle,
  'check-circle-outline': CircleCheckBig,
  'chevron-right': ChevronRight,
  class: BookOpen,
  close: X,
  'currency-exchange': ArrowLeftRight,
  'date-range': CalendarRange,
  'delete-outline': Trash2,
  description: FileText,
  'error-outline': AlertCircle,
  event: Calendar,
  'event-available': CalendarCheck,
  'event-busy': CalendarX,
  'event-note': CalendarClock,
  'fiber-new': BadgePlus,
  'fitness-center': Dumbbell,
  group: Users,
  'group-off': UserX,
  history: History,
  home: Home,
  'hourglass-empty': Hourglass,
  'hourglass-top': Timer,
  'how-to-reg': UserCheck,
  'info-outline': Info,
  insights: BarChart3,
  notifications: Bell,
  'notifications-none': Bell,
  payment: CreditCard,
  payments: Wallet,
  people: Users,
  'people-outline': UsersRound,
  person: User,
  'person-add': UserPlus,
  phone: Phone,
  place: MapPin,
  'qr-code-2': QrCode,
  'qr-code-scanner': ScanLine,
  refresh: RefreshCw,
  'remove-circle-outline': CircleMinus,
  school: GraduationCap,
  schedule: Clock,
  search: Search,
  send: Send,
  'show-chart': Activity,
  sports: Dumbbell,
  star: Star,
  'star-border': Star,
  'star-outline': Star,
  'swap-horiz': ArrowLeftRight,
  timeline: Activity,
  today: CalendarDays,
  'track-changes': Target,
  'trending-up': TrendingUp,
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
}

/** Alias làm `MaterialIcons` ở nơi gọi — xem hướng dẫn import ở đầu file này. */
export function Icon({ name, size = 24, color = '#000', style }: IconProps) {
  const LucideIcon = ICON_MAP[name];
  if (LucideIcon) return <LucideIcon size={size} color={color} style={style} />;
  return <MaterialIcons name={name as never} size={size} color={color} style={style} />;
}
