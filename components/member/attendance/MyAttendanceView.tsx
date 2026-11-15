// components/member/attendance/MyAttendanceView.tsx
// Chuyên cần & lịch sử điểm danh của hội viên (web: AttendancePage) — tỉ lệ theo lớp, quyết định chuyên cần (kèm khiếu nại),
// lịch sử điểm danh, nút quét QR / nhập mã. Logic ở hooks/member/useMyAttendanceScreen.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import clsx from 'clsx';
import { useRouter } from 'expo-router';
import { Icon } from '../../shared/Icon';
import { ScreenHeader } from '../../shared/ScreenHeader';
import { QrScannerModal } from '../../shared/QrScannerModal';
import { WorkflowButton, WorkflowState } from '../../shared/WorkflowScreen';
import { useMyAttendanceScreen } from '../../../hooks/member/useMyAttendanceScreen';
import {
  APPEAL_REASON_MAX, ATTENDANCE_STATUS_LABEL, BUCKET_STATUS_COLOR, BUCKET_STATUS_LABEL, MY_ATTENDANCE_TEXT as TEXT, PENALTY_STATUS_LABEL,
} from '../../../constants/attendance';
import { Colors } from '../../../constants/theme';
import { formatDate, formatDateTime } from '../../../lib/format';
import { ROUTES } from '../../../navigation/routes';

export function MyAttendanceView() {
  const router = useRouter();
  const a = useMyAttendanceScreen();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.home);
  };

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader title={TEXT.title} onBackPress={goBack} />

      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={a.refresh} tintColor={Colors.primary} />}
      >
        <View className="mb-xl">
          <WorkflowButton icon="qr-code-scanner" title={TEXT.scan} onPress={a.scanner.show} />
        </View>
        <WorkflowState error={a.summary.error || a.history.error} retry={() => { void a.refresh(); }} />

        {/* Tỉ lệ chuyên cần theo lớp */}
        <View className="mb-xl">
          <View className="flex-row items-center gap-1.5 mb-sm">
            <Icon name="insights" size={16} color={Colors.primary} />
            <Text className="text-md font-bold font-bevn-bold text-text-primary">{TEXT.rateTitle}</Text>
          </View>
          <Text className="text-xs text-text-muted font-bevn-regular mb-md">{TEXT.rateRule}</Text>

          {a.summary.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : a.buckets.length === 0 ? (
            // BE chỉ trả tỉ lệ cho lớp đã có buổi học (đã đặt) kết thúc — giải thích đúng lý do trống
            <View className="bg-bg-surface rounded-lg p-lg border border-border">
              <Text className="text-sm text-text-secondary font-bevn-medium">{TEXT.rateEmpty}</Text>
              <Text className="text-xs text-text-muted font-bevn-regular mt-1">{TEXT.rateEmptyHint}</Text>
            </View>
          ) : (
            a.buckets.map((b) => (
              <View key={b.classId} className="bg-bg-surface rounded-lg p-lg mb-sm border border-border">
                <View className="flex-row justify-between items-start mb-sm">
                  <View className="flex-1">
                    <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{b.className}</Text>
                    <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{TEXT.sampleSize(b.sampleSize)}</Text>
                  </View>
                  <Text className="text-xxl font-bold font-bevn-bold" style={{ color: BUCKET_STATUS_COLOR[b.status] }}>{b.attendanceRate}%</Text>
                </View>
                <View className="self-start rounded-full px-sm py-[3px] mb-xs" style={{ backgroundColor: BUCKET_STATUS_COLOR[b.status] + '20' }}>
                  <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: BUCKET_STATUS_COLOR[b.status] }}>{BUCKET_STATUS_LABEL[b.status]}</Text>
                </View>
                <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.counts(b)}</Text>
                <Text className="text-xs text-text-secondary font-bevn-regular mt-sm">
                  {b.policy === 'FIXED' ? TEXT.fixedPolicy(b.totalPlannedSessions) : TEXT.recurringPolicy} · {TEXT.absences(b)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Quyết định chuyên cần (hình phạt) */}
        {a.penalties.length > 0 && (
          <View className="mb-xl">
            <View className="flex-row items-center gap-1.5 mb-sm">
              <Icon name="warning" size={16} color={Colors.status.pending} />
              <Text className="text-md font-bold font-bevn-bold text-text-primary">{TEXT.penaltyTitle}</Text>
            </View>
            {a.penalties.map((p) => (
              <View key={p.id} className="bg-bg-surface rounded-lg p-lg mb-sm border border-border">
                <View className="flex-row justify-between items-start mb-sm">
                  <View className="flex-1">
                    <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{p.className}</Text>
                    <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{p.reason}</Text>
                  </View>
                  <View className="self-start bg-bg-elevated rounded-full px-sm py-[3px] mb-xs">
                    <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">{PENALTY_STATUS_LABEL[p.status]}</Text>
                  </View>
                </View>
                {Boolean(p.blockedUntil) && (
                  <Text className="text-xs text-status-expired mb-sm font-bevn-medium">{TEXT.blockedUntil(formatDate(p.blockedUntil!))}</Text>
                )}

                {p.appealedAt ? (
                  <Text className="text-xs text-status-booked font-bevn-medium">{TEXT.appealed(p.appealReason)}</Text>
                ) : p.canAppeal ? (
                  a.appeal.openId === p.id ? (
                    <View className="gap-sm">
                      <TextInput
                        className="bg-bg-elevated rounded-md p-md text-text-primary font-bevn-regular text-sm min-h-[60px] border border-border"
                        value={a.appeal.reason}
                        onChangeText={a.appeal.setReason}
                        placeholder={TEXT.appealPlaceholder}
                        placeholderTextColor={Colors.text.muted}
                        multiline
                        maxLength={APPEAL_REASON_MAX}
                      />
                      <View className="flex-row gap-sm">
                        <TouchableOpacity
                          className={clsx('flex-1 bg-primary rounded-md py-sm items-center', !a.appeal.canSubmit && 'opacity-60')}
                          onPress={() => a.appeal.submit(p.id)}
                          disabled={!a.appeal.canSubmit}
                        >
                          {a.appeal.isPending ? (
                            <ActivityIndicator color={Colors.text.inverse} size="small" />
                          ) : (
                            <Text className="text-text-inverse font-bold font-bevn-bold text-sm">{TEXT.appeal}</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity className="px-lg justify-center items-center rounded-md bg-bg-elevated border border-border" onPress={a.appeal.cancel}>
                          <Text className="text-text-muted text-sm font-bevn-medium">{TEXT.cancel}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity className="self-start" onPress={() => a.appeal.start(p.id)}>
                      <Text className="text-sm text-primary font-semibold font-bevn-semibold">{TEXT.appeal}</Text>
                    </TouchableOpacity>
                  )
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Lịch sử điểm danh */}
        <View className="mb-xl">
          <View className="flex-row items-center gap-1.5 mb-sm">
            <Icon name="history" size={16} color={Colors.primary} />
            <Text className="text-md font-bold font-bevn-bold text-text-primary">{TEXT.historyTitle}</Text>
          </View>
          {a.history.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : a.records.length === 0 ? (
            <View className="bg-bg-surface rounded-xl px-xl py-xxl items-center border border-border">
              <Icon name="event-busy" size={32} color={Colors.text.muted} style={{ marginBottom: 8 }} />
              <Text className="text-md text-text-primary font-bevn-semibold">{TEXT.historyEmpty}</Text>
              <Text className="text-xs text-text-muted font-bevn-regular mt-1 text-center">{TEXT.historyEmptyHint}</Text>
            </View>
          ) : (
            a.records.map((r) => (
              <View key={r.id} className="bg-bg-surface rounded-lg p-lg mb-sm border border-border">
                <View className="flex-row justify-between items-start mb-sm">
                  <View className="flex-1">
                    <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{r.schedule?.class?.name ?? TEXT.sessionFallback}</Text>
                    <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{r.schedule ? formatDateTime(r.schedule.startTime) : '—'}</Text>
                  </View>
                  <View className="self-start bg-bg-elevated rounded-full px-sm py-[3px] mb-xs">
                    <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">{ATTENDANCE_STATUS_LABEL[r.status]}</Text>
                  </View>
                </View>
                {Boolean(r.note) && <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{r.note}</Text>}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <QrScannerModal visible={a.scanner.open} onClose={a.scanner.close} isSubmitting={a.scanner.isSubmitting} onSubmitCredential={a.scanner.submit} />
    </View>
  );
}
