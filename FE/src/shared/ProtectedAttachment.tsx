import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { attachmentLocation, fetchAttachment } from "./api";

export function ProtectedAttachment({ url }: { url: string }) {
  const [result, setResult] = useState<{
    url: string;
    blobUrl?: string;
    image?: boolean;
    failed?: boolean;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetchAttachment(url, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({
          url,
          blobUrl: objectUrl,
          image: /^image\/(jpeg|png|webp|gif)$/.test(blob.type),
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ url, failed: true });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  const current = result?.url === url ? result : undefined;
  if (current?.failed)
    return (
      <span className="chat-document" role="alert">
        Tệp đính kèm không còn khả dụng hoặc bạn không có quyền tải.
      </span>
    );
  if (!current?.blobUrl)
    return <span role="status">Đang tải tệp đính kèm…</span>;
  const name =
    attachmentLocation(url)?.searchParams.get("name") || "tep-dinh-kem";
  return current.image ? (
    <img
      className="chat-image"
      src={current.blobUrl}
      alt={`Ảnh đính kèm: ${name}`}
      loading="lazy"
      onError={() => setResult({ url, failed: true })}
    />
  ) : (
    <a className="chat-document" href={current.blobUrl} download={name}>
      <Paperclip size={18} /> {name}
    </a>
  );
}
