// Public key shared with the web widget; never include the server secret.
export const turnstileSiteKey = process.env.EXPO_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim() || '';
export const turnstileOrigin = process.env.EXPO_PUBLIC_TURNSTILE_ORIGIN?.trim() || 'https://localhost';

export function captchaHtml(siteKey: string) {
  const key = JSON.stringify(siteKey).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;background:#131a26;color:#9baac0;font:13px sans-serif}#captcha{display:flex;justify-content:center;padding:8px}p{text-align:center}</style></head><body><div id="captcha"></div><p id="status">Đang tải xác minh bảo mật…</p><script>
  function send(token,error){window.ReactNativeWebView.postMessage(JSON.stringify({token:token||'',error:error||''}));}
  function invalid(message){document.getElementById('status').textContent=message;send('',message);}
  function renderCaptcha(){try{turnstile.render('#captcha',{sitekey:${key},action:'login',theme:'dark',size:'compact','response-field':false,
  callback:function(token){document.getElementById('status').textContent='Đã xác minh bảo mật.';send(token);},
  'expired-callback':function(){invalid('Xác minh đã hết hạn. Vui lòng thử lại.');},
  'timeout-callback':function(){invalid('Xác minh quá thời gian. Vui lòng thử lại.');},
  'error-callback':function(code){invalid('Không thể xác minh bảo mật (mã '+code+'). Vui lòng thử lại.');},
  'unsupported-callback':function(){invalid('Vui lòng cập nhật trình duyệt hệ thống để xác minh.');}
  });}catch(e){invalid('Không tải được xác minh bảo mật.');}}
  </script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=renderCaptcha&render=explicit" async defer onerror="invalid('Không tải được xác minh bảo mật. Kiểm tra kết nối.')"></script></body></html>`;
}
