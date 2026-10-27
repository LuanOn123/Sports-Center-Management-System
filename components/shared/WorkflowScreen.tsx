// components/shared/WorkflowScreen.tsx
// Khung màn nghiệp vụ dùng chung (check-in, hóa đơn, danh sách chờ, hỗ trợ, nghỉ phép, đánh giá, chi tiết lớp…).
// Giữ nguyên API cũ nhưng dựng bằng bộ giao diện components/ui để mọi màn dùng chung một ngôn ngữ thiết kế.

import React, { type ReactNode } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TextInput, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';
import { useUserPullRefresh } from '../../hooks/shared/useUserPullRefresh';
import { Icon } from './Icon';
import { Button } from '../ui/Button';
import { Colors, Spacing } from '../../constants/theme';

export function WorkflowScreen({ title, children, refreshing = false, onRefresh, footer }: {
  title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void;
  /** Vùng cố định dưới đáy (vd: nút đăng ký) — nằm trên vùng an toàn của máy */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  // `refreshing` = màn đang làm mới dữ liệu (kể cả ngầm). Vòng xoay kéo-để-tải chỉ hiện khi người dùng kéo,
  // không hiện mỗi lần dữ liệu tự làm mới (tránh "loading hai lần": vòng tải của trang + vòng xoay ở đầu trang)
  const { pulling, onPull } = useUserPullRefresh(refreshing, onRefresh);
  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader title={title} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          width: '100%', maxWidth: 760, alignSelf: 'center',
          padding: Spacing.xl, paddingBottom: footer ? Spacing.xl : Math.max(Spacing.xxxl, insets.bottom + Spacing.xl), gap: Spacing.md,
        }}
        refreshControl={onRefresh ? <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={Colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer && (
        <View className="bg-bg-primary border-t border-border px-xl pt-md" style={{ paddingBottom: Math.max(insets.bottom, Spacing.md) }}>
          <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>{footer}</View>
        </View>
      )}
    </View>
  );
}

export function WorkflowCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="bg-bg-surface border border-border rounded-lg p-lg gap-sm">
      {title && <Text className="text-md text-text-primary font-bevn-bold">{title}</Text>}
      {children}
    </View>
  );
}

export function WorkflowText({ children }: { children: ReactNode }) {
  return <Text className="text-sm text-text-secondary font-bevn-regular leading-[20px]">{children}</Text>;
}

export function WorkflowButton({ title, onPress, busy = false, disabled = false, secondary = false, icon }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean;
  /** Icon đứng trước chữ (tuỳ chọn) */
  icon?: string;
}) {
  return <Button title={title} onPress={onPress} loading={busy} disabled={disabled} variant={secondary ? 'secondary' : 'primary'} icon={icon} className="mt-xs" />;
}

export function WorkflowField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="gap-xs">
      <Text className="text-sm text-text-secondary font-bevn-medium">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.text.muted}
        {...props}
        className="bg-bg-elevated border border-border rounded-md p-md text-text-primary text-md font-bevn-regular"
      />
    </View>
  );
}

export function WorkflowState({ pending, error, empty, retry }: { pending?: boolean; error?: unknown; empty?: string; retry?: () => void }) {
  if (pending) return <ActivityIndicator color={Colors.primary} size="large" style={{ marginVertical: Spacing.xl }} />;
  if (error) {
    return (
      <View className="bg-bg-surface border rounded-lg p-lg gap-sm" style={{ borderColor: Colors.status.failed + '55' }}>
        <View className="flex-row items-start gap-sm">
          <Icon name="error-outline" size={18} color={Colors.status.failed} />
          <Text accessibilityRole="alert" className="flex-1 text-status-failed text-sm font-bevn-regular">
            {error instanceof Error ? error.message : 'Không tải được dữ liệu.'}
          </Text>
        </View>
        {retry && <Button title="Thử lại" variant="secondary" size="sm" icon="refresh" onPress={retry} />}
      </View>
    );
  }
  if (empty) {
    return (
      <View className="bg-bg-surface border border-border rounded-lg items-center px-xl py-xxl gap-sm">
        <Icon name="inbox" size={28} color={Colors.text.muted} />
        <Text className="text-sm text-text-muted font-bevn-regular text-center">{empty}</Text>
      </View>
    );
  }
  return null;
}

export const workflowStatus = (status: string) => ({
  WAITING: 'Đang chờ', PROMOTED: 'Đã được xếp chỗ', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
  OPEN: 'Mới tiếp nhận', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã giải quyết', CLOSED: 'Đã đóng', SUCCESS: 'Thành công', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền', ISSUED: 'Đã phát hành',
} as Record<string, string>)[status] || status;
