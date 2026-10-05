import { useEffect, useState } from "react";
<<<<<<< HEAD
<<<<<<< HEAD
import { Paperclip } from "lucide-react";
=======
import { Paperclip, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
import { attachmentLocation, fetchAttachment } from "./api";
import { Modal } from "./ui";

export function ProtectedAttachment({ url }: { url: string }) {
<<<<<<< HEAD
=======
import { Paperclip, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { attachmentLocation, fetchAttachment } from "./api";
import { Modal } from "./ui";

export function ProtectedAttachment({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [attempt, setAttempt] = useState(0);
>>>>>>> develop
=======
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [attempt, setAttempt] = useState(0);
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
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
<<<<<<< HEAD
<<<<<<< HEAD
  }, [url]);
=======
  }, [url, attempt]);
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
  const current = result?.url === url ? result : undefined;
  if (current?.failed)
    return (
      <span className="chat-document attachment-error" role="alert">
        Tệp đính kèm không còn khả dụng hoặc bạn không có quyền tải.
<<<<<<< HEAD
=======
  }, [url, attempt]);
  const current = result?.url === url ? result : undefined;
  if (current?.failed)
    return (
      <span className="chat-document attachment-error" role="alert">
        Tệp đính kèm không còn khả dụng hoặc bạn không có quyền tải.
=======
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
        <button
          type="button"
          className="button small"
          onClick={() => {
            setResult(undefined);
            setAttempt((value) => value + 1);
          }}
        >
          Tải lại tệp
        </button>
<<<<<<< HEAD
>>>>>>> develop
=======
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
      </span>
    );
  if (!current?.blobUrl)
    return <span role="status">Đang tải tệp đính kèm…</span>;
  const name =
    attachmentLocation(url)?.searchParams.get("name") || "tep-dinh-kem";
  return current.image ? (
<<<<<<< HEAD
<<<<<<< HEAD
    <img
      className="chat-image"
      src={current.blobUrl}
      alt={`Ảnh đính kèm: ${name}`}
      loading="lazy"
      onError={() => setResult({ url, failed: true })}
    />
=======
=======
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
    <>
      <button
        type="button"
        className="chat-image-button"
        aria-label={`Phóng to ảnh: ${name}`}
        aria-haspopup="dialog"
        onClick={() => {
          setZoom(100);
          setOpen(true);
        }}
      >
        <img
          className="chat-image"
          src={current.blobUrl}
          alt={`Ảnh đính kèm: ${name}`}
          loading="lazy"
          onError={() => setResult({ url, failed: true })}
        />
        <span>
          <ZoomIn size={14} aria-hidden="true" /> Xem ảnh lớn
        </span>
      </button>
      {open && (
        <Modal
          title="Xem ảnh đính kèm"
          eyebrow="PULSE / TIN NHẮN"
          maxWidth={1100}
          onClose={() => setOpen(false)}
        >
          <div className="image-viewer">
            <div
              className="image-viewer-toolbar"
              role="group"
              aria-label="Điều khiển xem ảnh"
            >
              <button
                type="button"
                className="icon-button"
                aria-label="Thu nhỏ ảnh"
                disabled={zoom <= 100}
                onClick={() => setZoom((value) => value - 50)}
              >
                <ZoomOut aria-hidden="true" />
              </button>
              <output aria-live="polite" aria-label="Mức phóng to">
                {zoom}%
              </output>
              <button
                type="button"
                className="icon-button"
                aria-label="Phóng to thêm"
                disabled={zoom >= 300}
                onClick={() => setZoom((value) => value + 50)}
              >
                <ZoomIn aria-hidden="true" />
              </button>
              <button
                type="button"
                className="button small"
                disabled={zoom === 100}
                onClick={() => setZoom(100)}
              >
                <RotateCcw size={16} aria-hidden="true" /> Vừa khung
              </button>
              <a
                className="button small"
                href={current.blobUrl}
                download={name}
              >
                <Download size={16} aria-hidden="true" /> Tải ảnh
              </a>
            </div>
            <div
              className={`image-viewer-stage ${zoom > 100 ? "is-zoomed" : ""}`}
              tabIndex={0}
              role="region"
              aria-label="Ảnh phóng to, cuộn để xem chi tiết"
            >
              <img
                src={current.blobUrl}
                alt={`Ảnh đính kèm: ${name}`}
                style={
                  zoom > 100
                    ? { width: `${zoom}%`, maxWidth: "none", maxHeight: "none" }
                    : undefined
                }
              />
            </div>
            <p className="image-viewer-caption">
              {name} · Nhấn Esc hoặc nút đóng để trở về cuộc trò chuyện.
            </p>
          </div>
        </Modal>
      )}
    </>
<<<<<<< HEAD
>>>>>>> develop
=======
>>>>>>> 1fd8181a2578ea17c9c909effe2fa0871829bd5f
  ) : (
    <a className="chat-document" href={current.blobUrl} download={name}>
      <Paperclip size={18} /> {name}
    </a>
  );
}
