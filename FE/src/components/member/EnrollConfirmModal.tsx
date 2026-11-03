import { useState, useEffect } from "react";
import { Modal } from "../../shared/ui";
import { HeartPulse, Target } from "lucide-react";

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
  initialGoal = "",
  loading = false,
  confirmText = "Xác nhận đăng ký",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { healthNotes: string; saveToProfile: boolean; goal?: string }) => void;
  title?: string;
  classSummary: ClassSummaryInfo;
  initialHealthNotes?: string | null;
  initialGoal?: string | null;
  loading?: boolean;
  confirmText?: string;
}) {
  const [healthNotes, setHealthNotes] = useState(initialHealthNotes || "");
  const [goal, setGoal] = useState(initialGoal || "");
  const [saveToProfile, setSaveToProfile] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHealthNotes(initialHealthNotes || "");
      setGoal(initialGoal || "");
      setSaveToProfile(false);
    }
  }, [isOpen, initialHealthNotes, initialGoal]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    onConfirm({
      healthNotes: healthNotes.trim(),
      saveToProfile,
      goal: goal.trim() || undefined,
    });
  };

  return (
    <Modal onClose={onClose} title={title} maxWidth={560} dismissible={!loading}>
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

        {/* Goal section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            htmlFor="enroll-course-goal"
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--member-text, #1e293b)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Target size={16} color="#0284c7" />
            Mục tiêu của bạn trong khóa học này (Tùy chọn)
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="enroll-course-goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value.slice(0, 500))}
              placeholder="Ví dụ: Bơi ếch liên tục 50m, giữ thăng bằng 30s, nâng tạ 50kg..."
              maxLength={500}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--member-border, #cbd5e1)",
                fontSize: 13,
                lineHeight: 1.5,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
            <div style={{ fontSize: 12, color: "var(--member-muted, #64748b)", marginTop: 4 }}>
              Không bắt buộc. Nếu để trống, hệ thống sẽ tự động đặt mục tiêu "Hoàn thành khóa học".
            </div>
          </div>
          {/* Progress initial preview */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(2, 132, 199, 0.08)",
              border: "1px solid rgba(2, 132, 199, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 500, color: "#0369a1" }}>
              🎯 Tiến độ mục tiêu ban đầu:
            </span>
            <span
              style={{
                fontWeight: 700,
                color: "#ef4444",
                background: "#fee2e2",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              0% (Bắt đầu)
            </span>
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
