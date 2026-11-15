// app/chat/[userId].tsx — một cuộc trò chuyện ("general" = Phòng chung); giao diện ở components/chat/ChatThreadView
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChatThreadView } from '../../components/chat/ChatThreadView';

export default function ChatScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  return <ChatThreadView userId={userId} name={name} />;
}
