// hooks/shared/usePresence.ts
// Ai đang trực tuyến (web: chấm xanh trên ảnh đại diện): danh sách ban đầu lấy bằng presence:list mỗi lần socket kết nối, sau đó
// theo sự kiện presenceChanged của BE; mất kết nối thì coi như chưa biết ai đang trực tuyến.

import { useEffect, useState } from 'react';
import { getSocket } from '../../lib/socket';
import { applyPresence } from '../../lib/chat';

interface PresenceChanged {
  userId: string;
  online: boolean;
}

export function usePresence(): ReadonlySet<string> {
  const [online, setOnline] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => {
      socket.emit('presence:list', (ids: string[]) => setOnline(new Set(ids)));
    };
    const changed = ({ userId, online: isOnline }: PresenceChanged) => setOnline((current) => applyPresence(current, userId, isOnline));
    const cleared = () => setOnline(new Set());

    socket.on('connect', refresh);
    socket.on('presenceChanged', changed);
    socket.on('disconnect', cleared);
    if (socket.connected) refresh();
    return () => {
      socket.off('connect', refresh);
      socket.off('presenceChanged', changed);
      socket.off('disconnect', cleared);
    };
  }, []);

  return online;
}
