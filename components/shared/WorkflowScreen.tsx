import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';
import { Colors } from '../../constants/theme';
import { Icon } from './Icon';

export function WorkflowScreen({ title, subtitle, children, refreshing = false, onRefresh, footer }: {
  title: string; subtitle?: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void;
  /** Vùng cố định dưới đáy (vd: nút đăng ký) — nằm trên vùng an toàn của máy */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return <View className="flex-1 bg-bg-primary"><ScreenHeader title={title} subtitle={subtitle} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: footer ? 20 : Math.max(32, insets.bottom + 20), gap: 16 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} /> : undefined}>
      {children}
    </ScrollView>
    {footer && <View className="bg-bg-primary border-t border-border px-xl pt-md" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>{footer}</View>
    </View>}
  </View>;
}
export function WorkflowCard({ title, children }: { title?: string; children: ReactNode }) {
  return <View className="bg-bg-surface border border-border rounded-md p-lg gap-md">
    {title && <Text className="text-lg text-text-primary font-bevn-semibold">{title}</Text>}{children}
  </View>;
}
export function WorkflowText({ children }: { children: ReactNode }) {
  return <Text className="text-sm text-text-secondary font-bevn-regular leading-[22px]">{children}</Text>;
}
export function WorkflowButton({ title, onPress, busy = false, disabled = false, secondary = false, icon }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean;
  /** Icon đứng trước chữ (tuỳ chọn) */
  icon?: string;
}) {
  const color = secondary ? Colors.text.primary : Colors.text.inverse;
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }}
    onPress={onPress} disabled={disabled || busy} className={`rounded-sm p-md flex-row items-center justify-center gap-sm border ${secondary ? 'bg-bg-elevated border-border' : 'bg-primary border-primary'} ${(disabled || busy) ? 'opacity-60' : ''}`}>
    {busy ? <ActivityIndicator color={secondary ? Colors.primary : Colors.text.inverse} /> : <>{icon && <Icon name={icon} size={18} color={color} />}<Text className={`${secondary ? 'text-text-primary' : 'text-text-inverse'} text-sm font-bevn-semibold`}>{title}</Text></>}
  </TouchableOpacity>;
}
export function WorkflowField({ label, ...props }: TextInputProps & { label: string }) {
  return <View className="gap-sm"><WorkflowText>{label}</WorkflowText>
    <TextInput accessibilityLabel={label} placeholderTextColor={Colors.text.muted} {...props}
      className="bg-bg-elevated border border-border rounded-sm p-md text-text-primary text-md font-bevn-regular" />
  </View>;
}
export function WorkflowState({ pending, error, empty, retry }: { pending?: boolean; error?: unknown; empty?: string; retry?: () => void }) {
  if (pending) return <ActivityIndicator color={Colors.primary} size="large" />;
  if (error) return <WorkflowCard><Text accessibilityRole="alert" className="text-status-failed text-sm font-bevn-regular">{error instanceof Error ? error.message : 'Không tải được dữ liệu.'}</Text>{retry && <WorkflowButton title="Thử lại" secondary onPress={retry} />}</WorkflowCard>;
  if (empty) return <WorkflowCard><WorkflowText>{empty}</WorkflowText></WorkflowCard>;
  return null;
}
export const workflowStatus = (status: string) => ({
  WAITING: 'Đang chờ', PROMOTED: 'Đã được xếp chỗ', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
  OPEN: 'Mới tiếp nhận', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng', SUCCESS: 'Thành công', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền', ISSUED: 'Đã phát hành',
} as Record<string, string>)[status] || status;
