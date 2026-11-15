// components/profile/ProfileSummary.tsx
// Đầu màn Thông tin cá nhân: ảnh đại diện (chạm để đổi), họ tên, email, vai trò. Logic ở hooks/shared/useAvatarUpload.

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useAvatarUpload } from '../../hooks/shared/useAvatarUpload';
import { ROLE_LABEL } from '../../constants/profile';
import { Colors } from '../../constants/theme';

export function ProfileSummary() {
  const { user } = useAuth();
  const avatar = useAvatarUpload();
  const isCoach = user?.role === 'COACH';

  return (
    <View className="items-center mb-xl">
      <TouchableOpacity className="mb-md" onPress={() => { void avatar.pick(); }} disabled={avatar.isUploading} activeOpacity={0.8}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName} size={80} />
        <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-bg-elevated border-2 border-bg-primary justify-center items-center">
          {avatar.isUploading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Icon name="photo-camera" size={14} color={Colors.text.primary} />
          )}
        </View>
      </TouchableOpacity>
      <Text className="text-xl font-bold font-bevn-bold text-text-primary">{user?.fullName}</Text>
      <Text className="text-sm text-text-secondary mt-0.5 font-bevn-regular">{user?.email}</Text>
      <View className={clsx('flex-row items-center gap-1 mt-sm bg-[#D4FF0020] rounded-full px-lg py-1', isCoach && 'bg-[#D4FF0025] border border-[#D4FF0040]')}>
        <Icon name={isCoach ? 'sports' : 'person'} size={14} color={Colors.primary} />
        <Text className="text-primary text-sm font-semibold font-bevn-semibold">{ROLE_LABEL[user?.role ?? 'MEMBER']}</Text>
      </View>
    </View>
  );
}
