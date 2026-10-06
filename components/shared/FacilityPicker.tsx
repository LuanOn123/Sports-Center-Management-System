// components/shared/FacilityPicker.tsx
// Chip hiển thị cơ sở đang chọn; nếu có nhiều cơ sở thì bấm để đổi.
// BE gắn lớp học/gói tập/lịch/điểm danh theo từng cơ sở nên người dùng cần biết mình đang xem cơ sở nào.

import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { Icon } from './Icon';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import { Colors } from '../../constants/theme';

export function FacilityPicker() {
  const { facilities, currentFacility, selectFacility } = useAuth();
  const [open, setOpen] = useState(false);

  if (!currentFacility) return null;
  const canSwitch = facilities.length > 1;

  const handleSelect = async (id: string) => {
    setOpen(false);
    try {
      await selectFacility(id);
    } catch (e) {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Không đổi được cơ sở. Vui lòng thử lại.');
    }
  };

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center gap-1.5 self-start bg-bg-surface border border-border rounded-full px-md py-1.5 mb-lg"
        onPress={() => canSwitch && setOpen(true)}
        disabled={!canSwitch}
        activeOpacity={0.7}
      >
        <Icon name="place" size={14} color={Colors.primary} />
        <Text className="text-xs font-bevn-semibold text-text-primary" numberOfLines={1}>{currentFacility.name}</Text>
        {canSwitch && <Icon name="arrow-drop-down" size={16} color={Colors.text.muted} />}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          className="flex-1 bg-[rgba(0,0,0,0.75)] justify-center items-center p-xl"
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} className="w-full max-w-[400px] max-h-[70%] bg-bg-surface rounded-xl p-xl border border-border">
            <Text className="text-lg font-bold font-bevn-bold text-text-primary mb-md text-center">Chọn cơ sở</Text>
            <ScrollView>
              {facilities.map((f) => {
                const active = f.id === currentFacility.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    className={clsx(
                      'flex-row items-center gap-md rounded-lg p-md mb-sm border',
                      active ? 'bg-[#A3E63515] border-primary' : 'bg-bg-elevated border-border'
                    )}
                    onPress={() => handleSelect(f.id)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-1">
                      <Text className="text-md font-bold font-bevn-bold text-text-primary">{f.name}</Text>
                      {Boolean(f.address) && (
                        <Text className="text-xs text-text-muted font-bevn-regular mt-0.5" numberOfLines={2}>{f.address}</Text>
                      )}
                    </View>
                    {active && <Icon name="check-circle" size={20} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
