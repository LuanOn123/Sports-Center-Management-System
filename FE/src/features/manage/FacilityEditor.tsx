import { useState } from "react";
import type { FormEvent } from "react";
import { Building2, Check, LoaderCircle, Settings2 } from "lucide-react";
import { api } from "../../shared/api";
import { ErrorState } from "../../shared/feedback";
import "./facility-editor.css";
import { AddressPicker } from "../../shared/forms/AddressPicker";

const limitFields = [
  {
    key: "maxClasses",
    label: "Số lớp học tối đa",
    hint: "Các lớp đang hoạt động tại cơ sở.",
    unit: "lớp",
  },
  {
    key: "maxRooms",
    label: "Số phòng tập tối đa",
    hint: "Các phòng tập đang hoạt động.",
    unit: "phòng",
  },
  {
    key: "maxCoaches",
    label: "Số huấn luyện viên tối đa",
    hint: "Huấn luyện viên đang được phân công.",
    unit: "người",
  },
  {
    key: "maxMembers",
    label: "Số hội viên tối đa",
    hint: "Hội viên có gói còn hạn phát hành tại cơ sở hoặc đã đăng ký lớp ở đây.",
    unit: "người",
  },
  {
    key: "maxSports",
    label: "Số bộ môn tối đa",
    hint: "Các bộ môn thuộc những lớp đang hoạt động.",
    unit: "bộ môn",
  },
] as const;
type LimitKey = (typeof limitFields)[number]["key"];
type FacilityValues = {
  id: string;
  code: string;
  name: string;
  address: string;
  contactInfo?: string;
  isActive: boolean;
} & Partial<Record<LimitKey, number | null>>;

export function FacilityEditor({
  initial,
  onBusyChange,
  onSuccess,
  onCancel,
}: {
  initial?: FacilityValues;
  onBusyChange: (busy: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState({
    code: initial?.code || "",
    name: initial?.name || "",
    address: initial?.address || "",
    contactInfo: initial?.contactInfo || "",
  });
  const [limits, setLimits] = useState(
    () =>
      Object.fromEntries(
        limitFields.map(({ key }) => [
          key,
          initial?.[key] == null ? "" : String(initial[key]),
        ]),
      ) as Record<LimitKey, string>,
  );
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(undefined);
    if (
      ![values.code, values.name, values.address].every((value) => value.trim())
    ) {
      setError(new Error("Vui lòng nhập mã cơ sở, tên cơ sở và địa chỉ."));
      return;
    }
    if (
      limitFields.some(
        ({ key }) =>
          limits[key] !== "" &&
          (!Number.isSafeInteger(Number(limits[key])) ||
            Number(limits[key]) < 1),
      )
    ) {
      setError(
        new Error(
          "Giới hạn phải là số nguyên lớn hơn 0. Để trống nếu không giới hạn.",
        ),
      );
      return;
    }
    setBusy(true);
    onBusyChange(true);
    try {
      await api(initial ? "PUT /facilities/{facilityId}" : "POST /facilities", {
        params: initial ? { facilityId: initial.id } : {},
        body: {
          ...Object.fromEntries(
            Object.entries(values).map(([key, value]) => [key, value.trim()]),
          ),
          ...Object.fromEntries(
            limitFields.map(({ key }) => [
              key,
              limits[key] === "" ? null : Number(limits[key]),
            ]),
          ),
          ...(initial ? { isActive: active } : {}),
        },
      });
      onSuccess();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <form className="facility-editor" onSubmit={submit}>
      <fieldset disabled={busy} className="facility-editor-body">
        <section className="facility-editor-section">
          <div className="facility-editor-heading">
            <span>
              <Building2 size={20} aria-hidden="true" />
            </span>
            <div>
              <h3>Thông tin cơ sở</h3>
              <p>
                Điền thông tin để nhận diện và liên hệ cơ sở.{" "}
                <span className="facility-required">*</span> là trường bắt buộc.
              </p>
            </div>
          </div>
          <div className="facility-editor-grid">
            <label>
              <span>
                Mã cơ sở <span className="facility-required">*</span>
              </span>
              <input
                required
                name="code"
                autoComplete="off"
                placeholder="VD: DI_AN"
                value={values.code}
                onChange={(e) => setValues({ ...values, code: e.target.value })}
              />
            </label>
            <label>
              <span>
                Tên cơ sở <span className="facility-required">*</span>
              </span>
              <input
                required
                name="name"
                autoComplete="organization"
                placeholder="VD: Pulse Dĩ An"
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </label>
            <AddressPicker
              value={values.address}
              onChange={(address) =>
                setValues((current) => ({ ...current, address }))
              }
            />
            <label className="facility-editor-wide">
              <span>
                Thông tin liên hệ <small>Tùy chọn</small>
              </span>
              <textarea
                name="contactInfo"
                rows={2}
                placeholder="Số điện thoại, email hoặc hướng dẫn liên hệ"
                value={values.contactInfo}
                onChange={(e) =>
                  setValues({ ...values, contactInfo: e.target.value })
                }
              />
            </label>
          </div>
        </section>
        <details className="facility-editor-limits">
          <summary>
            <Settings2 size={19} aria-hidden="true" />
            <span>Giới hạn vận hành</span>
            <small>Tùy chọn</small>
          </summary>
          <div className="facility-editor-limits-content">
            <p>
              Để trống để không giới hạn. Khi đạt mức đã đặt, hệ thống có thể
              chặn thao tác thêm tương ứng.
            </p>
            <div className="facility-editor-grid">
              {limitFields.map(({ key, label, hint, unit }) => (
                <label key={key}>
                  <span>{label}</span>
                  <span className="facility-number-input">
                    <input
                      name={key}
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Không giới hạn"
                      value={limits[key]}
                      onChange={(e) =>
                        setLimits({ ...limits, [key]: e.target.value })
                      }
                    />
                    <span aria-hidden="true">{unit}</span>
                  </span>
                  <small>{hint}</small>
                </label>
              ))}
            </div>
          </div>
        </details>
        {initial && (
          <label className="facility-editor-active">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>Cơ sở đang hoạt động</span>
          </label>
        )}
        {error != null && <ErrorState error={error} />}
      </fieldset>
      <div className="modal-footer facility-editor-footer">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onCancel}
        >
          Hủy
        </button>
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="facility-editor-spinner" />
          ) : (
            <Check size={17} />
          )}
          {busy ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Tạo cơ sở"}
        </button>
      </div>
    </form>
  );
}
