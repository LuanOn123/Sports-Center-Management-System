// components/coach/AttendanceStatusPicker.tsx
// Hộp chọn trạng thái điểm danh cho một học viên (HLV: Có mặt / Đi muộn / Vắng mặt)

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import {
  ATTENDANCE_STATUS_COLOR, ATTENDANCE_STATUS_LABEL, COACH_ATTENDANCE_STATUSES,
} from '../../constants/attendance';
import type { AttendanceStatus } from '../../lib/types';

interface AttendanceStatusPickerProps {
  visible: boolean;
  memberName?: string;
  onSelect: (status: AttendanceStatus) => void;
  onClose: () => void;
}

export function AttendanceStatusPicker({ visible, memberName, onSelect, onClose }: AttendanceStatusPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-overlay justify-center items-center p-xl" activeOpacity={1} onPress={onClose}>
        <View className="bg-bg-surface rounded-xl p-xl w-full max-w-[320px] border border-border">
          <Text className="text-md font-bevn-bold text-text-primary mb-xs">Kết quả điểm danh</Text>
          {Boolean(memberName) && <Text className="text-sm text-text-secondary font-bevn-regular mb-lg">{memberName}</Text>}
          {COACH_ATTENDANCE_STATUSES.map((status) => (
            <TouchableOpacity
              key={status}
              className="flex-row items-center gap-md py-md px-md rounded-md mb-xs bg-bg-elevated border-l-4"
              style={{ borderLeftColor: ATTENDANCE_STATUS_COLOR[status] }}
              onPress={() => onSelect(status)}
            >
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ATTENDANCE_STATUS_COLOR[status] }} />
              <Text className="text-sm font-bevn-semibold text-text-primary">{ATTENDANCE_STATUS_LABEL[status]}</Text>
            </TouchableOpacity>
          ))}
          <Text className="text-xs text-text-muted font-bevn-regular mt-sm">
            Điểm danh đã lưu chỉ quản lý được sửa. "Vắng có phép" do quản lý ghi nhận.
          </Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
