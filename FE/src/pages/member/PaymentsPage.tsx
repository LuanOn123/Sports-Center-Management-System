import { Table } from "../../shared/Table";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import { refundChatPath } from "../../shared/Communication";
import { api, type RecordData } from "../../shared/api";
import { allPages } from "../../shared/pagedApi";
import { at, money } from "../../shared/config";
import { Details, Empty, ErrorState, Loading, Modal } from "../../shared/ui";
import { InvoiceDialog } from "../../features/reception/payments/PaymentsPage";
import "./member-payments.css";

type RefundPayment = { id: string; amount: unknown };

export function MemberPaymentsPage() {
  const { user } = useAuth();
  const memberId = String(at(user, "memberProfile.id") || "");
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [refundPayment, setRefundPayment] = useState<RefundPayment | null>(null);

  const list = useQuery({
    queryKey: ["member-invoices", memberId],
    enabled: Boolean(memberId),
    queryFn: ({ signal }) =>
      allPages<RecordData>("GET /invoices/member/{memberId}", {
        params: { memberId },
        signal,
      }),
  });
  const payment = useQuery({
    queryKey: ["member-payment", paymentId],
    enabled: Boolean(paymentId),
    queryFn: ({ signal }) =>
      api("GET /payments/{id}", { params: { id: paymentId }, signal }),
  });

  return (
    <div className="workflow-page">
      <h1>Thanh toán & hóa đơn</h1>
      <p>
        Các khoản thu được ghi nhận tại quầy hoặc thanh toán online. Bạn có thể
        gửi yêu cầu hoàn tiền nếu đủ điều kiện theo chính sách của trung tâm.
      </p>
      {!memberId ? (
        <Empty text="Chưa có hồ sơ hội viên." />
      ) : list.isPending ? (
        <Loading variant="cards" />
      ) : list.error ? (
        <ErrorState error={list.error} retry={() => list.refetch()} />
      ) : !list.data.data.length ? (
        <Empty text="Chưa có hóa đơn." />
      ) : (
        <Table
          rows={list.data.data}
          columns={[
            ["invoiceNumber", "Hóa đơn"],
            ["issuedAt", "Ngày phát hành"],
            ["status", "Trạng thái"],
            ["total", "Số tiền"],
          ]}
          actions={(r) => (
            <div className="member-invoice-actions">
              <button
                className="button small"
                onClick={() => setInvoiceId(String(r.id))}
              >
                Xem / In hóa đơn
              </button>
              {Boolean(r.paymentId) && (
                <button
                  className="button small"
                  onClick={() => setPaymentId(String(r.paymentId))}
                >
                  Chi tiết thanh toán
                </button>
              )}
              {typeof r.paymentId === "string" &&
                r.paymentId &&
                at(r, "payment.status") === "SUCCESS" &&
                !at(r, "payment.refundRequestedAt") && (
                  <button
                    className="button small danger"
                    onClick={() =>
                      setRefundPayment({
                        id: String(r.paymentId),
                        amount: at(r, "payment.amount"),
                      })
                    }
                  >
                    Yêu cầu hoàn tiền
                  </button>
                )}
            </div>
          )}
        />
      )}
      {invoiceId && (
        <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId("")} />
      )}
      {paymentId && (
        <Modal title="Chi tiết thanh toán" onClose={() => setPaymentId("")}>
          {payment.isPending ? (
            <Loading variant="details" />
          ) : payment.error ? (
            <ErrorState error={payment.error} retry={() => payment.refetch()} />
          ) : (
            <>
              <Details value={payment.data.data} />
              {payment.data.data.refundRequestedAt && (
                <div
                  role="status"
                  style={{
                    marginTop: "16px",
                    padding: "10px",
                    background: "rgba(234, 179, 8, 0.1)",
                    borderRadius: "6px",
                    color: "#ca8a04",
                  }}
                >
                  Đã gửi yêu cầu hoàn tiền ({money(payment.data.data.refundRequestedAmount)}).
                  Lễ tân đang tiếp nhận xử lý.
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {refundPayment && (
        <MemberRefundDialog
          payment={refundPayment}
          onClose={() => setRefundPayment(null)}
        />
      )}
    </div>
  );
}

function MemberRefundDialog({
  payment,
  onClose,
}: {
  payment: RefundPayment;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [receptionist, setReceptionist] = useState<{ id: string; fullName: string } | null>(null);
  const cache = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api<{ refundReceptionist?: { id: string; fullName: string } | null }>("POST /payments/{id}/refund/request", {
        params: { id: payment.id },
        body: { reason: reason.trim() },
      }),
    onSuccess: (res) => {
      setSuccessMsg(res.message || "Đã gửi yêu cầu hoàn tiền thành công!");
      setReceptionist(res.data.refundReceptionist ?? null);
      void cache.invalidateQueries({ queryKey: ["member-invoices"] });
      void cache.invalidateQueries({ queryKey: ["member-payment"] });
    },
  });

  return (
    <Modal
      title="Yêu cầu hoàn tiền"
      onClose={onClose}
      dismissible={!mutation.isPending}
    >
      {successMsg ? (
        <div style={{ textAlign: "center", padding: "16px" }}>
          <p style={{ color: "#16a34a", fontWeight: 600, fontSize: "16px" }}>
            ✓ {successMsg}
          </p>
          {receptionist ? (
            <>
              <p>Lễ tân phụ trách hoàn tiền: <strong>{receptionist.fullName}</strong></p>
              <Link className="button" to={refundChatPath(receptionist, payment.id)}>Nhắn tin với lễ tân</Link>
            </>
          ) : (
            <p>Không có lễ tân phụ trách hoàn tiền. Vui lòng liên hệ với quản trị viên của cơ sở.</p>
          )}
          <div className="modal-footer" style={{ justifyContent: "center" }}>
            <button className="button primary" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <form
          className="manager-config-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mutation.isPending && reason.trim().length >= 3) {
              mutation.mutate();
            }
          }}
        >
          <p>
            Bạn đang yêu cầu hoàn tiền cho giao dịch mã #{payment.id.slice(0, 8)} - Số
            tiền thanh toán: {money(payment.amount)}.
          </p>
          <p style={{ fontSize: "13px", color: "var(--text-muted, #64748b)" }}>
            Lưu ý: Nếu giao dịch gắn với gói tập đang hoạt động, quyền lợi tập luyện
            sẽ được thu hồi và số tiền hoàn sẽ tính theo quy định (trên 15 ngày sử
            dụng).
          </p>
          <fieldset disabled={mutation.isPending}>
            <label>
              <span className="form-field-label">
                Lý do yêu cầu hoàn tiền{"\u00a0"}<span className="required">*</span>
              </span>
              <textarea
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                placeholder="Nhập lý do bạn muốn hoàn tiền..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {mutation.error && <ErrorState error={mutation.error} />}
            <div className="modal-footer">
              <button type="button" className="button" onClick={onClose}>
                Hủy
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={mutation.isPending || reason.trim().length < 3}
              >
                {mutation.isPending ? "Đang gửi…" : "Gửi yêu cầu hoàn tiền"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
