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
  // 1. Thu thập Context (RAG)
  // 1.1 Danh sách gói tập đang mở bán
  const plans = await prisma.membershipPlan.findMany({
    where: { isActive: true },
    select: { name: true, price: true, durationDays: true, tier: true, maxConcurrentClasses: true },
  });

  // 1.2 Lịch học trong 3 ngày tới
  const now = new Date();
  const next3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const schedules = await prisma.classSchedule.findMany({
    where: { startTime: { gte: now, lte: next3Days }, class: { isActive: true } },
    include: {
      class: {
        select: {
          name: true,
          description: true,
          coaches: {
            include: { coach: { include: { user: { select: { fullName: true } } } } },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // 2. Xây dựng System Prompt (Prompt Hệ Thống)
  let systemPrompt = `Bạn là trợ lý ảo thân thiện của trung tâm thể thao Sports Center. Tên của bạn là "Trợ Lý Sports Center".
Hãy xưng hô là "em" và gọi người dùng là "anh/chị" hoặc "bạn". 
Nhiệm vụ của bạn là giải đáp các thắc mắc về trung tâm dựa trên DỮ LIỆU THỰC TẾ dưới đây. Nếu người dùng hỏi điều gì không có trong dữ liệu này, hãy nói: "Dạ, thông tin này em chưa cập nhật, anh/chị vui lòng liên hệ lễ tân để được hỗ trợ ạ." Không được tự bịa ra giá tiền, lịch tập hoặc chính sách.

--- DANH SÁCH GÓI TẬP ĐANG MỞ BÁN ---
`;
  if (plans.length === 0) {
    systemPrompt += "(Hiện chưa có gói tập nào được cấu hình)\n";
  } else {
    plans.forEach((p) => {
      systemPrompt += `- Gói ${p.name} (Hạng ${p.tier}): Giá ${Number(p.price).toLocaleString("vi-VN")} VND, Thời hạn ${p.durationDays} ngày, Được học tối đa ${p.maxConcurrentClasses} lớp cùng lúc.\n`;
    });
  }

  systemPrompt += `\n--- LỊCH HỌC TRONG 3 NGÀY TỚI ---\n`;
  if (schedules.length === 0) {
    systemPrompt += "(Không có lịch học nào trong 3 ngày tới)\n";
  } else {
    schedules.forEach((s) => {
      const timeStr = s.startTime.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
      const duration = Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000);
      const coachNames = s.class.coaches.map((c) => c.coach.user.fullName).join(", ") || "Chưa xếp HLV";
      systemPrompt += `- Lớp "${s.class.name}" (HLV: ${coachNames}) | Bắt đầu: ${timeStr} | Kéo dài: ${duration} phút | Phòng: ${s.roomId}\n`;
    });
  }

  systemPrompt += `\nLưu ý:\n- Câu trả lời nên ngắn gọn, dễ đọc (dùng gạch đầu dòng nếu cần).\n- Trung tâm có hỗ trợ thanh toán chuyển khoản qua mã QR (SePay).\n- Hội viên mua gói sẽ được cấp mã QR tự động.`;

  const groq = getGroqAI();
  const messages: any[] = [{ role: "system", content: systemPrompt }];
  
  if (data.history && data.history.length > 0) {
    messages.push(...data.history);
  }
  messages.push({ role: "user", content: data.message });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: "qwen/qwen3.8-27b", // Model mới hỗ trợ rất tốt tiếng Việt
      temperature: 0.5,
    });
    
    return chatCompletion.choices[0]?.message?.content || "Xin lỗi, em không thể trả lời lúc này.";
  } catch (err: any) {
    console.error("[AI Chat Error]", err);
    throw new AppError("Lỗi kết nối đến AI Server. Vui lòng thử lại sau.", 500);
  }
}

// Lấy hoặc tạo HLV AI
async function getOrCreateAiCoach() {
  const email = "ai.coach@sportscenter.com";
  let user = await prisma.user.findUnique({
    where: { email },
    include: { coachProfile: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        password: "AI_GENERATED_PASSWORD",
        fullName: "Trợ Lý AI",
        role: "COACH",
        coachProfile: {
          create: {
            specialization: "AI Personal Trainer",
            bio: "Huấn luyện viên ảo được vận hành bởi AI, chuyên cung cấp các lịch tập cá nhân hóa.",
          },
        },
      },
      include: { coachProfile: true },
    });
  }
  return user.coachProfile!.id;
}

export async function generateTrainingPlan(userId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
    include: { user: true },
  });

  if (!member) {
    throw new AppError("Hội viên không tồn tại", 404);
  }

  const { gender, dateOfBirth, fullName } = member.user;
  const { fitnessGoal, trainingLevel, trainingPreference } = member;

  if (!fitnessGoal && !trainingLevel) {
    throw new AppError("Vui lòng cập nhật mục tiêu và trình độ trong hồ sơ để AI có thể lên lịch tập.", 400);
  }

  // Tính tuổi
  let ageStr = "chưa rõ tuổi";
  if (dateOfBirth) {
    const age = new Date().getFullYear() - dateOfBirth.getFullYear();
    ageStr = `${age} tuổi`;
  }
  const genderStr = gender === "MALE" ? "nam" : gender === "FEMALE" ? "nữ" : "giới tính khác";
  const levelStr =
    trainingLevel === "BEGINNER" ? "cơ bản" : trainingLevel === "INTERMEDIATE" ? "trung bình" : "nâng cao";

  const prompt = `Đóng vai một Huấn luyện viên chuyên nghiệp. Hãy tạo một lịch tập và dinh dưỡng trong 7 ngày cho hội viên có thông tin sau:
- Tên: ${fullName}
- Đối tượng: ${genderStr}, ${ageStr}
- Mục tiêu: ${fitnessGoal || "Rèn luyện sức khoẻ"}
- Trình độ: ${levelStr}
- Thể loại tập yêu thích: ${trainingPreference || "Tự do"}

Yêu cầu:
- Trả về bằng định dạng Markdown đẹp, rõ ràng.
- Ghi rõ các bài tập, số hiệp (sets), số lần (reps) cho từng ngày.
- Có thêm vài gạch đầu dòng về gợi ý dinh dưỡng (ví dụ: ăn nhiều protein, uống đủ nước...).
- Chỉ xuất nội dung markdown lịch tập, tuyệt đối không cần dạo đầu hay chào hỏi thừa thãi.`;

  const groq = getGroqAI();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Bạn là một huấn luyện viên AI chuyên nghiệp." },
        { role: "user", content: prompt },
      ],
      model: "qwen/qwen3.8-27b",
      temperature: 0.7,
    });

    const planContent = completion.choices[0]?.message?.content || "Không thể tạo lịch tập.";

    const aiCoachId = await getOrCreateAiCoach();

    // Lưu vào database
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const plan = await prisma.trainingPlan.create({
      data: {
        memberId: member.id,
        coachId: aiCoachId,
        name: `Lịch tập 7 ngày (Gợi ý bởi AI) - ${new Date().toLocaleDateString("vi-VN")}`,
        description: planContent,
        startDate,
        endDate,
      },
    });

    return plan;
  } catch (err: any) {
    console.error("[AI Training Plan Error]", err);
    throw new AppError("Không thể tạo lịch tập lúc này. Vui lòng thử lại sau.", 500);
  }
}
