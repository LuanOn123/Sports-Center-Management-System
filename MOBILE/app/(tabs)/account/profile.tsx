// app/(tabs)/account/profile.tsx — Thông tin cá nhân & bảo mật (mở từ menu Tài khoản, nằm trong Stack của tab Tài khoản
// nên vẫn có thanh tab, tab Tài khoản sáng và vuốt từ trái sang phải để quay lại); giao diện ở components/profile/ProfileView
import React from 'react';
import { ProfileView } from '../../../components/profile/ProfileView';

export default function ProfileScreen() {
  return <ProfileView />;
}
