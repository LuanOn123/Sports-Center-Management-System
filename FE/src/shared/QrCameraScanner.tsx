import { useEffect, useRef } from "react";

export const CAMERA_ERROR_MESSAGE =
  "Không mở được camera. Hãy cấp quyền camera, dùng HTTPS hoặc nhập mã bên dưới.";

/**
 * Camera quét QR (@zxing/browser, nạp lười). Đọc được một mã thì dừng camera và gọi `onResult` đúng một lần;
 * caller tự ẩn component (unmount) để giải phóng camera. Dùng chung cho điểm danh lớp và check-in cơ sở.
 */
export function QrCameraScanner({
  onResult,
  onError,
  label = "Camera quét QR",
}: {
  onResult: (text: string) => void;
  onError: (message: string) => void;
  label?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  // Giữ callback mới nhất mà không phải khởi động lại camera mỗi lần render
  const handlers = useRef({ onResult, onError });
  handlers.current = { onResult, onError };

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let disposed = false;
    let done = false;
    let controls: { stop(): void } | undefined;
    import("@zxing/browser")
      .then(async ({ BrowserQRCodeReader }) => {
        if (disposed) return;
        controls = await new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: "environment" }, audio: false },
          element,
          (result, _error, control) => {
            if (result && !disposed && !done) {
              done = true;
              control.stop();
              handlers.current.onResult(result.getText());
            }
          },
        );
        if (disposed) controls.stop();
      })
      .catch(() => {
        if (!disposed) handlers.current.onError(CAMERA_ERROR_MESSAGE);
      });
    return () => {
      disposed = true;
      controls?.stop();
      const stream = element.srcObject;
      if (stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
    };
  }, []);

  return <video ref={video} muted playsInline aria-label={label} />;
}
