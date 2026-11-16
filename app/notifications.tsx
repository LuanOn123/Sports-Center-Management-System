// app/notifications.tsx — Thông báo (mở từ chuông ở đầu các màn và từ menu Tài khoản); giao diện ở components/notifications/NotificationsView
// Nằm ngoài tabs (như Chính sách, Hướng dẫn…) để vuốt từ trái sang phải quay về đúng màn vừa bấm chuông.
import React from 'react';
import { NotificationsView } from '../components/notifications/NotificationsView';

export default function NotificationsScreen() {
  return <NotificationsView />;
}
