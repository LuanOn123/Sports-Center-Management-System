import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, BASE_URL } from "./api";
import type { ProfileOk } from "./generated";
import { Modal } from "./ui";
import "./avatar.css";

type AvatarUser = { fullName: string; avatarUrl?: string | null };

function imageUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(
      value,
      new URL(BASE_URL, window.location.origin).origin,
    );
    return ["https:", "http:", "blob:"].includes(url.protocol)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function Avatar({
  user,
  interactive = true,
}: {
  user: AvatarUser;
  interactive?: boolean;
}) {
  const src = imageUrl(user.avatarUrl);
  const [failed, setFailed] = useState<string>();
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const available = Boolean(src && failed !== src);
  const portrait = (
    <span className="avatar profile-avatar">
      {src && failed !== src ? (
        <img
          src={src}
          alt={`Ảnh đại diện của ${user.fullName}`}
          onError={() => setFailed(src)}
        />
      ) : (
        user.fullName.trim().slice(0, 1).toLocaleUpperCase() || "?"
      )}
    </span>
  );
  return (
    <>
      {available && interactive ? (
        <button
          type="button"
          className="avatar-view-trigger"
          aria-label={`Xem ảnh đại diện của ${user.fullName}`}
          onClick={() => {
            setZoom(1);
            setOpen(true);
          }}
        >
          {portrait}
        </button>
      ) : (
        portrait
      )}
      {open && src && (
        <Modal
          title={`Ảnh đại diện · ${user.fullName}`}
          eyebrow="PULSE / ẢNH ĐẠI DIỆN"
          maxWidth={800}
          onClose={() => setOpen(false)}
        >
          <div className="avatar-viewer">
            <div className="avatar-viewer-tools">
              <label>
                Thu nhỏ / Phóng to
                <input
                  type="range"
                  aria-label="Mức phóng ảnh đại diện"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                className="button ghost"
                onClick={() => setZoom(1)}
              >
                Vừa khung
              </button>
            </div>
            <div
              className="avatar-viewer-viewport"
              tabIndex={0}
              role="region"
              aria-label="Ảnh đại diện lớn, có thể cuộn khi phóng to"
            >
              <img
                src={src}
                alt={`Ảnh đại diện đầy đủ của ${user.fullName}`}
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
            <p>
              Ảnh hiển thị theo bản đã lưu. Dùng thanh trượt để thu nhỏ hoặc
              phóng to.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

export function AvatarUploader({ user }: { user: AvatarUser }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const cropImage = useRef<HTMLImageElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 240, height: 240 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scale =
    Math.max(240 / dimensions.width, 240 / dimensions.height) * zoom;
  function bounded(x: number, y: number, nextZoom = zoom) {
    const nextScale =
      Math.max(240 / dimensions.width, 240 / dimensions.height) * nextZoom;
    const maxX = Math.max(0, (dimensions.width * nextScale - 240) / 2);
    const maxY = Math.max(0, (dimensions.height * nextScale - 240) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }
  function selectFile(selected?: File) {
    if (!selected || busy) return;
    setSuccess("");
    setError("");
    setReady(false);
    setFile(undefined);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        selected.type,
      )
    ) {
      setError("Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.");
      return;
    }
    if (!selected.size || selected.size > 5 * 1024 * 1024) {
      setError("Ảnh phải có dung lượng lớn hơn 0 và không quá 5 MB.");
      return;
    }
    setFile(selected);
  }
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    if (!file || !ready || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const body = new FormData();
    try {
      const image = cropImage.current;
      if (!image) throw new Error("Ảnh chưa sẵn sàng. Vui lòng chọn lại ảnh.");
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Trình duyệt không hỗ trợ chỉnh ảnh.");
      const sourceSize = 240 / scale;
      context.drawImage(
        image,
        (dimensions.width - sourceSize) / 2 - offset.x / scale,
        (dimensions.height - sourceSize) / 2 - offset.y / scale,
        sourceSize,
        sourceSize,
        0,
        0,
        512,
        512,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Không thể xử lý ảnh. Vui lòng thử lại.")),
          "image/png",
        ),
      );
      body.append("avatar", blob, "avatar.png");
      const result = await api<ProfileOk["data"]>("POST /auth/me/avatar", {
        body,
      });
      client.setQueryData(["me"], result);
      setFile(undefined);
      setSuccess("Đã cập nhật ảnh đại diện.");
      void client.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải ảnh lên. Vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="avatar-editor"
      aria-label="Cập nhật ảnh đại diện"
      aria-busy={busy}
    >
      <div
        className="avatar-editor-portrait"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          <div className="avatar-crop-controls">
            <div
              className="avatar-crop"
              tabIndex={busy ? -1 : 0}
              role="group"
              aria-label="Điều chỉnh vị trí ảnh"
              aria-describedby={hintId}
              onPointerDown={(event) => {
                if (busy || !ready) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  x: event.clientX,
                  y: event.clientY,
                  left: offset.x,
                  top: offset.y,
                };
              }}
              onPointerMove={(event) => {
                if (!drag.current || busy) return;
                const ratio =
                  240 / event.currentTarget.getBoundingClientRect().width;
                setOffset(
                  bounded(
                    drag.current.left +
                      (event.clientX - drag.current.x) * ratio,
                    drag.current.top + (event.clientY - drag.current.y) * ratio,
                  ),
                );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
              onKeyDown={(event) => {
                if (busy || !ready) return;
                const steps: Record<string, [number, number]> = {
                  ArrowLeft: [-8, 0],
                  ArrowRight: [8, 0],
                  ArrowUp: [0, -8],
                  ArrowDown: [0, 8],
                };
                const step = steps[event.key];
                if (step) {
                  event.preventDefault();
                  setOffset(bounded(offset.x + step[0], offset.y + step[1]));
                }
              }}
            >
              <img
                ref={cropImage}
                src={preview}
                alt="Xem trước ảnh đại diện mới"
                draggable={false}
                style={{
                  width: `${((dimensions.width * scale) / 240) * 100}%`,
                  height: `${((dimensions.height * scale) / 240) * 100}%`,
                  transform: `translate(${-50 + (offset.x / (dimensions.width * scale)) * 100}%, ${-50 + (offset.y / (dimensions.height * scale)) * 100}%)`,
                }}
                onLoad={(event) => {
                  setDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                  setReady(true);
                }}
                onError={() => {
                  setReady(false);
                  setError("Không đọc được ảnh. Vui lòng chọn ảnh khác.");
                }}
              />
            </div>
            <label className="avatar-zoom">
              Phóng to
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                disabled={busy || !ready}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setZoom(value);
                  setOffset(bounded(offset.x, offset.y, value));
                }}
              />
            </label>
            <button
              type="button"
              className="button ghost"
              disabled={busy || !ready}
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Đặt lại vị trí
            </button>
          </div>
        ) : (
          <Avatar user={user} />
        )}
      </div>
      <div className="avatar-editor-content">
        <h2>Ảnh đại diện</h2>
        <p id={hintId}>
          JPG, PNG, WebP hoặc GIF, tối đa 5 MB. Kéo thả ảnh vào khung hoặc chọn
          ảnh. Kéo ảnh (hoặc dùng phím mũi tên) để chỉnh vị trí. Ảnh sẽ được lưu
          dạng ảnh tĩnh.
        </p>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif"
          aria-label="Chọn ảnh đại diện"
          aria-describedby={hintId}
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            event.target.value = "";
            if (!selected) return;
            selectFile(selected);
          }}
        />
        {file && <p className="avatar-editor-filename">{file.name}</p>}
        <div className="avatar-editor-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {file ? "Chọn ảnh khác" : "Chọn ảnh"}
          </button>
          {file && (
            <>
              <button
                type="button"
                className="button primary"
                disabled={busy || !ready}
                onClick={() => void upload()}
              >
                {busy ? "Đang tải lên…" : "Lưu ảnh"}
              </button>
              <button
                type="button"
                className="button ghost"
                disabled={busy}
                onClick={() => {
                  setFile(undefined);
                  setError("");
                }}
              >
                Hủy
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="avatar-editor-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="avatar-editor-success" role="status">
            {success}
          </p>
        )}
      </div>
    </section>
  );
}
