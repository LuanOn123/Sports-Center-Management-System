import { useState } from "react";

type Option = { value: string; label: string; searchText?: string };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export function MemberSearchSelect({ options, value, onChange, required, disabled }: {
  options: Option[]; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const query = normalize(search.trim());
  const matches = options.filter((option) => normalize(`${option.label} ${option.searchText || ""}`).includes(query));
  const selected = options.find((option) => option.value === value);
  const visible = selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  return <>
    <input type="search" aria-label="Tìm hội viên" placeholder="Tìm theo tên, email hoặc số điện thoại…"
      value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled}
      onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
    <select aria-label="Chọn hội viên" value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn hội viên</option>
      {visible.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {query && <small role="status">{matches.length ? `${matches.length} hội viên phù hợp` : "Không tìm thấy hội viên phù hợp."}</small>}
  </>;
}
