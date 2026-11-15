// components/profile/ProfileView.tsx
// Màn "Thông tin cá nhân" (web: ProfilePage / CoachProfile): ảnh + vai trò, thẻ HLV, tab Thông tin cá nhân | Bảo mật.
// Mỗi phần có hook riêng (useAvatarUpload, useProfileInfoForm, useChangePassword); cuộn tới ô đang nhập ở hooks/shared/useProfileScroll.

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import clsx from 'clsx';
import { ScreenHeader } from '../shared/ScreenHeader';
import { KeyboardAwareView } from '../shared/KeyboardAwareView';
import { CoachSpecializations } from '../coach/CoachSpecializations';
import { ChangePasswordForm } from './ChangePasswordForm';
import { CoachInfoCard } from './CoachInfoCard';
import { ProfileInfoForm } from './ProfileInfoForm';
import { ProfileSummary } from './ProfileSummary';
import { useAuth } from '../../context/AuthContext';
import { useProfileScroll } from '../../hooks/shared/useProfileScroll';
import { PASSWORD_CHANGE_TEXT, PROFILE_SCREEN_TEXT } from '../../constants/profile';

type ProfileTab = 'info' | 'security';

/** Khoảng đệm đáy trang: nới ra khi đang nhập để cuộn tới được ô cuối form dù bàn phím che */
const BOTTOM_PADDING = { idle: 40, typing: 200 } as const;

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className={clsx('flex-1 py-sm rounded-md items-center border', active ? 'bg-primary border-primary' : 'bg-bg-surface border-border')}
      onPress={onPress}
    >
      <Text className={clsx('text-sm font-bevn-medium', active ? 'text-text-inverse font-bold font-bevn-bold' : 'text-text-secondary')}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ProfileView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('info');
  const scroll = useProfileScroll();
  const coachId = user?.role === 'COACH' ? user.coachProfile?.id : undefined;

  return (
    <KeyboardAwareView className="flex-1 bg-bg-primary">
      <ScreenHeader title={PROFILE_SCREEN_TEXT.title} />

      <ScrollView
        ref={scroll.scrollViewRef}
        className="flex-1 bg-bg-primary"
        contentContainerStyle={{ padding: 20, paddingBottom: scroll.isInputFocused ? BOTTOM_PADDING.typing : BOTTOM_PADDING.idle }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <ProfileSummary />

        {/* Thẻ thông tin riêng cho Huấn luyện viên */}
        {user?.role === 'COACH' && <CoachInfoCard />}
        {coachId && <View className="mb-lg"><CoachSpecializations coachId={coachId} /></View>}

        {/* Tabs */}
        <View className="flex-row gap-md mb-lg">
          <TabButton label={PASSWORD_CHANGE_TEXT.tabInfo} active={tab === 'info'} onPress={() => setTab('info')} />
          <TabButton label={PASSWORD_CHANGE_TEXT.tabSecurity} active={tab === 'security'} onPress={() => setTab('security')} />
        </View>

        {tab === 'info' && <ProfileInfoForm onFieldFocus={scroll.handleFocus} getInputRef={scroll.getInputRef} />}
        {tab === 'security' && <ChangePasswordForm onFieldFocus={scroll.handleFocus} getInputRef={scroll.getInputRef} />}
        {/* Đăng xuất: nằm ở tab Tài khoản (một lối vào duy nhất) */}
      </ScrollView>
    </KeyboardAwareView>
  );
}
