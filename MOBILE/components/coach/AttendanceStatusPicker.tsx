// components/coach/AttendanceStatusPicker.tsx
// Hộp ghi điểm danh cho một học viên (web: "Kết quả điểm danh" + "Ghi chú điểm danh"): HLV gõ ghi chú (không bắt buộc) rồi chọn
// Có mặt / Đi muộn / Vắng mặt — chọn xong là lưu luôn kèm ghi chú.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { BottomSheet } from '../shared/BottomSheet';
import {
  ATTENDANCE_NOTE_MAX_LENGTH, ATTENDANCE_STATUS_COLOR, ATTENDANCE_STATUS_LABEL, COACH_ATTENDANCE_STATUSES, COACH_ATTENDANCE_TEXT as TEXT,
} from '../../constants/attendance';
import { Colors } from '../../constants/theme';
import type { AttendanceStatus } from '../../lib/types';

interface AttendanceStatusPickerProps {
  visible: boolean;
  memberName?: string;
  /** `note`: ghi chú đang gõ (có thể trống) — hook làm sạch trước khi gửi */
  onSelect: (status: AttendanceStatus, note: string) => void;
  onClose: () => void;
}

export function AttendanceStatusPicker({ visible, memberName, onSelect, onClose }: AttendanceStatusPickerProps) {
  const [note, setNote] = useState('');

  // Mỗi lần mở cho một học viên, ô ghi chú bắt đầu trống
  useEffect(() => {
    if (visible) setNote('');
  }, [visible, memberName]);

  return (
    <BottomSheet visible={visible} title={TEXT.pickerTitle} caption={memberName} onClose={onClose}>
      <View className="gap-xs">
        <Text className="text-sm font-bevn-semibold text-text-primary">{TEXT.noteLabel}</Text>
        <TextInput
          accessibilityLabel={TEXT.noteLabel}
          className="bg-bg-elevated rounded-md p-md text-text-primary text-sm border border-border font-bevn-regular min-h-[64px]"
          value={note}
          onChangeText={setNote}
          maxLength={ATTENDANCE_NOTE_MAX_LENGTH}
          multiline
          textAlignVertical="top"
          placeholder={TEXT.notePlaceholder}
          placeholderTextColor={Colors.text.muted}
        />
      </View>
      {COACH_ATTENDANCE_STATUSES.map((status) => (
        <TouchableOpacity
          key={status}
          accessibilityRole="button"
          accessibilityLabel={ATTENDANCE_STATUS_LABEL[status]}
          className="flex-row items-center gap-md py-md px-md rounded-md bg-bg-elevated border-l-4"
          style={{ borderLeftColor: ATTENDANCE_STATUS_COLOR[status] }}
          onPress={() => onSelect(status, note)}
        >
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ATTENDANCE_STATUS_COLOR[status] }} />
          <Text className="text-sm font-bevn-semibold text-text-primary">{ATTENDANCE_STATUS_LABEL[status]}</Text>
        </TouchableOpacity>
      ))}
      <Text className="text-xs text-text-muted font-bevn-regular">{TEXT.pickerHint}</Text>
    </BottomSheet>
  );
}
