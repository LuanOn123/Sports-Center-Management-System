// components/shared/NoFacilityScreen.tsx
// Hiện khi đã đăng nhập nhưng không có cơ sở nào để làm việc (vd. HLV chưa được phân công cơ sở).
// Không có cơ sở thì gần như mọi API nghiệp vụ đều bị BE từ chối (400/403).

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Icon } from './Icon';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../lib/alert';
import { ApiError } from '../../lib/api';
import { Colors } from '../../constants/theme';

export function NoFacilityScreen() {
  const { user, reloadFacilities, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await reloadFacilities();
    } catch (e) {
      showAlert('Lỗi', e instanceof ApiError ? e.message : 'Không tải được danh sách cơ sở. Vui lòng thử lại.');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View className="flex-1 bg-bg-primary justify-center items-center p-xl">
      <Icon name="place" size={48} color={Colors.text.muted} style={{ marginBottom: 16 }} />
      <Text className="text-xl font-bold font-bevn-bold text-text-primary text-center mb-sm">Chưa có cơ sở khả dụng</Text>
      <Text className="text-sm text-text-secondary font-bevn-regular text-center mb-xl">
        {user?.role === 'COACH'
          ? 'Tài khoản của bạn chưa được phân công vào cơ sở nào. Vui lòng liên hệ quản lý để được phân công.'
          : 'Hiện chưa có cơ sở nào đang hoạt động. Vui lòng thử lại sau.'}
      </Text>
      <TouchableOpacity
        className="bg-primary rounded-md py-md px-xxl items-center justify-center mb-md min-w-[200px]"
        onPress={handleRetry}
        disabled={retrying}
        activeOpacity={0.85}
      >
        {retrying
          ? <ActivityIndicator color={Colors.text.inverse} />
          : <Text className="text-text-inverse text-md font-bold font-bevn-bold">Thử lại</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={logout} activeOpacity={0.7}>
        <Text className="text-text-muted text-sm font-bevn-medium">Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}
