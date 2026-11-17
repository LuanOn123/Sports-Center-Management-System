import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { Empty, ErrorState, Loading } from "./ui";
import { ClipboardList, Plus, Sparkles } from "lucide-react";
import "./operation-surfaces.css";

type Plan = {
  id: string;
  memberId: string | null;
  title: string;
  instructions: string;
  homework: string | null;
  editable?: boolean;
  member?: { user: { fullName: string } };
  coach?: { user: { fullName: string } };
};
type PlanList = { plans: Plan[]; members?: { id: string; name: string }[] };
const emptyForm = { memberId: "", title: "", instructions: "", homework: "" };

export function TrainingPlans({
  classId,
  coach = false,
}: {
  classId: string;
  coach?: boolean;
}) {
  const cache = useQueryClient();
  const queryKey = ["training-plans", classId, coach];
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [objective, setObjective] = useState("");
  const plans = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      api<PlanList>("GET /classes/{id}/training-plans", {
        params: { id: classId },
        signal,
      }),
  });
  const save = useMutation({
    mutationFn: () => {
      const { memberId, ...body } = form;
      return editing
        ? api("PATCH /classes/{id}/training-plans/{planId}", {
            params: { id: classId, planId: editing },
            body,
          })
        : api("POST /classes/{id}/training-plans", {
            params: { id: classId },
            body: { ...body, memberId: memberId || null },
          });
    },
    onSuccess: () => {
      setShowForm(false);
      void cache.invalidateQueries({ queryKey: ["training-plans", classId] });
    },
  });
  const suggest = useMutation({
    mutationFn: () =>
      api<{ draft: string }>("POST /classes/{id}/training-plans/suggest", {
        params: { id: classId },
        body: { memberId: form.memberId || null, objective },
      }),
    onSuccess: ({ data }) =>
      setForm((previous) => ({ ...previous, instructions: data.draft })),
  });
  const busy = save.isPending || suggest.isPending;
  function openForm(plan?: Plan) {
    setEditing(plan?.id ?? null);
    setForm(
      plan
        ? {
            memberId: plan.memberId ?? "",
            title: plan.title,
            instructions: plan.instructions,
            homework: plan.homework ?? "",
          }
        : emptyForm,
    );
    setObjective("");
    save.reset();
    suggest.reset();
    setShowForm(true);
  }

  return (
    <section className="panel">
      <div className="operation-heading">
        <div className="operation-heading-title">
          <span className="operation-icon">
            <ClipboardList size={18} aria-hidden="true" />
          </span>
          <h2>Giáo án tập luyện</h2>
        </div>
        {coach && plans.isSuccess && !showForm && (
          <button className="button primary" onClick={() => openForm()}>
            <Plus size={16} aria-hidden="true" /> Tạo giáo án
          </button>
        )}
      </div>
      {plans.isPending ? (
        <Loading />
      ) : plans.error ? (
        <ErrorState error={plans.error} retry={() => plans.refetch()} />
      ) : (
        <>
          {plans.data.data.plans.length === 0 && (
            <Empty text="Chưa có giáo án được giao." />
          )}
          <div className="operation-list">
            {plans.data.data.plans.map((plan) => (
              <article className="operation-card" key={plan.id}>
                <div className="operation-card-top">
                  <h3>{plan.title}</h3>
                  <span className="operation-tag">
                    {plan.memberId
                      ? plan.member?.user.fullName || "Giáo án cá nhân"
                      : "Giáo án cả lớp"}
                  </span>
                </div>
                {plan.coach && (
                  <p className="field-note">HLV {plan.coach.user.fullName}</p>
                )}
                <p className="operation-text">{plan.instructions}</p>
                {plan.homework && (
                  <div className="operation-callout">
                    <strong>Bài tập về nhà</strong>
                    <p className="operation-text">{plan.homework}</p>
                  </div>
                )}
                {plan.editable && !showForm && (
                  <button className="button" onClick={() => openForm(plan)}>
                    Sửa giáo án
                  </button>
                )}
              </article>
            ))}
          </div>
          {coach && showForm && (
            <form
              className="training-editor"
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy) save.mutate();
              }}
            >
              <fieldset className="form-grid" disabled={busy}>
                <label>
                  Giao cho
                  <select
                    disabled={Boolean(editing)}
                    value={form.memberId}
                    onChange={(event) =>
                      setForm({ ...form, memberId: event.target.value })
                    }
                  >
                    <option value="">Cả lớp</option>
                    {plans.data.data.members?.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tiêu đề
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                  />
                </label>
                <div className="training-ai">
                  <label>
                    Mục tiêu để AI gợi ý (tùy chọn)
                    <input
                      maxLength={300}
                      value={objective}
                      onChange={(event) => setObjective(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="button"
                    onClick={() => suggest.mutate()}
                  >
                    <Sparkles size={16} aria-hidden="true" />
                    {suggest.isPending
                      ? "Đang tạo bản nháp…"
                      : "Tạo bản nháp bằng AI"}
                  </button>
                  {suggest.isSuccess && (
                    <p role="status">
                      Bản nháp đã được điền vào nội dung. Hãy rà soát trước khi
                      giao.
                    </p>
                  )}
                  {suggest.error && <ErrorState error={suggest.error} />}
                </div>
                <label className="wide">
                  Nội dung giáo án
                  <textarea
                    required
                    minLength={3}
                    maxLength={6000}
                    rows={6}
                    value={form.instructions}
                    onChange={(event) =>
                      setForm({ ...form, instructions: event.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  Bài tập về nhà (tùy chọn)
                  <textarea
                    maxLength={3000}
                    rows={3}
                    value={form.homework}
                    onChange={(event) =>
                      setForm({ ...form, homework: event.target.value })
                    }
                  />
                </label>
              </fieldset>
              {save.error && <ErrorState error={save.error} />}
              <div className="modal-footer">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setShowForm(false)}
                >
                  Hủy
                </button>
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  {editing ? "Lưu giáo án" : "Giao giáo án"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
