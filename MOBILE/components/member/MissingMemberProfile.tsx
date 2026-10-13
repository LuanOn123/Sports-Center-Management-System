// components/member/MissingMemberProfile.tsx
// Báo tài khoản chưa có hồ sơ hội viên (web: "Chưa có hồ sơ hội viên.") — thay cho việc gọi API
// bằng id sai rồi nhận "Member not found". Nút "Tải lại" lấy lại /auth/me sau khi trung tâm xử lý.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from '../shared/Icon';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';

export function MissingMemberProfile() {
  const { refreshUser } = useAuth();
  const [reloading, setReloading] = useState(false);

  const reload = async () => {
    setReloading(true);
    try {
      await refreshUser();
    } finally {
      setReloading(false);
    }
  };

  return (
    <View className="bg-bg-surface rounded-xl p-xl mb-lg border border-border items-center">
      <Icon name="person-outline" size={36} color={Colors.text.muted} />
      <Text className="text-md font-bevn-bold text-text-primary mt-md text-center">Chưa có hồ sơ hội viên</Text>
      <Text className="text-sm text-text-secondary font-bevn-regular mt-xs text-center">
        Tài khoản của bạn chưa được tạo hồ sơ hội viên nên chưa dùng được gói tập, đặt lớp và thanh toán. Vui lòng liên hệ trung tâm để được hỗ trợ.
      </Text>
      <TouchableOpacity className="flex-row items-center gap-1.5 mt-lg px-lg py-sm rounded-md border border-border" onPress={reload} disabled={reloading}>
        {reloading ? <ActivityIndicator size="small" color={Colors.text.secondary} /> : <Icon name="refresh" size={16} color={Colors.text.secondary} />}
        <Text className="text-sm text-text-secondary font-bevn-semibold">Tải lại</Text>
      </TouchableOpacity>
    </View>
  );
}
