import Groq from "groq-sdk";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middlewares/errorHandler.js";
import type { AiChatInput } from "./ai.schema.js";

// Khởi tạo Groq (đảm bảo đã thêm GROQ_API_KEY vào .env)
const getGroqAI = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new AppError("Tính năng AI hiện chưa được cấu hình (thiếu GROQ_API_KEY).", 503);
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

export async function chatWithAssistant(data: AiChatInput) {
  // 1. Thu thập Context từ Database (RAG)
  // 1.1 Cơ sở trung tâm (Facilities)
  const facilities = await prisma.facility.findMany({
    where: { isActive: true },
    select: { name: true, address: true, contactInfo: true },
    orderBy: { name: "asc" },
  });

  // 1.2 Các bộ môn thể thao (Sports)
  const sports = await prisma.sport.findMany({
    where: { isActive: true },
    select: { name: true, description: true },
    orderBy: { name: "asc" },
  });

  // 1.3 Danh sách các khóa học / lớp học đang mở (Classes)
  const classes = await prisma.class.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      classType: true,
      areaType: true,
      capacity: true,
      facility: { select: { name: true } },
      sports: { select: { name: true } },
      coaches: {
        select: {
          isPrimary: true,
          coach: { select: { user: { select: { fullName: true } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // 1.4 Danh sách gói tập đang mở bán (Membership Plans)
  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    select: { name: true, price: true, durationDays: true, tier: true, maxConcurrentClasses: true, description: true },
    orderBy: { price: "asc" },
  });

  // 1.5 Các kỳ học sắp hoặc đang diễn ra (Terms)
  const terms = await prisma.term.findMany({
    where: {
      status: { in: ["OPEN_REGISTRATION", "IN_PROGRESS", "PLANNING"] },
    },
    select: {
      name: true,
      code: true,
      status: true,
      startDate: true,
      endDate: true,
      registrationStartDate: true,
      registrationEndDate: true,
      facility: { select: { name: true } },
    },
    orderBy: { startDate: "asc" },
    take: 5,
  });

  // 1.6 Lịch học sắp tới (Class Schedules)
  const now = new Date();
  const schedules = await prisma.classSchedule.findMany({
    where: { startTime: { gte: now }, class: { isActive: true } },
    include: {
      class: {
        select: {
          name: true,
          facility: { select: { name: true } },
          coaches: {
            include: { coach: { include: { user: { select: { fullName: true } } } } },
          },
        },
      },
      room: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
    take: 25,
  });

  // 2. Xây dựng System Prompt (Prompt Hệ Thống)
  let systemPrompt = `Bạn là trợ lý ảo thân thiện của trung tâm thể thao Sports Center. Tên của bạn là "Trợ Lý Sports Center".
Hãy xưng hô là "em" và gọi người dùng là "anh/chị" hoặc "bạn". 
Nhiệm vụ của bạn là giải đáp các thắc mắc về trung tâm thể thao dựa trên DỮ LIỆU THỰC TẾ dưới đây.
- Khi người dùng hỏi có bao nhiêu khóa học/lớp học, hãy trả lời chính xác số lượng (${classes.length} lớp học đang mở) và tóm tắt danh sách các lớp.
- Nếu người dùng hỏi về bộ môn, huấn luyện viên, cơ sở, lịch học hay gói tập, hãy dựa vào dữ liệu thực tế bên dưới để trả lời.
- Nếu người dùng hỏi điều gì không có trong dữ liệu này, hãy lịch sự nói: "Dạ, thông tin này em chưa cập nhật, anh/chị vui lòng liên hệ lễ tân để được hỗ trợ ạ."
- Không được tự bịa ra giá tiền, lịch tập hoặc chính sách sai lệch.

--- DANH SÁCH CƠ SỞ (FACILITIES) ---
`;

  if (facilities.length === 0) {
    systemPrompt += "(Chưa có thông tin cơ sở)\n";
  } else {
    facilities.forEach((f) => {
      systemPrompt += `- Cơ sở: ${f.name} | Địa chỉ: ${f.address}${f.contactInfo ? ` | Liên hệ: ${f.contactInfo}` : ""}\n`;
    });
  }

  systemPrompt += `\n--- CÁC BỘ MÔN THỂ THAO ĐANG HOẠT ĐỘNG --- \n`;
  if (sports.length === 0) {
    systemPrompt += "(Chưa có bộ môn nào)\n";
  } else {
    sports.forEach((sp) => {
      systemPrompt += `- Môn ${sp.name}${sp.description ? `: ${sp.description}` : ""}\n`;
    });
  }

  systemPrompt += `\n--- DANH SÁCH KHÓA HỌC / LỚP HỌC ĐANG MỞ (Tổng cộng: ${classes.length} lớp học) ---\n`;
  if (classes.length === 0) {
    systemPrompt += "(Hiện chưa có lớp học nào đang mở)\n";
  } else {
    classes.forEach((c, idx) => {
      const sportNames = c.sports.map((s) => s.name).join(", ") || "Thể thao chung";
      const coachNames =
        c.coaches
          .map((cm) => cm.coach.user.fullName + (cm.isPrimary ? " (Chính)" : ""))
          .join(", ") || "Chưa xếp HLV";
      const tierReq =
        c.classType === "PREMIUM"
          ? "Yêu cầu gói PREMIUM"
          : "Gói MEMBERSHIP hoặc PREMIUM";
      systemPrompt += `${idx + 1}. Lớp: "${c.name}" | Môn: ${sportNames} | Cơ sở: ${c.facility?.name || "Mọi cơ sở"} | Loại lớp: ${c.classType} (${tierReq}) | HLV: ${coachNames} | Sức chứa: ${c.capacity} học viên${c.description ? ` | Mô tả: ${c.description}` : ""}\n`;
    });
  }

  systemPrompt += `\n--- DANH SÁCH GÓI TẬP (MEMBERSHIP PLANS) ---\n`;
  if (plans.length === 0) {
    systemPrompt += "(Hiện chưa có gói tập nào được cấu hình)\n";
  } else {
    plans.forEach((p) => {
      const priceFormatted = Number(p.price).toLocaleString("vi-VN");
      systemPrompt += `- Gói ${p.name} (Hạng ${p.tier}): Giá ${priceFormatted} VND | Thời hạn: ${p.durationDays} ngày | Học tối đa: ${p.maxConcurrentClasses} lớp cùng lúc${p.description ? ` | Chi tiết: ${p.description}` : ""}\n`;
    });
  }

  systemPrompt += `\n--- KỲ HỌC (TERMS) ---\n`;
  if (terms.length === 0) {
    systemPrompt += "(Hiện chưa có kỳ học nào)\n";
  } else {
    terms.forEach((t) => {
      const start = t.startDate.toLocaleDateString("vi-VN");
      const end = t.endDate.toLocaleDateString("vi-VN");
      const regStart = t.registrationStartDate.toLocaleDateString("vi-VN");
      const regEnd = t.registrationEndDate.toLocaleDateString("vi-VN");
      systemPrompt += `- Kỳ "${t.name}" (${t.code}): Trạng thái: ${t.status} | Thời gian học: ${start} - ${end} | Thời gian mở ĐK: ${regStart} - ${regEnd}${t.facility ? ` | Cơ sở: ${t.facility.name}` : ""}\n`;
    });
  }

  systemPrompt += `\n--- LỊCH HỌC SẮP TỚI (CLASS SCHEDULES) ---\n`;
  if (schedules.length === 0) {
    systemPrompt += "(Hiện tại chưa có lịch học cụ thể nào sắp diễn ra trong hệ thống)\n";
  } else {
    schedules.forEach((s) => {
      const timeStr = s.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const duration = Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000);
      const coachNames = s.class.coaches.map((c) => c.coach.user.fullName).join(", ") || "Chưa xếp HLV";
      systemPrompt += `- Lớp "${s.class.name}" (HLV: ${coachNames}) | Bắt đầu: ${timeStr} | Kéo dài: ${duration} phút | Phòng: ${s.room?.name || "Chưa xếp phòng"} | Cơ sở: ${s.class.facility?.name || "Chưa rõ"}\n`;
    });
  }

  systemPrompt += `\nLưu ý & Chính sách:\n- Câu trả lời nên ngắn gọn, dùng gạch đầu dòng Markdown rõ ràng, dễ nhìn.\n- Trung tâm hỗ trợ thanh toán trực tuyến qua mã QR SePay (tự động kích hoạt gói) và tại quầy.\n- Hội viên cần có gói tập phù hợp để đặt chỗ lớp học. Hạng MEMBERSHIP được học lớp REGULAR; Hạng PREMIUM được học cả REGULAR và PREMIUM.\n- Điểm danh bằng quét mã QR tại phòng tập hoặc dùng mã nhập tay từ HLV.`;

  const groq = getGroqAI();
  const messages: any[] = [{ role: "system", content: systemPrompt }];
  
  if (data.history && data.history.length > 0) {
    messages.push(...data.history);
  }
  messages.push({ role: "user", content: data.message });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
      temperature: 0.5,
    });
    
    return chatCompletion.choices[0]?.message?.content || "Xin lỗi, em không thể trả lời lúc này.";
  } catch (err: any) {
    console.error("[AI Chat Error]", err);
    throw new AppError("Lỗi kết nối đến AI Server. Vui lòng thử lại sau.", 500);
  }
}
