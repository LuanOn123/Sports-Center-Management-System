import { useState, useEffect } from "react";
import { Modal } from "../../shared/ui";
import { HeartPulse } from "lucide-react";

export interface ClassSummaryInfo {
  name: string;
  sport?: string;
  time?: string;
  coach?: string;
  room?: string;
  sessions?: number;
}

export function EnrollConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận đăng ký & Lưu ý thể trạng",
  classSummary,
  initialHealthNotes = "",
  loading = false,
  confirmText = "Xác nhận đăng ký",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { healthNotes: string; saveToProfile: boolean }) => void;
  title?: string;
  classSummary: ClassSummaryInfo;
  initialHealthNotes?: string | null;
  loading?: boolean;
  confirmText?: string;
}) {
  const [healthNotes, setHealthNotes] = useState(initialHealthNotes || "");
  const [saveToProfile, setSaveToProfile] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHealthNotes(initialHealthNotes || "");
      setSaveToProfile(false);
    }
  }, [isOpen, initialHealthNotes]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      healthNotes: healthNotes.trim(),
      saveToProfile,
    });
  };

  return (
    <Modal onClose={onClose} title={title} maxWidth={560}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Class summary box */}
        <div
          style={{
            backgroundColor: "var(--member-surface-alt, #f8fafc)",
            border: "1px solid var(--member-border, #e2e8f0)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <strong style={{ fontSize: 16, color: "var(--member-text, #1e293b)" }}>
              {classSummary.name}
            </strong>
            {classSummary.sport && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: "#e0f2fe",
                  color: "#0369a1",
                  padding: "2px 8px",
                  borderRadius: 6,
                }}
              >
                {classSummary.sport}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--member-muted, #64748b)", display: "flex", flexWrap: "wrap", gap: 12 }}>
            {classSummary.sessions && <span>• {classSummary.sessions} buổi</span>}
            {classSummary.time && <span>• {classSummary.time}</span>}
            {classSummary.coach && <span>• HLV: {classSummary.coach}</span>}
            {classSummary.room && <span>• Phòng: {classSummary.room}</span>}
          </div>
        </div>

        {/* Health notes section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            htmlFor="enroll-health-notes"
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--member-text, #1e293b)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <HeartPulse size={16} color="#e11d48" />
            Bạn có chấn thương hoặc vấn đề sức khỏe cần HLV lưu ý không?
          </label>
          <div style={{ position: "relative" }}>
            <textarea
              id="enroll-health-notes"
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value.slice(0, 1000))}
              placeholder="Ví dụ: Đau cổ chân trái, gãy tay vừa lành xương, huyết áp cao, hen suyễn, không gập người được sâu..."
              rows={4}
              maxLength={1000}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--member-border, #cbd5e1)",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
            <div
              style={{
                textAlign: "right",
                fontSize: 12,
                color: healthNotes.length >= 950 ? "#e11d48" : "var(--member-muted, #94a3b8)",
                marginTop: 4,
              }}
            >
              {healthNotes.length}/1000 ký tự
            </div>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--member-text, #334155)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
            />
            <span>Lưu thông tin này vào hồ sơ sức khỏe cá nhân của tôi</span>
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button
            type="button"
            className="button"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {loading ? "Đang xử lý…" : confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
