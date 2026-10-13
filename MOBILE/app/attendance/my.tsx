import { vietnamDate } from '../../lib/date';
// app/attendance/my.tsx
// Chuyên cần & lịch sử điểm danh của hội viên — tỉ lệ theo lớp, hình phạt (kèm khiếu nại), lịch sử điểm danh

import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import clsx from 'clsx';
import { useFocusEffect, useRouter } from 'expo-router';
import { Icon } from '../../components/shared/Icon';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { useMyAttendance, useMyAttendanceSummary, useAppealPenalty } from '../../hooks/member/useAttendance';
import { Colors } from '../../constants/theme';
import { Haptic } from '../../lib/haptics';
import type { AttendanceStatus, AttendanceBucketStatus, AttendancePenaltyStatus } from '../../lib/types';
import { ROUTES } from '../../navigation/routes';
import { QrScannerModal } from '../../components/shared/QrScannerModal';
import { useScanAttendance } from '../../hooks/member/useAttendance';
import { WorkflowButton, WorkflowState } from '../../components/shared/WorkflowScreen';
import { showAlert } from '../../lib/alert';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng mặt',
  LATE: 'Đi muộn',
  EXCUSED: 'Vắng có phép',
};

const BUCKET_STATUS_LABEL: Record<AttendanceBucketStatus, string> = {
  NORMAL: 'Bình thường',
  NOTICE: 'Nhắc nhở',
  WARNING: 'Cảnh báo',
};

const BUCKET_STATUS_COLOR: Record<AttendanceBucketStatus, string> = {
  NORMAL: Colors.status.success,
  NOTICE: Colors.status.pending,
  WARNING: Colors.status.expired,
};

const PENALTY_STATUS_LABEL: Record<AttendancePenaltyStatus, string> = {
  PENDING: 'Đang chờ',
  APPLIED: 'Đã áp dụng',
  REVOKED: 'Đã gỡ',
  EXPIRED: 'Đã hết hiệu lực',
};

// toLocaleDateString('vi-VN', ...) không đáng tin trên RN/Hermes — ICU của máy
// có thể trả dấu "-" thay vì "/" giữa ngày/tháng. Tự ghép chuỗi cho chắc.
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${pad2(vietnamDate(d).getUTCDate())}/${pad2(vietnamDate(d).getUTCMonth() + 1)}/${vietnamDate(d).getUTCFullYear()}`;
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(vietnamDate(d).getUTCDate())}/${pad2(vietnamDate(d).getUTCMonth() + 1)}/${vietnamDate(d).getUTCFullYear()} ${pad2(vietnamDate(d).getUTCHours())}:${pad2(vietnamDate(d).getUTCMinutes())}`;
}

export default function MyAttendanceScreen() {
  const router = useRouter();
  const [appealingId, setAppealingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const scan = useScanAttendance();

  const history = useMyAttendance();
  const summary = useMyAttendanceSummary();
  const appealMutation = useAppealPenalty();

  const refetchSummary = summary.refetch;
  const refetchHistory = history.refetch;
  useFocusEffect(
    useCallback(() => {
      refetchSummary();
      refetchHistory();
    }, [refetchSummary, refetchHistory])
  );

  const handleGoBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(ROUTES.home);
  };

  const onRefresh = async () => {
    Haptic.light();
    await Promise.all([summary.refetch(), history.refetch()]);
  };

  const startAppeal = (id: string) => {
    Haptic.light();
    setAppealingId(id);
    setReason('');
  };

  const submitAppeal = (id: string) => {
    if (reason.trim().length < 5) return;
    Haptic.medium();
    appealMutation.mutate(
      { id, reason: reason.trim() },
      {
        onSuccess: () => {
          Haptic.success();
          setAppealingId(null);
          setReason('');
        },
        onError: () => {
          Haptic.error();
        },
      }
    );
  };

  const buckets = summary.data?.data?.buckets ?? [];
  const penalties = summary.data?.data?.penalties ?? [];
  const records = history.data?.data ?? [];

  return (
    <View className="flex-1 bg-bg-primary">
      <ScreenHeader
        title="Chuyên cần & Điểm danh"
        subtitle="Tỉ lệ tham gia & lịch sử điểm danh"
        onBackPress={handleGoBack}
      />


      <ScrollView
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View className="mb-xl">
          <WorkflowButton icon="qr-code-scanner" title="Quét QR / Nhập mã điểm danh" onPress={() => setScannerOpen(true)} />
        </View>
        <WorkflowState error={summary.error || history.error} retry={() => { void onRefresh(); }} />
        {/* Tỉ lệ chuyên cần theo lớp */}
        <View className="mb-xl">
          <View className="flex-row items-center gap-1.5 mb-sm">
            <Icon name="insights" size={16} color={Colors.primary} />
            <Text className="text-md font-bold font-bevn-bold text-text-primary">Tỉ lệ chuyên cần theo lớp</Text>
          </View>
          <Text className="text-xs text-text-muted font-bevn-regular mb-md">Khóa cố định tính số lần vắng theo 20% tổng buổi kế hoạch. Lớp định kỳ tính trên 10 buổi gần nhất, tối thiểu 5 buổi. Cảnh báo chỉ để tham khảo; hạn chế đặt lớp do quản lý quyết định.</Text>

          {summary.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : buckets.length === 0 ? (
            // BE chỉ trả tỉ lệ cho lớp đã có buổi học (đã đặt) kết thúc — giải thích đúng lý do trống
            <View className="bg-bg-surface rounded-lg p-lg border border-border">
              <Text className="text-sm text-text-secondary font-bevn-medium">Chưa có dữ liệu chuyên cần.</Text>
              <Text className="text-xs text-text-muted font-bevn-regular mt-1">Tỉ lệ sẽ hiển thị sau khi buổi học đầu tiên bạn đã đặt kết thúc.</Text>
            </View>
          ) : (
            buckets.map((b) => (
              <View key={b.classId} className="bg-bg-surface rounded-lg p-lg mb-sm border border-border">
                <View className="flex-row justify-between items-start mb-sm">
                  <View className="flex-1">
                    <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{b.className}</Text>
                    <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{b.sampleSize} buổi được tính</Text>
                  </View>
                  <Text className="text-xxl font-bold font-bevn-bold" style={{ color: BUCKET_STATUS_COLOR[b.status] }}>{b.attendanceRate}%</Text>
                </View>
                <View className="self-start bg-bg-elevated rounded-full px-sm py-[3px] mb-xs" style={{ backgroundColor: BUCKET_STATUS_COLOR[b.status] + '20' }}>
                  <Text className="text-xs font-semibold font-bevn-semibold" style={{ color: BUCKET_STATUS_COLOR[b.status] }}>{BUCKET_STATUS_LABEL[b.status]}</Text>
                </View>
                <Text className="text-xs text-text-muted font-bevn-regular">
                  Có mặt {b.presentCount} · muộn {b.lateCount} · vắng {b.absentCount} · không điểm danh {b.noShowCount} · có phép {b.excusedCount}
                </Text>
                <Text className="text-xs text-text-secondary font-bevn-regular mt-sm">{b.policy === 'FIXED' ? `Khóa cố định · ${b.totalPlannedSessions ?? '—'} buổi kế hoạch` : 'Lớp định kỳ'} · Vắng {b.currentAbsences}/{b.allowedAbsences} · Còn {b.remainingAbsences} lần vắng</Text>
              </View>
            ))
          )}
        </View>

        {/* Quyết định chuyên cần (hình phạt) */}
        {penalties.length > 0 && (
          <View className="mb-xl">
            <View className="flex-row items-center gap-1.5 mb-sm">
              <Icon name="warning" size={16} color="#D97706" />
              <Text className="text-md font-bold font-bevn-bold text-text-primary">Quyết định chuyên cần</Text>
            </View>
            {penalties.map((p) => (
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
                  <Text className="text-xs text-status-expired mb-sm font-bevn-medium">Không thể đặt lại lớp đến {formatDate(p.blockedUntil!)}.</Text>
                )}

                {p.appealedAt ? (
                  <Text className="text-xs text-status-booked font-bevn-medium">Đã gửi khiếu nại: {p.appealReason}</Text>
                ) : p.canAppeal ? (
                  appealingId === p.id ? (
                    <View className="gap-sm">
                      <TextInput
                        className="bg-bg-elevated rounded-md p-md text-text-primary font-bevn-regular text-sm min-h-[60px] border border-border"
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Nêu rõ lý do khiếu nại (ít nhất 5 ký tự)..."
                        placeholderTextColor={Colors.text.muted}
                        multiline
                        maxLength={1000}
                      />
                      <View className="flex-row gap-sm">
                        <TouchableOpacity
                          className={clsx(
                            'flex-1 bg-primary rounded-md py-sm items-center',
                            (reason.trim().length < 5 || appealMutation.isPending) && 'opacity-60'
                          )}
                          onPress={() => submitAppeal(p.id)}
                          disabled={reason.trim().length < 5 || appealMutation.isPending}
                        >
                          {appealMutation.isPending ? (
                            <ActivityIndicator color={Colors.text.inverse} size="small" />
                          ) : (
                            <Text className="text-text-inverse font-bold font-bevn-bold text-sm">Gửi khiếu nại</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity className="px-lg justify-center items-center rounded-md bg-bg-elevated border border-border" onPress={() => setAppealingId(null)}>
                          <Text className="text-text-muted text-sm font-bevn-medium">Hủy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity className="self-start" onPress={() => startAppeal(p.id)}>
                      <Text className="text-sm text-primary font-semibold font-bevn-semibold">Gửi khiếu nại</Text>
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
            <Text className="text-md font-bold font-bevn-bold text-text-primary">Lịch sử điểm danh</Text>
          </View>
          {history.isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : records.length === 0 ? (
            <View className="bg-bg-surface rounded-xl px-xl py-xxl items-center border border-border">
              <Icon name="event-busy" size={32} color={Colors.text.muted} style={{ marginBottom: 8 }} />
              <Text className="text-md text-text-primary font-bevn-semibold">Chưa có bản ghi điểm danh</Text>
              <Text className="text-xs text-text-muted font-bevn-regular mt-1 text-center">Các buổi điểm danh của bạn sẽ xuất hiện tại đây.</Text>
            </View>
          ) : (
            records.map((r) => (
              <View key={r.id} className="bg-bg-surface rounded-lg p-lg mb-sm border border-border">
                <View className="flex-row justify-between items-start mb-sm">
                  <View className="flex-1">
                    <Text className="text-md font-semibold font-bevn-semibold text-text-primary">{r.schedule?.class?.name ?? 'Buổi học'}</Text>
                    <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{r.schedule ? formatDateTime(r.schedule.startTime) : '—'}</Text>
                  </View>
                  <View className="self-start bg-bg-elevated rounded-full px-sm py-[3px] mb-xs">
                    <Text className="text-xs font-semibold font-bevn-semibold text-text-secondary">{STATUS_LABEL[r.status]}</Text>
                  </View>
                </View>
                {Boolean(r.note) && <Text className="text-xs text-text-secondary mt-0.5 font-bevn-regular">{r.note}</Text>}
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <QrScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} isSubmitting={scan.isPending} onSubmitCredential={(credential) => scan.mutate(credential, { onSuccess: () => { setScannerOpen(false); showAlert('Điểm danh thành công', 'Đã ghi nhận điểm danh của bạn.'); }, onError: (e) => showAlert('Không thể điểm danh', e.message) })} />
    </View>
  );
}
