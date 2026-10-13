import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { captchaHtml, turnstileOrigin, turnstileSiteKey } from '../../lib/captcha';
import { Colors } from '../../constants/theme';

export function LoginCaptcha({ onChange }: { onChange: (token: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const onToken = useRef(onChange);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  onToken.current = onChange;
  useEffect(() => {
    onToken.current('');
    watchdog.current = setTimeout(() => { onToken.current(''); setError('Xác minh quá thời gian. Kiểm tra mạng và thử lại.'); }, 45_000);
    return () => { if (watchdog.current) clearTimeout(watchdog.current); };
  }, [attempt]);
  if (!turnstileSiteKey) return <Text className="text-status-failed text-sm mb-md">Xác minh bảo mật chưa được cấu hình. Vui lòng liên hệ trung tâm.</Text>;
  return <View className="mb-md">
    <WebView key={attempt} source={{ html: captchaHtml(turnstileSiteKey), baseUrl: turnstileOrigin }}
      style={{ height: 190, backgroundColor: Colors.bg.surface }} scrollEnabled={false}
      javaScriptEnabled domStorageEnabled originWhitelist={['https://*', 'http://*', 'about:*']}
      onError={() => { onToken.current(''); setError('Không tải được xác minh bảo mật.'); }}
      onMessage={(event) => {
        try {
          const value = JSON.parse(event.nativeEvent.data);
          if (typeof value.token !== 'string' || value.token.length > 2048) return;
          if (watchdog.current) clearTimeout(watchdog.current);
          onToken.current(value.token);
          setError(typeof value.error === 'string' ? value.error : '');
        } catch { onToken.current(''); }
      }} />
    {Boolean(error) && <><Text className="text-status-failed text-sm font-bevn-regular">{error}</Text>
      <TouchableOpacity accessibilityRole="button" className="py-md" onPress={() => { setError(''); setAttempt((n) => n + 1); }}>
        <Text className="text-primary font-bevn-semibold">Thử lại xác minh</Text>
      </TouchableOpacity></>}
  </View>;
}
