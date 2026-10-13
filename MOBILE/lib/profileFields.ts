// lib/profileFields.ts
// Chuyển đổi giữa chuỗi tự do BE lưu (fitnessGoal, trainingPreference, dateOfBirth)
// và giá trị form dạng chọn (chip / bộ chọn ngày) trên mobile.

import { vietnamDate } from './date';

const CHOICE_SEPARATOR = /[,;\n]/;

export interface ChoiceText {
  selected: string[];
  note: string;
}

/**
 * Tách chuỗi đã lưu thành các lựa chọn có sẵn + phần ghi chú còn lại.
 * Ví dụ "Tăng cơ, Giảm cân, đau gối nhẹ" → selected [Tăng cơ, Giảm cân], note "đau gối nhẹ".
 * Chuỗi cũ nhập tự do trên web không khớp lựa chọn nào sẽ giữ nguyên trong note (không mất dữ liệu).
 */
export function splitChoiceText(text: string | null | undefined, options: readonly string[]): ChoiceText {
  const selected: string[] = [];
  const rest: string[] = [];
  for (const part of (text ?? '').split(CHOICE_SEPARATOR).map((p) => p.trim()).filter(Boolean)) {
    const option = options.find((o) => o.toLocaleLowerCase('vi') === part.toLocaleLowerCase('vi'));
    if (option && !selected.includes(option)) selected.push(option);
    else if (!option) rest.push(part);
  }
  return { selected: options.filter((o) => selected.includes(o)), note: rest.join(', ') };
}

/** Ghép lại thành chuỗi để gửi BE — lựa chọn theo thứ tự có sẵn, ghi chú ở cuối */
export function joinChoiceText({ selected, note }: ChoiceText, options: readonly string[]) {
  return [...options.filter((o) => selected.includes(o)), note.trim()].filter(Boolean).join(', ');
}

/** Bật/tắt một lựa chọn trong danh sách chọn nhiều */
export function toggleChoice(selected: string[], option: string) {
  return selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
}

export interface DateParts {
  year: number;
  month: number; // 1–12
  day: number;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "YYYY-MM-DD" → các phần ngày; null nếu không hợp lệ */
export function parseIsoDate(value: string | null | undefined): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Các phần ngày → "YYYY-MM-DD" (ngày bị kẹp về cuối tháng nếu vượt, vd 31/02 → 28/02) */
export function toIsoDate({ year, month, day }: DateParts) {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

/** Hôm nay theo giờ Việt Nam (không phụ thuộc múi giờ máy) */
export function todayParts(now = new Date()): DateParts {
  const d = vietnamDate(now);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** So sánh hai ngày: âm nếu a trước b, 0 nếu trùng */
export function compareDate(a: DateParts, b: DateParts) {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Cộng/trừ năm, 29/02 rơi vào năm không nhuận → 28/02 */
function addYears({ year, month, day }: DateParts, years: number): DateParts {
  const y = year + years;
  return { year: y, month, day: Math.min(day, daysInMonth(y, month)) };
}

function nextDay({ year, month, day }: DateParts): DateParts {
  if (day < daysInMonth(year, month)) return { year, month, day: day + 1 };
  return month < 12 ? { year, month: month + 1, day: 1 } : { year: year + 1, month: 1, day: 1 };
}

/** Tuổi tròn tại ngày today */
export function ageOn(birth: DateParts, today: DateParts) {
  const age = today.year - birth.year;
  return today.month < birth.month || (today.month === birth.month && today.day < birth.day) ? age - 1 : age;
}

/** Khoảng ngày sinh hợp lệ để tuổi nằm trong [minAge, maxAge] */
export function birthDateBounds(today: DateParts, minAge: number, maxAge: number) {
  return { min: nextDay(addYears(today, -(maxAge + 1))), max: addYears(today, -minAge) };
}

/** Lỗi ngày sinh (rỗng = hợp lệ vì không bắt buộc) */
export function birthDateError(value: string | null | undefined, today: DateParts, minAge: number, maxAge: number) {
  if (!value) return null;
  const birth = parseIsoDate(value);
  if (!birth) return 'Ngày sinh không hợp lệ';
  const age = ageOn(birth, today);
  return age < minAge || age > maxAge ? `Độ tuổi cho phép từ ${minAge} đến ${maxAge}` : null;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" để hiển thị */
export function formatIsoDate(value: string | null | undefined) {
  const parts = parseIsoDate(value);
  return parts ? `${pad(parts.day)}/${pad(parts.month)}/${parts.year}` : '';
}
