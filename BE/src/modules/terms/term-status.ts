import type { Prisma, Term, TermStatus } from "@prisma/client";

type TermDates = Pick<Term, "status" | "startDate" | "endDate" | "registrationStartDate" | "registrationEndDate">;

export function withTermStatus<T extends TermDates>(term: T, now: Date) {
  let status: TermStatus;
  if (term.status === "CLOSED" || now > term.endDate) status = "CLOSED";
  else if (now >= term.registrationStartDate && now <= term.registrationEndDate) status = "OPEN_REGISTRATION";
  else if (now >= term.startDate) status = "IN_PROGRESS";
  else status = "PLANNING";

  return { ...term, status };
}

export function termStatusWhere(status: TermStatus, now: Date): Prisma.TermWhereInput {
  const closed: Prisma.TermWhereInput = { OR: [{ status: "CLOSED" }, { endDate: { lt: now } }] };
  if (status === "CLOSED") return closed;

  const registrationOpen = { registrationStartDate: { lte: now }, registrationEndDate: { gte: now } };
  if (status === "OPEN_REGISTRATION") return { ...registrationOpen, NOT: closed };

  return {
    startDate: status === "IN_PROGRESS" ? { lte: now } : { gt: now },
    NOT: [closed, registrationOpen],
  };
}

export function termRegistrationBlocker(term: Pick<Term, "id" | "name" | "status" | "registrationStartDate" | "registrationEndDate">, now: Date) {
  const timeLabel = (date: Date) => date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  if (term.status === "CLOSED") {
    return { code: "TERM_CLOSED", message: `Kỳ học "${term.name}" đã kết thúc, không thể đăng ký thêm.`, details: { termId: term.id } };
  }
  if (now < term.registrationStartDate) {
    return {
      code: "TERM_REGISTRATION_NOT_STARTED",
      message: `Kỳ học "${term.name}" chưa đến thời gian đăng ký. Thời gian mở đăng ký: ${timeLabel(term.registrationStartDate)}.`,
      details: { termId: term.id, registrationStartDate: term.registrationStartDate },
    };
  }
  if (now > term.registrationEndDate) {
    return {
      code: "TERM_REGISTRATION_CLOSED",
      message: `Kỳ học "${term.name}" đã hết hạn đăng ký vào ngày ${timeLabel(term.registrationEndDate)}.`,
      details: { termId: term.id, registrationEndDate: term.registrationEndDate },
    };
  }
  return null;
}
