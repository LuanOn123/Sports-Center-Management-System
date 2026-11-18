import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { allPages } from "../pagedApi";
import { ErrorState } from "../feedback";

export function UserFacilityField({
  value,
  onChange,
  filter = false,
  disabled = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  filter?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const labelId = useId();
  const facilities = useQuery({
    queryKey: ["user-facility-options"],
    queryFn: ({ signal }) =>
      allPages<{ id: string; name: string; isActive: boolean }>(
        "GET /facilities",
        { query: { includeInactive: "true" }, signal },
      ),
  });
  return (
    <label>
      <span id={labelId}>{label ?? (filter ? "Lọc theo cơ sở" : "Cơ sở phân công")}</span>
      <select
        aria-labelledby={labelId}
        value={value}
        disabled={disabled || facilities.isPending || facilities.isError}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{filter ? "Tất cả cơ sở" : label ? "Chọn cơ sở" : "Chưa phân công"}</option>
        {filter && <option value="unassigned">Nhân sự chưa phân công</option>}
        {facilities.data?.data
          .filter(
            (facility) => filter || facility.isActive || facility.id === value,
          )
          .map((facility) => (
            <option
              key={facility.id}
              value={facility.id}
              disabled={!filter && !facility.isActive}
            >
              {facility.name}
              {facility.isActive ? "" : " (ngừng hoạt động)"}
            </option>
          ))}
      </select>
      {facilities.error && (
        <ErrorState
          error={facilities.error}
          retry={() => facilities.refetch()}
        />
      )}
    </label>
  );
}
