// context/AssistantContext.tsx
// Giữ cuộc trò chuyện với trợ lý AI ở cấp gốc ứng dụng: bong bóng nổi và màn chat dùng chung một trạng thái,
// nên đóng màn chat rồi mở lại vẫn thấy nội dung cũ (chỉ trong bộ nhớ, đăng xuất / đổi tài khoản / đổi cơ sở thì xóa).

import React, { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useAssistantSession, type AssistantSession } from '../hooks/shared/useAssistantSession';

const AssistantContext = createContext<AssistantSession | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { user, currentFacility } = useAuth();
  // Không dùng `key` để làm mới: key đổi sẽ dựng lại cả cây màn hình (mất vị trí điều hướng)
  const session = useAssistantSession(`${user?.id ?? ''}:${currentFacility?.id ?? ''}`);
  return <AssistantContext.Provider value={session}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('useAssistant must be used within AssistantProvider');
  return value;
}
