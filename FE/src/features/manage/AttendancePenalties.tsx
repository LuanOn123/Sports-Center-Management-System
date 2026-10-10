import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { display } from "../../shared/config";
import { Empty, ErrorState, Loading, Modal } from "../../shared/ui";

export function AttendancePenalties() {
  const cache = useQueryClient();
  const [preview, setPreview] = useState<RecordData>();
  const [selected, setSelected] = useState<RecordData>();
  const [restoreSlots, setRestoreSlots] = useState(false);
  const [candidate, setCandidate] = useState<RecordData>();
  const [reason, setReason] = useState("");
  const penalties = useQuery({
    queryKey: ["attendance-penalties"],
    queryFn: ({ signal }) =>
      allPages<RecordData>("GET /attendance/penalties", { signal }),
  });
  const previewMutation = useMutation({
    mutationFn: () => api<RecordData>("POST /attendance/penalties/preview"),
    onSuccess: (result) => setPreview(result.data),
  });
  const scanMutation = useMutation({
    mutationFn: () => api("POST /attendance/warnings/scan", { body: {} }),
  });
  const applyMutation = useMutation({
    mutationFn: (item: RecordData) =>
      api("POST /attendance/penalties/apply", {
        body: {
          memberId: item.memberId,
          classId: item.classId,
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      setCandidate(undefined);
      setReason("");
      void cache.invalidateQueries({ queryKey: ["attendance-penalties"] });
      void previewMutation.mutateAsync();
    },
  });
  const revokeMutation = useMutation({
    mutationFn: () =>
      api("POST /attendance/penalties/{id}/revoke", {
        params: { id: String(selected!.id) },
        body: { restoreSlots },
      }),
    onSuccess: () => {
      setSelected(undefined);
      setRestoreSlots(false);
      void cache.invalidateQueries({ queryKey: ["attendance-penalties"] });
    },
  });
  const previewItems = Array.isArray(preview?.items)
    ? (preview.items as RecordData[])
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CHUYÊN CẦN MINH BẠCH</div>
          <h1>Cảnh báo & quyết định chuyên cần</h1>
          <p>
            Cảnh báo chỉ để tham khảo. Quản lý xem xét và xác nhận riêng để chặn
            đặt đúng lớp trong 30 ngày; không thay đổi gói tập hoặc các lớp
            khác.
          </p>
        </div>
        <div className="workflow-actions">
          <button
            className="button"
            disabled={scanMutation.isPending}
            onClick={() => scanMutation.mutate()}
          >
            {scanMutation.isPending ? "Đang quét…" : "Quét nhắc nhở & cảnh báo"}
          </button>
          <button
            className="button primary"
            disabled={previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            {previewMutation.isPending
              ? "Đang xem trước…"
              : "Xem trước các cảnh báo"}
          </button>
        </div>
      </div>
      {(scanMutation.error || previewMutation.error) && (
        <ErrorState error={scanMutation.error || previewMutation.error} />
      )}
      {scanMutation.isSuccess && (
        <p className="success" role="status">
          Đã hoàn tất quét và gửi các cảnh báo mới.
        </p>
      )}
      {preview && (
        <section className="panel">
          <h2>Cảnh báo cần quản lý xem xét</h2>
          <p>
            Khóa cố định: vắng vượt 20% tổng buổi kế hoạch. Lớp định kỳ: tỷ lệ
            dưới 70% trong 10 buổi gần nhất, tối thiểu 5 mẫu. Khi xác nhận, hệ
            thống kiểm tra số mẫu tối thiểu và quyết định đang hiệu lực.
          </p>
          {!previewItems.length ? (
            <Empty text="Không có hội viên dưới ngưỡng áp dụng." />
          ) : (
            <div className="detail-list">
              {previewItems.map((item) => (
                <div
                  className="assignment"
                  key={`${item.memberId}-${item.classId}`}
                >
                  <span>
                    <strong>{display(item.memberName)}</strong> ·{" "}
                    {display(item.className)} · {display(item.attendanceRate)}%
                    ({display(item.sampleSize)} buổi)
                    <br />
                    <small>{display(item.reason)}</small>
                  </span>
                  <button
                    className="button danger"
                    disabled={applyMutation.isPending}
                    onClick={() => {
                      applyMutation.reset();
                      setReason(String(item.reason ?? ""));
                      setCandidate(item);
                    }}
                  >
                    Xem xét · thu hồi{" "}
                    {display(item.futureBookedEnrollmentCount)} chỗ
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Lịch sử quyết định</h2>
            <p>Trạng thái xử lý mới nhất của từng quyết định.</p>
          </div>
        </div>
        {penalties.isPending ? (
          <Loading />
        ) : penalties.isError ? (
          <ErrorState
            error={penalties.error}
            retry={() => penalties.refetch()}
          />
        ) : !penalties.data.data.length ? (
          <Empty text="Chưa có quyết định chuyên cần." />
        ) : (
          <div className="detail-list">
            {penalties.data.data.map((penalty) => (
              <div className="assignment" key={String(penalty.id)}>
                <span>
                  <strong>
                    {display(
                      (penalty.member as RecordData)?.user
                        ? ((penalty.member as RecordData).user as RecordData)
                            .fullName
                        : penalty.memberName,
                    )}
                  </strong>{" "}
                  ·{" "}
                  {display(
                    (penalty.class as RecordData)?.name || penalty.className,
                  )}
                  <br />
                  <small>{display(penalty.reason)}</small>
                </span>
                <span className="badge">{display(penalty.status)}</span>
                {penalty.status === "APPLIED" && (
                  <button
                    className="button small"
                    onClick={() => setSelected(penalty)}
                  >
                    Thu hồi quyết định
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {candidate && (
        <Modal
          title="Xác nhận quyết định chuyên cần"
          dismissible={!applyMutation.isPending}
          onClose={() => setCandidate(undefined)}
        >
          <p>
            {display(candidate.memberName)} · {display(candidate.className)}:
            chặn đặt lại lớp này trong 30 ngày và thu hồi{" "}
            {display(candidate.futureBookedEnrollmentCount)} chỗ tương lai.
          </p>
          <label>
            Lý do quyết định
            <textarea
              maxLength={500}
              disabled={applyMutation.isPending}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {applyMutation.error && <ErrorState error={applyMutation.error} />}
          <div className="modal-footer">
            <button
              className="button"
              disabled={applyMutation.isPending}
              onClick={() => setCandidate(undefined)}
            >
              Quay lại
            </button>
            <button
              className="button danger"
              disabled={
                !reason.trim() || reason.length > 500 || applyMutation.isPending
              }
              onClick={() => applyMutation.mutate(candidate)}
            >
              {applyMutation.isPending ? "Đang xử lý…" : "Xác nhận áp dụng"}
            </button>
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          title="Thu hồi quyết định chuyên cần"
          dismissible={!revokeMutation.isPending}
          onClose={() => setSelected(undefined)}
        >
          <p className="confirm-copy">
            Hội viên sẽ được phép đặt lại lớp. Khôi phục chỗ chỉ thành công với
            các buổi còn chỗ và không trùng lịch.
          </p>
          <label className="assignment">
            <input
              type="checkbox"
              checked={restoreSlots}
              onChange={(event) => setRestoreSlots(event.target.checked)}
            />{" "}
            Thử khôi phục các chỗ đã thu hồi
          </label>
          {revokeMutation.error && <ErrorState error={revokeMutation.error} />}
          <div className="modal-footer">
            <button className="button" onClick={() => setSelected(undefined)}>
              Đóng
            </button>
            <button
              className="button primary"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate()}
            >
              {revokeMutation.isPending ? "Đang xử lý…" : "Xác nhận thu hồi"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
