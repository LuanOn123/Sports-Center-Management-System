import { z } from "zod";

export const TermStatusEnum = z.enum(["PLANNING", "OPEN_REGISTRATION", "IN_PROGRESS", "CLOSED"]);

export const CreateTermSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Mã kỳ học phải có ít nhất 2 ký tự")
      .max(20, "Mã kỳ học tối đa 20 ký tự")
      .transform((v) => v.toUpperCase()),
    name: z
      .string()
      .trim()
      .min(2, "Tên kỳ học phải có ít nhất 2 ký tự")
      .max(100, "Tên kỳ học tối đa 100 ký tự"),
    startDate: z.string().datetime({ message: "Ngày bắt đầu không hợp lệ (ISO format)" }),
    endDate: z.string().datetime({ message: "Ngày kết thúc không hợp lệ (ISO format)" }),
    registrationStartDate: z
      .string()
      .datetime({ message: "Ngày mở đăng ký không hợp lệ (ISO format)" }),
    registrationEndDate: z
      .string()
      .datetime({ message: "Ngày đóng đăng ký không hợp lệ (ISO format)" }),
    status: TermStatusEnum.optional().default("PLANNING"),
    description: z.string().max(500).optional(),
    facilityId: z.string().uuid("ID cơ sở không hợp lệ").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate).getTime();
    const end = new Date(data.endDate).getTime();
    const regStart = new Date(data.registrationStartDate).getTime();
    const regEnd = new Date(data.registrationEndDate).getTime();

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Ngày kết thúc kỳ học phải sau ngày bắt đầu",
      });
    }
    if (regEnd <= regStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationEndDate"],
        message: "Ngày đóng cổng đăng ký phải sau ngày mở cổng đăng ký",
      });
    }
  });

export const UpdateTermSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(20)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(2).max(100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    registrationStartDate: z.string().datetime().optional(),
    registrationEndDate: z.string().datetime().optional(),
    status: TermStatusEnum.optional(),
    description: z.string().max(500).nullable().optional(),
    facilityId: z.string().uuid("ID cơ sở không hợp lệ").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) <= new Date(data.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "Ngày kết thúc kỳ học phải sau ngày bắt đầu",
        });
      }
    }
    if (data.registrationStartDate && data.registrationEndDate) {
      if (new Date(data.registrationEndDate) <= new Date(data.registrationStartDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registrationEndDate"],
          message: "Ngày đóng cổng đăng ký phải sau ngày mở cổng đăng ký",
        });
      }
    }
  });

export const TermQuerySchema = z.object({
  status: TermStatusEnum.optional(),
  search: z.string().optional(),
  current: z.enum(["true", "false"]).optional(),
  facilityId: z.string().optional(),
  exactFacility: z.string().optional(),
  year: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
