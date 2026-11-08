// lib/enrollOptions.ts
// Chuẩn hóa dữ liệu sheet đăng ký trọn khóa thành body gửi BE — đúng như web (ClassDetailPage):
// ghi chú sức khỏe rỗng → null, mục tiêu rỗng → không gửi, saveToProfile luôn gửi.

export interface EnrollFormValues {
  goal: string;
  healthNotes: string;
  saveToProfile: boolean;
}

export interface EnrollOptions {
  /** Bỏ qua khi trống: BE tự lấy mục tiêu trong hồ sơ hoặc "Hoàn thành khóa học <tên lớp>" */
  goal?: string;
  healthNotes: string | null;
  saveToProfile: boolean;
}

export function toEnrollOptions(values: EnrollFormValues): EnrollOptions {
  const goal = values.goal.trim();
  return {
    healthNotes: values.healthNotes.trim() || null,
    saveToProfile: values.saveToProfile,
    ...(goal ? { goal } : {}),
  };
}
