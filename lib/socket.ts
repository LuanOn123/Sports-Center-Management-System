import { io, Socket } from 'socket.io-client';
import { BASE_URL, getAccessToken } from './api';
import { emitSessionExpired } from './sessionEvents';

// ─── Socket singleton ─────────────────────────────────────────────────────────

let _socket: Socket | null = null;

/**
 * Connect to the Socket.IO server and join the user's room.
 * Call after login. Safe to call multiple times (idempotent).
 */
export function connectSocket(userId: string): Socket | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  // Strip /api/v1 suffix to get the base WS server URL
  const wsUrl = BASE_URL.replace(/\/api\/v1\/?$/, '');

  if (_socket) {
    _socket.auth = { token };
    if (!_socket.connected) {
      _socket.connect();
    }
    return _socket;
  }

  _socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    auth: { token },
  });

  _socket.on('connect', () => {
    console.log('[socket] connected:', _socket?.id);
    // Join personal room so the server can route messages to this user
    _socket?.emit('join', userId);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[socket] connection error:', err.message);
  });

  _socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
    // Server chủ động ngắt (đổi mật khẩu / khóa tài khoản / đổi role ở nơi khác)
    if (reason === 'io server disconnect') {
      emitSessionExpired();
    }
  });

  return _socket;
}

/**
 * Disconnect and clean up the socket. Call on logout.
 */
export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/**
 * Get the current socket instance (may be null if not connected).
 */
export function getSocket(): Socket | null {
  return _socket;
}
