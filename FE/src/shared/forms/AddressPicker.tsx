import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { ErrorState } from "../feedback";
import "./form-design.css";

export function AddressPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [preserveExisting, setPreserveExisting] = useState(Boolean(value));
  const [provinceCode, setProvinceCode] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [street, setStreet] = useState("");
  const units = useQuery({
    queryKey: ["vietnam-address-units"],
    queryFn: async () =>
      (await import("../../data/vietnam-address-units.json")).default,
    staleTime: Infinity,
  });
  const province = units.data?.find((row) => String(row.code) === provinceCode);
  const ward = province?.wards.find((row) => String(row.code) === wardCode);
  function updateStreet(next: string) {
    setStreet(next);
    onChange(
      next.trim() && province && ward
        ? `${next.trim()}, ${ward.name}, ${province.name}`
        : "",
    );
  }
  return (
    <section
      className="address-picker facility-editor-wide"
      aria-label="Địa chỉ cơ sở"
    >
      <div className="address-picker-heading">
        <MapPin size={18} aria-hidden="true" />
        <strong>Địa chỉ cơ sở</strong>
      </div>
      <p className="address-picker-note">
        Chọn tỉnh/thành phố, sau đó chọn phường/xã/đặc khu và nhập số nhà, tên
        đường.
      </p>
      {preserveExisting ? (
        <div className="address-existing">
          <label>
            <span>Địa chỉ hiện tại</span>
            <input value={value} readOnly required />
          </label>
          <button
            type="button"
            className="button small"
            onClick={() => {
              setPreserveExisting(false);
              onChange("");
            }}
          >
            Chọn lại địa chỉ
          </button>
        </div>
      ) : (
        <>
          {units.error && (
            <ErrorState
              error={
                new Error("Không tải được danh mục địa chỉ. Vui lòng thử lại.")
              }
              retry={() => units.refetch()}
            />
          )}
          <div className="facility-editor-grid">
            <label>
              <span>
                Tỉnh / Thành phố <span className="required">*</span>
              </span>
              <select
                required
                value={provinceCode}
                disabled={!units.data}
                onChange={(event) => {
                  setProvinceCode(event.target.value);
                  setWardCode("");
                  setStreet("");
                  onChange("");
                }}
              >
                <option value="">
                  {units.isPending
                    ? "Đang tải tỉnh/thành phố…"
                    : "Chọn tỉnh / thành phố"}
                </option>
                {units.data?.map((row) => (
                  <option value={row.code} key={row.code}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Phường / Xã / Đặc khu <span className="required">*</span>
              </span>
              <select
                required
                value={wardCode}
                disabled={!province}
                onChange={(event) => {
                  setWardCode(event.target.value);
                  setStreet("");
                  onChange("");
                }}
              >
                <option value="">
                  {province
                    ? "Chọn phường / xã / đặc khu"
                    : "Chọn tỉnh / thành phố trước"}
                </option>
                {province?.wards.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="facility-editor-wide">
              <span>
                Số nhà, tên đường <span className="required">*</span>
              </span>
              <input
                required
                disabled={!ward}
                value={street}
                autoComplete="street-address"
                placeholder="VD: 123 Nguyễn Văn Trỗi"
                onChange={(event) => updateStreet(event.target.value)}
              />
            </label>
          </div>
          {value && (
            <div className="address-preview" role="status">
              <small>Địa chỉ đầy đủ</small>
              <p>{value}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
