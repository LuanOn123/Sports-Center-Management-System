import { CancelSubscription } from "../../../shared/CancelSubscription";
import { downgradeReason, isEffectiveSubscription } from "../../../shared/businessRules";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { RecordData } from "../../../shared/api";
import { display, money } from "../../../shared/config";
import { Details, ErrorState, Loading } from "../../../shared/ui";
import { useReceptionDetail, useReceptionList } from "../api";
import { subscriptionTransitions } from "../../../shared/businessRules";
import { StatusAction } from "../../../shared/StatusAction";
import {
  ActionForm,
  Heading,
  ListState,
  MemberPicker,
  Table,
} from "../components";
export function MembershipPage({ role = "RECEPTIONIST" }: { role?: string }) {
  const [search, setSearch] = useSearchParams();
  const linkedId = search.get("memberId") || "";
  const linked = useReceptionDetail(
    "GET /members/{id}",
    { id: linkedId },
    Boolean(linkedId),
  );
  const [selected, setSelected] = useState<RecordData | null>(null);
  const member = selected || linked.data?.data || null;
  const [action, setAction] = useState<{ id?: string } | null>(null);
  const id = String(member?.id || "");
  const status = useReceptionDetail(
    "GET /members/{id}/membership-status",
    { id },
    Boolean(id),
  );
  const subscriptions = useReceptionList(
    "GET /subscriptions/member/{memberId}",
    {},
    { memberId: id },
    Boolean(id),
  );
  const plans = useReceptionList("GET /membership-plans", { isActive: "true" });
  const hasPlans = (plans.data?.data || []).some(
    (p) => p.id && p.isActive !== false,
  );
  const current = subscriptions.data?.data.find((s) => isEffectiveSubscription({ status: String(s.status), startDate: String(s.startDate), endDate: String(s.endDate) }));
  const hasScheduled = subscriptions.data?.data.some((s) => s.status === "SCHEDULED");
  const choices = (plans.data?.data || [])
    .filter((p) => p.id && p.isActive !== false)
    .filter(
      (p) =>
        !downgradeReason(
          current as
            { tier: unknown; plan?: { durationDays?: unknown } } | undefined,
          { tier: p.tier, durationDays: p.durationDays },
        ),
    )
    .map((p) => ({
      value: String(p.id),
      label: `${display(p.name)} · ${money(p.price)} · ${display(p.durationDays)} ngày`,
    }));
  return (
    <>
      <Heading title="Gói thành viên" />
      {linkedId && linked.isError && (
        <ErrorState error={linked.error} retry={() => linked.refetch()} />
      )}
      <MemberPicker
        value={member}
        onChange={(m) => {
          setSelected(m);
          setSearch({});
          setAction(null);
        }}
      />
      {id && (
        <>
          <section className="panel reception-section">
            <h2>Trạng thái và thời hạn gói</h2>
            {status.isPending ? (
              <Loading variant="details" />
            ) : status.isError ? (
              <ErrorState error={status.error} retry={() => status.refetch()} />
            ) : (
              <Details value={status.data.data} />
            )}
          </section>
          <section className="panel reception-section">
            <h2>Đăng ký và gia hạn</h2>
            {plans.isError && (
              <ErrorState error={plans.error} retry={() => plans.refetch()} />
            )}
            <p>
              Đăng ký hoặc gia hạn sẽ ghi nhận đã thu tiền và phát hành hóa đơn
              ngay. Chỉ xác nhận sau khi đã nhận đủ tiền. Gia hạn cùng hạng nối tiếp sau ngày hết hạn. Nâng hạng có thể bắt đầu ngay hoặc lên lịch; hạ hạng chỉ bắt đầu sau khi gói hiện tại kết thúc. Mỗi hội viên chỉ có một gói chờ kích hoạt.
            </p>
            {hasScheduled && <p role="status">Hội viên đã có gói chờ kích hoạt. Hãy xử lý gói chờ trước khi đăng ký hoặc gia hạn.</p>}
            <button
              className="button primary"
              disabled={
                hasScheduled ||
                !choices.length ||
                subscriptions.isPending ||
                subscriptions.isError
              }
              onClick={() => setAction({})}
            >
              Đăng ký gói
            </button>
            {!plans.isPending && !plans.isError && !choices.length && (
              <p>
                {hasPlans
                  ? "Không có gói phù hợp để mua mới. Gói mới cần cùng hạng với thời hạn không ngắn hơn, hoặc có hạng cao hơn."
                  : "Chưa có gói đang hoạt động."}
              </p>
            )}
            <ListState result={subscriptions}>
              {(rows) => (
                <Table
                  rows={rows}
                  columns={[
                    ["plan.name", "Gói tập"],
                    ["startDate", "Bắt đầu"],
                    ["endDate", "Hết hạn"],
                    ["status", "Trạng thái"],
                  ]}
                  actions={(row) => (
                    <>
                      <button
                        className="button small"
                        disabled={hasScheduled || !hasPlans || !row.id || row.status !== "ACTIVE"}
                        onClick={() => setAction({ id: String(row.id) })}
                      >
                        Gia hạn
                      </button>
                      {role === "MANAGER" && row.status === "ACTIVE" && (
                        <CancelSubscription
                          role="MANAGER"
                          subscription={
                            row as unknown as {
                              id: string;
                              endDate: string;
                              status: string;
                              plan: { price: number; durationDays: number };
                            }
                          }
                        />
                      )}
                      <StatusAction
                        operation="PATCH /subscriptions/{id}/status"
                        id={String(row.id)}
                        statuses={subscriptionTransitions(
                          {
                            status: row.status,
                            remainingDays: row.remainingDays,
                          },
                          role,
                        ).filter(
                          (s) => s !== "CANCELLED" || row.status !== "ACTIVE",
                        )}
                        explanation="Ngừng quyền lợi là trạng thái cuối, không thể khôi phục gói này. Số ngày còn lại chỉ lưu để đối soát, không cộng vào gói mới. Muốn dùng tiếp, hãy mua hoặc gia hạn để tạo gói mới."
                      />
                    </>
                  )}
                />
              )}
            </ListState>
          </section>
        </>
      )}
      {action && (
        <ActionForm
          title={action.id ? "Gia hạn gói" : "Đăng ký gói"}
          operation={
            action.id ? "POST /subscriptions/{id}/renew" : "POST /subscriptions"
          }
          params={action.id ? { id: action.id } : undefined}
          fixed={action.id ? {} : { memberId: id }}
          choices={{ planId: choices }}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
