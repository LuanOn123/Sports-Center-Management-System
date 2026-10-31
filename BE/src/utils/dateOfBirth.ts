import { z } from "zod";

// No minimum age is imposed; reject future dates and impossible lifespans.
export const dateOfBirth = z.string()
  .refine(value => !value || Number.isFinite(Date.parse(value)), "Ngày sinh không hợp lệ")
  .refine(value => !value || new Date(value) <= new Date(), "Ngày sinh không được ở tương lai")
  .refine(value => {
    const earliest = new Date();
    earliest.setUTCFullYear(earliest.getUTCFullYear() - 120);
    return !value || new Date(value) >= earliest;
  }, "Ngày sinh không được vượt quá 120 năm trước");
