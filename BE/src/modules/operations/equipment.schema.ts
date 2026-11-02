import { z } from "zod";
export const EquipmentValuesSchema = z.record(
  z.string().trim().min(1).max(80), z.number().int().positive().max(100000),
).superRefine((values, ctx) => {
  if (Object.keys(values).length > 50)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tối đa 50 loại dụng cụ." });
});
