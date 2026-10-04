import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function ConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online ? null : (
    <div className="connection-status" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <span>
        Bạn đang ngoại tuyến. Kiểm tra kết nối trước khi gửi thay đổi.
      </span>
    </div>
  );
}
