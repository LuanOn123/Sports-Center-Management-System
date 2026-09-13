import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, Inbox, LoaderCircle, X } from "lucide-react";
import { api, ApiError, contract } from "./api";
import type { RecordData, Schema } from "./api";
import { at, display, label, money } from "./config";
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={21} />
      <div>
        <strong>Chưa thể hoàn tất yêu cầu</strong>
        <p>{error instanceof Error ? error.message : "Đã xảy ra lỗi."}</p>
        {error instanceof ApiError &&
          error.errors?.map((e, i) => (
            <p key={i}>
              {label(e.field)}: {e.message}
            </p>
          ))}
        {retry && (
          <button className="button small" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Đang tải dữ liệu…
    </div>
  );
}
export function Empty({
  text = "Chưa có dữ liệu",
  detail = "Dữ liệu sẽ xuất hiện tại đây khi trung tâm có hoạt động.",
}: {
  text?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <span>
        <Inbox size={29} />
      </span>
      <h3>{text}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <small>PULSE / QUẢN LÝ TRUNG TÂM</small>
          <h2>{title}</h2>
        </div>
        <button aria-label="Đóng" className="icon-button" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Details({ value }: { value: unknown }) {
  if (value == null) return <span>—</span>;
  if (typeof value !== "object") return <span>{display(value)}</span>;
  if (Array.isArray(value))
    return value.length ? (
      <div className="detail-list">
        {value.map((v, i) => (
          <div key={i}>
            <Details value={v} />
          </div>
        ))}
      </div>
    ) : (
      <span>Chưa có dữ liệu</span>
    );
  return (
    <dl className="details">
      {Object.entries(value)
        .filter(
          ([k]) =>
            ![
              "password",
              "passwordHash",
              "accessToken",
              "refreshToken",
            ].includes(k),
        )
        .map(([k, v]) => (
          <div key={k}>
            <dt>{label(k)}</dt>
            <dd>
              {typeof v === "object" && v !== null ? (
                <Details value={v} />
              ) : [
                  "price",
                  "amount",
                  "totalRevenue",
                  "total",
                  "subtotal",
                  "discount",
                ].includes(k) ? (
                money(v)
              ) : (
                display(v)
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
const lookupPaths: Record<string, string> = {
  sportId: "/sports",
  roomId: "/rooms",
  classId: "/classes",
  coachId: "/coaches",
};
function Lookup({
  name,
  value,
  onChange,
  required,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  required: boolean;
}) {
  const path = lookupPaths[name];
  const q = useQuery({
    queryKey: ["lookup", path],
    queryFn: async ({ signal }) => {
      const records: RecordData[] = [];
      let page = 1;
      while (true) {
        const res = await api<RecordData[]>("GET " + path, {
          query: { page: String(page), limit: "100" },
          signal,
        });
        records.push(...res.data);
        if (!res.pagination || page >= res.pagination.totalPages) break;
        page++;
      }
      return records;
    },
  });
  return (
    <>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={q.isPending || q.isError}
      >
        <option value="">
          {q.isPending ? "Đang tải…" : "Chọn " + label(name).toLowerCase()}
        </option>
        {q.data?.map((row) => {
          const id = name === "coachId" ? at(row, "coachProfile.id") : row.id;
          return id ? (
            <option key={String(id)} value={String(id)}>
              {String(row.name || row.fullName)}
              {row.isActive === false ? " (ngừng hoạt động)" : ""}
            </option>
          ) : null;
        })}
      </select>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {name === "coachId" && q.data?.some((r) => !at(r, "coachProfile.id")) && (
        <p className="field-note">
          Một số hồ sơ chưa được API cung cấp mã huấn luyện viên nên chưa thể
          chọn.
        </p>
      )}
    </>
  );
}
export function SchemaForm({
  operation,
  params,
  initial = {},
  fixed = {},
  onSuccess,
  onCancel,
}: {
  operation: string;
  params?: Record<string, string>;
  initial?: RecordData;
  fixed?: RecordData;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const schema = contract[operation]?.body;
  const [values, setValues] = useState<RecordData>(() => ({
    ...Object.fromEntries(
      Object.entries(schema?.properties || {}).map(([k, s]) => [
        k,
        initial[k] ?? s.default ?? "",
      ]),
    ),
    ...fixed,
  }));
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  if (!schema)
    return <p>Swagger chưa cung cấp hợp đồng cập nhật cho chức năng này.</p>;
  const change = (k: string, v: unknown) =>
    setValues((prev) => ({ ...prev, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const body: RecordData = {};
    for (const [k, s] of Object.entries(schema!.properties || {})) {
      if (
        ["fitnessGoal", "trainingLevel", "trainingPreference"].includes(k) &&
        values.role &&
        values.role !== "MEMBER"
      )
        continue;
      let v = values[k];
      if (v === "" || v === undefined || v === null) continue;
      if (s.type === "number" || s.type === "integer") v = Number(v);
      if (s.format === "date-time") v = new Date(String(v)).toISOString();
      body[k] = typeof v === "string" && !/password/i.test(k) ? v.trim() : v;
    }
    if (
      body.startTime &&
      body.endTime &&
      String(body.startTime) >= String(body.endTime)
    ) {
      setError(new Error("Thời gian kết thúc phải sau thời gian bắt đầu."));
      return;
    }
    setBusy(true);
    try {
      await api(operation, { params, body });
      onSuccess();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {Object.entries(schema.properties || {})
          .filter(([k]) => !(k in fixed))
          .filter(
            ([k]) =>
              !["fitnessGoal", "trainingLevel", "trainingPreference"].includes(
                k,
              ) ||
              values.role === undefined ||
              values.role === "MEMBER",
          )
          .map(([k, s]) => {
            const required = Boolean(schema.required?.includes(k));
            const value = values[k];
            return (
              <label
                key={k}
                className={["description", "bio"].includes(k) ? "wide" : ""}
              >
                {label(k)}
                {required && <b className="required"> *</b>}
                {lookupPaths[k] ? (
                  <Lookup
                    name={k}
                    required={required}
                    value={String(value || "")}
                    onChange={(v) => change(k, v)}
                  />
                ) : s.type === "boolean" ? (
                  <select
                    value={String(value)}
                    onChange={(e) => change(k, e.target.value === "true")}
                  >
                    <option value="">Không thay đổi</option>
                    <option value="true">Có</option>
                    <option value="false">Không</option>
                  </select>
                ) : s.enum ? (
                  <select
                    required={required}
                    value={String(value)}
                    onChange={(e) => change(k, e.target.value)}
                  >
                    <option value="">Chọn {label(k).toLowerCase()}</option>
                    {s.enum.map((v) => (
                      <option key={v} value={v}>
                        {label(v)}
                      </option>
                    ))}
                  </select>
                ) : ["description", "bio", "fitnessGoal"].includes(k) ? (
                  <textarea
                    value={String(value)}
                    required={required}
                    onChange={(e) => change(k, e.target.value)}
                  />
                ) : (
                  <input
                    type={
                      s.format === "date-time"
                        ? "datetime-local"
                        : /password/i.test(k)
                          ? "password"
                          : k === "email"
                            ? "email"
                            : s.type === "integer" || s.type === "number"
                              ? "number"
                              : "text"
                    }
                    value={
                      s.format === "date-time" && value
                        ? localDateTime(String(value))
                        : String(value)
                    }
                    onChange={(e) => change(k, e.target.value)}
                    required={required}
                    minLength={s.minLength}
                    min={
                      ["capacity", "durationDays"].includes(k)
                        ? 1
                        : ["price", "experienceYears"].includes(k)
                          ? 0
                          : undefined
                    }
                    step={
                      s.type === "integer"
                        ? 1
                        : s.type === "number"
                          ? "any"
                          : undefined
                    }
                    autoComplete={
                      /password/i.test(k) ? "new-password" : undefined
                    }
                  />
                )}
              </label>
            );
          })}
      </div>
      {error != null && <ErrorState error={error} />}
      <div className="modal-footer">
        <button
          className="button"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Check size={17} />
          )}{" "}
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
function localDateTime(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function FilterField({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: Schema;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="filter-field">
      <span>{label(name)}</span>
      {schema.enum ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Tất cả</option>
          {schema.enum.map((v) => (
            <option key={v} value={v}>
              {label(v)}
            </option>
          ))}
        </select>
      ) : lookupPaths[name] ? (
        <Lookup
          name={name}
          required={false}
          value={value}
          onChange={onChange}
        />
      ) : (
        <input
          type={
            /date/i.test(name)
              ? "date"
              : schema.format === "date-time"
                ? "datetime-local"
                : "search"
          }
          placeholder={label(name)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
