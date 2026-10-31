import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type RecordData } from "../../../shared/api";
import { at, display, money } from "../../../shared/config";
import { Details, ErrorState, Loading, Modal } from "../../../shared/ui";
import { useReceptionDetail, useReceptionList } from "../api";
import { StatusAction } from "../../../shared/StatusAction";
import { paymentTransitions } from "../../../shared/businessRules";
import { Heading, ListState, MemberPicker, Table } from "../components";
export function PaymentsPage({ role = "RECEPTIONIST" }: { role?: string }) {
  const [member, setMember] = useState<RecordData | null>(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [status, setStatus] = useState("");
  const [refund, setRefund] = useState<RecordData | null>(null);
  const id = String(member?.id || "");
  const payments = useReceptionList(
    "GET /payments",
    { memberId: id, status },
    {},
    Boolean(id),
  );
  const invoices = useReceptionList(
    "GET /invoices/member/{memberId}",
    {},
    { memberId: id },
    Boolean(id),
  );
  const payment = useReceptionDetail(
    "GET /payments/{id}",
    { id: paymentId },
    Boolean(paymentId),
  );
  return (
    <>
      <Heading title="Thanh toán & hóa đơn" />
      {refund && (
        <RefundConfirmation payment={refund} onClose={() => setRefund(null)} />
      )}
      <MemberPicker
        value={member}
        onChange={(m) => {
          setMember(m);
          setInvoiceId("");
          setPaymentId("");
        }}
      />
      {id && (
        <>
          <section className="panel reception-section">
            <h2>Lịch sử thanh toán</h2>
            <p>
              Khoản thu được tạo khi bán hoặc gia hạn gói. Vui lòng dùng chức
              năng gói hội viên để ghi nhận đúng đơn và số tiền.
            </p>
            <label>
              Lọc trạng thái
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Tất cả</option>
                {["PENDING", "SUCCESS", "FAILED", "REFUNDED"].map((s) => (
                  <option key={s} value={s}>
                    {display(s)}
                  </option>
                ))}
              </select>
            </label>
            <ListState result={payments}>
              {(rows) => (
                <>
                  <dl className="payment-summary">
                    <div>
                      <dt>Giao dịch đang hiển thị</dt>
                      <dd>{rows.length}</dd>
                    </div>
                    <div>
                      <dt>Đã thu trong danh sách</dt>
                      <dd>
                        {money(
                          rows
                            .filter((r) => r.status === "SUCCESS")
                            .reduce(
                              (total, r) => total + (Number(r.amount) || 0),
                              0,
                            ),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Chờ xử lý trong danh sách</dt>
                      <dd>
                        {rows.filter((r) => r.status === "PENDING").length}
                      </dd>
                    </div>
                  </dl>
                  <Table
                    rows={rows}
                    columns={[
                      ["amount", "Số tiền"],
                      ["method", "Phương thức"],
                      ["status", "Trạng thái"],
                      ["createdAt", "Ngày tạo"],
                    ]}
                    actions={(row) => (
                      <>
                        <button
                          className="button small"
                          onClick={() => setPaymentId(String(row.id))}
                        >
                          Chi tiết
                        </button>
                        {Boolean(row.gateway) && (
                          <small>
                            Giao dịch online được cập nhật sau khi hệ thống xác
                            nhận thanh toán.
                          </small>
                        )}
                        {row.activationStatus === "REQUIRES_REVIEW" && (
                          <div role="status">
                            Cần đối soát — chưa kích hoạt gói
                            {role === "ADMIN" && row.status === "SUCCESS" && (
                              <RetryActivation id={String(row.id)} />
                            )}
                            {role !== "ADMIN" && (
                              <small>Liên hệ quản trị viên để xử lý.</small>
                            )}
                          </div>
                        )}
                        {row.status === "SUCCESS" && row.refundRequestedAt && (
                          <button
                            className="button small"
                            onClick={() => setRefund(row)}
                          >
                            Xác nhận hoàn {money(row.refundRequestedAmount)}
                          </button>
                        )}
                        <StatusAction
                          operation="PATCH /payments/{id}/status"
                          id={String(row.id)}
                          statuses={paymentTransitions(
                            String(row.status),
                            role,
                            row.gateway,
                          ).filter((s) => s !== "REFUNDED")}
                          explanation="Hoàn tiền phải qua bước xác nhận biên nhận thực tế; quyền học từ gói đó sẽ được thu hồi."
                        />
                      </>
                    )}
                  />
                </>
              )}
            </ListState>
          </section>
          <section className="panel reception-section">
            <h2>Hóa đơn hội viên</h2>
            <ListState result={invoices}>
              {(rows) => (
                <Table
                  rows={rows}
                  columns={[
                    ["invoiceNumber", "Số hóa đơn"],
                    ["total", "Tổng tiền"],
                    ["status", "Trạng thái"],
                    ["issuedAt", "Ngày phát hành"],
                  ]}
                  actions={(row) => (
                    <button
                      className="button small"
                      onClick={() => setInvoiceId(String(row.id))}
                    >
                      Xem / In hóa đơn
                    </button>
                  )}
                />
              )}
            </ListState>
          </section>
        </>
      )}
      {invoiceId && (
        <InvoiceDialog id={invoiceId} onClose={() => setInvoiceId("")} />
      )}
      {paymentId && (
        <Modal title="Chi tiết thanh toán" onClose={() => setPaymentId("")}>
          {payment.isPending ? (
            <Loading variant="details" />
          ) : payment.isError ? (
            <ErrorState error={payment.error} retry={() => payment.refetch()} />
          ) : (
            <Details value={payment.data.data} />
          )}
        </Modal>
      )}
    </>
  );
}
export function InvoiceDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const q = useReceptionDetail("GET /invoices/{id}", { id });
  return (
    <Modal title="Hóa đơn thanh toán" onClose={onClose}>
      {q.isPending ? (
        <Loading variant="details" />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <article className="invoice-print">
            <div className="eyebrow">PULSE SPORTS CENTER</div>
            <h2>HÓA ĐƠN THANH TOÁN</h2>
            <p>{display(q.data.data.invoiceNumber)}</p>
            <Details
              value={{
                memberName:
                  q.data.data.memberName ||
                  at(q.data.data, "member.user.fullName"),
                planName:
                  q.data.data.planName ||
                  at(q.data.data, "payment.subscription.plan.name"),
                planTier:
                  q.data.data.planTier ||
                  at(q.data.data, "payment.subscription.tier"),
                issuedAt: q.data.data.issuedAt,
                status: q.data.data.status,
                method: at(q.data.data, "payment.method"),
                subtotal: q.data.data.subtotal,
                discount: q.data.data.discount,
                total: q.data.data.total,
              }}
            />
            {!q.data.data.memberName && (
              <p>
                Hóa đơn cũ chưa lưu tên tại thời điểm phát hành; thông tin hiển
                thị lấy từ hồ sơ hiện tại.
              </p>
            )}
            <h3>Tổng thanh toán: {money(q.data.data.total)}</h3>
          </article>
          <div className="modal-footer">
            <button className="button primary" onClick={() => window.print()}>
              In / Lưu PDF
            </button>
            <button className="button" onClick={onClose}>
              Đóng
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function RefundConfirmation({
  payment,
  onClose,
}: {
  payment: RecordData;
  onClose: () => void;
}) {
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api("POST /payments/{id}/refund/confirm", {
        params: { id: String(payment.id) },
        body: { reference: reference.trim(), reason: reason.trim() },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries();
      onClose();
    },
  });
  return (
    <Modal
      title="Xác nhận đã hoàn tiền"
      onClose={onClose}
      dismissible={!save.isPending}
    >
      <form
        className="manager-config-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!save.isPending) save.mutate();
        }}
      >
        <p>
          Chỉ xác nhận sau khi đã trả {money(payment.refundRequestedAmount)}.
          Thao tác này ghi nhận tiền thực tế, không tự chuyển khoản.
        </p>
        <fieldset disabled={save.isPending}>
          <label>
            Mã biên nhận / chuyển khoản
            <input
              required
              minLength={3}
              maxLength={200}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Lý do
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {save.error && <ErrorState error={save.error} />}
          <div className="modal-footer">
            <button type="button" className="button" onClick={onClose}>
              Hủy
            </button>
            <button
              className="button primary"
              disabled={
                save.isPending ||
                reference.trim().length < 3 ||
                reason.trim().length < 3
              }
            >
              {save.isPending ? "Đang xác nhận…" : "Xác nhận đã trả tiền"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function RetryActivation({ id }: { id: string }) {
  const client = useQueryClient();
  const retry = useMutation({
    mutationFn: () =>
      api("POST /payments/{id}/retry-activation", { params: { id } }),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
  return (
    <>
      <button
        className="button small"
        disabled={retry.isPending}
        onClick={() => retry.mutate()}
      >
        {retry.isPending ? "Đang xử lý…" : "Thử kích hoạt lại"}
      </button>
      {retry.isError && <ErrorState error={retry.error} />}
    </>
  );
}
