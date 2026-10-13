import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { WorkflowScreen, WorkflowCard, WorkflowText, WorkflowButton, WorkflowField, WorkflowState } from '../components/shared/WorkflowScreen';

type Message = { role: 'user' | 'assistant'; content: string };
function Conversation() {
  const [history, setHistory] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function send() {
    if (!message.trim() || busy) return;
    const text = message.trim();
    setBusy(true); setError(undefined);
    const controller = new AbortController(); request.current = controller;
    try {
      const reply = await apiRequest<{ reply: string }>('/ai/chat', 'POST', { body: { message: text, history: history.slice(-20) }, signal: controller.signal });
      if (!reply.data.reply?.trim()) throw new Error('AI chưa trả về nội dung. Vui lòng thử lại.');
      if (!controller.signal.aborted) { setHistory((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply.data.reply }]); setMessage(''); }
    } catch (e) { if (!controller.signal.aborted) setError(e); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <WorkflowScreen title="Trợ lý AI"><WorkflowText>Hỏi về gói tập, lịch học và hoạt động của trung tâm.</WorkflowText>
    {history.map((item, index) => <WorkflowCard key={index} title={item.role === 'user' ? 'Bạn' : 'Trợ lý Pulse'}><WorkflowText>{item.content}</WorkflowText></WorkflowCard>)}
    <WorkflowField label="Tin nhắn" value={message} onChangeText={setMessage} multiline editable={!busy} />
    <WorkflowButton title="Gửi" busy={busy} disabled={!message.trim()} onPress={() => { void send(); }} />
    <WorkflowState error={error} />
    {history.length > 0 && <WorkflowButton title="Cuộc trò chuyện mới" secondary disabled={busy} onPress={() => { setHistory([]); setError(undefined); }} />}
  </WorkflowScreen>;
}
export default function AssistantScreen() {
  const { user, currentFacility } = useAuth();
  return <Conversation key={`${user?.id}:${currentFacility?.id}`} />;
}
