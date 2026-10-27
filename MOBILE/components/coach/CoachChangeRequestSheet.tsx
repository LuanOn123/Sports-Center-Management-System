// components/coach/CoachChangeRequestSheet.tsx
// Bảng tạo yêu cầu đổi HLV: chọn một buổi sắp tới mình được phân công + ghi lý do (web: modal "Yêu cầu đổi huấn luyện viên")

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { WorkflowState } from '../shared/WorkflowScreen';
import { Button } from '../ui';
import { Colors, Spacing } from '../../constants/theme';
import { COACH_CHANGE_REASON_MAX, COACH_CHANGE_TEXT } from '../../constants/coachChanges';
import { formatSessionWindow } from '../../lib/coachChange';
import type { CoachChangeSheetState } from '../../hooks/coach/useCoachChanges';

export function CoachChangeRequestSheet({ sheet }: { sheet: CoachChangeSheetState }) {
  const insets = useSafeAreaInsets();
  const { sessions, create } = sheet;
  const busy = create.isPending;

  return (
    <Modal visible={sheet.open} transparent animationType="slide" onRequestClose={sheet.close}>
      <KeyboardAwareView>
        <TouchableOpacity className="flex-1 bg-overlay justify-end" activeOpacity={1} onPress={sheet.close}>
          <TouchableOpacity
            activeOpacity={1}
            className="bg-bg-surface rounded-t-xl border-t border-border px-xl pt-xl"
            style={{ paddingBottom: Math.max(insets.bottom, Spacing.lg), maxHeight: '90%' }}
          >
            <View className="flex-row items-center mb-md">
              <Text className="flex-1 text-lg font-bevn-bold text-text-primary mr-sm">{COACH_CHANGE_TEXT.sheetTitle}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng" onPress={sheet.close} disabled={busy} hitSlop={12}>
                <Icon name="close" size={22} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
              <Text className="text-sm text-text-secondary font-bevn-medium">{COACH_CHANGE_TEXT.sessionLabel}</Text>
              {sessions.isPending ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
              ) : sessions.error ? (
                <WorkflowState error={sessions.error} retry={() => { void sessions.refetch(); }} />
              ) : !sessions.data?.length ? (
                <Text className="text-sm text-text-muted font-bevn-regular leading-[20px]">{COACH_CHANGE_TEXT.noSessions}</Text>
              ) : (
                <View className="gap-sm">
                  {sessions.data.map((session) => {
                    const selected = session.id === sheet.scheduleId;
                    return (
                      <TouchableOpacity
                        key={session.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: busy }}
                        disabled={busy}
                        onPress={() => sheet.setScheduleId(session.id)}
                        activeOpacity={0.8}
                        className={clsx('flex-row items-center gap-sm rounded-lg p-md border', selected ? 'border-primary bg-bg-elevated' : 'border-border')}
                      >
                        <Icon name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={18} color={selected ? Colors.primary : Colors.text.muted} />
                        <View className="flex-1">
                          <Text className="text-md text-text-primary font-bevn-semibold" numberOfLines={1}>{session.class.name}</Text>
                          <Text className="text-xs text-text-secondary font-bevn-regular mt-0.5">
                            {formatSessionWindow(session.startTime, session.endTime)}{session.room?.name ? ` · ${session.room.name}` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {sheet.chosenSession && (
                <View className="flex-row gap-sm rounded-md p-md border" style={{ backgroundColor: Colors.status.scheduled + '12', borderColor: Colors.status.scheduled + '40' }}>
                  <Icon name="info-outline" size={16} color={Colors.status.scheduled} style={{ marginTop: 2 }} />
                  <Text className="flex-1 text-sm text-text-secondary font-bevn-regular leading-[20px]">{COACH_CHANGE_TEXT.scopeNote}</Text>
                </View>
              )}

              <Text className="text-sm text-text-secondary font-bevn-medium">{COACH_CHANGE_TEXT.reasonLabel}</Text>
              <TextInput
                accessibilityLabel={COACH_CHANGE_TEXT.reasonLabel}
                value={sheet.reason}
                onChangeText={sheet.setReason}
                editable={!busy}
                multiline
                maxLength={COACH_CHANGE_REASON_MAX}
                placeholder={COACH_CHANGE_TEXT.reasonPlaceholder}
                placeholderTextColor={Colors.text.muted}
                textAlignVertical="top"
                className="bg-bg-elevated border border-border rounded-md p-md text-text-primary text-md font-bevn-regular min-h-[104px]"
              />
              <View className="flex-row justify-between">
                <Text className="text-xs text-status-failed font-bevn-regular">{sheet.reasonError ?? ''}</Text>
                <Text className="text-xs text-text-muted font-bevn-regular">{sheet.reason.trim().length}/{COACH_CHANGE_REASON_MAX}</Text>
              </View>
              <WorkflowState error={create.error} />
            </ScrollView>

            <Button title={busy ? 'Đang gửi…' : COACH_CHANGE_TEXT.submit} icon="send" loading={busy} disabled={!sheet.canSubmit} onPress={sheet.submit} className="mt-sm" />
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareView>
    </Modal>
  );
}
