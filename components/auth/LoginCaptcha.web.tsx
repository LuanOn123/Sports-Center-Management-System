import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TURNSTILE_HEIGHT, TURNSTILE_MIN_WIDTH, captchaScale, turnstileSiteKey } from '../../lib/captcha';

type Turnstile = { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
let pendingScript: Promise<Turnstile> | undefined;
function loadScript(): Promise<Turnstile> {
  const getApi = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  if (getApi()) return Promise.resolve(getApi()!);
  if (pendingScript) return pendingScript;
  pendingScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const fail = () => { clearTimeout(timer); script.onload = null; script.onerror = null; script.remove(); pendingScript = undefined; reject(new Error('Không tải được xác minh bảo mật. Kiểm tra mạng và thử lại.')); };
    const timer = setTimeout(fail, 15_000);
    script.onerror = fail;
    script.onload = () => { clearTimeout(timer); getApi() ? resolve(getApi()!) : fail(); };
    document.head.appendChild(script);
  });
  return pendingScript;
}

export function LoginCaptcha({ onChange }: { onChange: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const onToken = useRef(onChange);
  onToken.current = onChange;
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Đang tải xác minh bảo mật…');
  useEffect(() => {
    let active = true, widget: string | undefined, sdk: Turnstile | undefined;
    onToken.current('');
    const fail = (message: string) => { if (active) { onToken.current(''); setStatus(''); setError(message); } };
    if (!turnstileSiteKey) { fail('Xác minh bảo mật chưa được cấu hình. Vui lòng liên hệ trung tâm.'); return; }
    void loadScript().then((api) => {
      if (!active || !container.current) return;
      sdk = api;
      // Form hẹp hơn 300px → thu nhỏ widget dạng thanh ngang cho vừa
      const scale = captchaScale(container.current.parentElement?.clientWidth ?? 0);
      if (scale < 1) Object.assign(container.current.style, { width: `${TURNSTILE_MIN_WIDTH}px`, transform: `scale(${scale})`, transformOrigin: 'left top', marginBottom: `${-TURNSTILE_HEIGHT * (1 - scale)}px` });
      setStatus('Vui lòng hoàn tất xác minh bảo mật.');
      widget = api.render(container.current, {
        sitekey: turnstileSiteKey, action: 'login', theme: 'dark', size: 'flexible', 'response-field': false,
        callback: (token: string) => { if (active) { onToken.current(token); setError(''); setStatus('Đã xác minh bảo mật.'); } },
        'expired-callback': () => fail('Xác minh đã hết hạn. Vui lòng thử lại.'),
        'timeout-callback': () => fail('Xác minh quá thời gian. Vui lòng thử lại.'),
        'error-callback': (code: string) => fail(`Không thể xác minh bảo mật (mã ${code}). Vui lòng thử lại.`),
        'unsupported-callback': () => fail('Vui lòng cập nhật trình duyệt để xác minh.'),
      });
    }).catch((e: Error) => fail(e.message));
    return () => { active = false; if (widget !== undefined) sdk?.remove(widget); };
  }, [attempt]);
  return <View className="mb-md">
    <div ref={container} role="group" aria-label="Xác minh bảo mật Cloudflare" style={{ width: '100%' }} />
    <Text accessibilityLiveRegion="polite" className="text-text-secondary text-xs font-bevn-regular mt-sm">{status || error}</Text>
    {Boolean(error) && turnstileSiteKey && <TouchableOpacity accessibilityRole="button" className="py-md" onPress={() => { setError(''); setStatus('Đang tải xác minh bảo mật…'); setAttempt((n) => n + 1); }}><Text className="text-primary font-bevn-semibold">Thử lại xác minh</Text></TouchableOpacity>}
  </View>;
}
