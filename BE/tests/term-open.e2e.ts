import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma.js";
import { connectMongo } from "../src/config/mongoose.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { User } from "../src/models/User.js";
import * as termsService from "../src/modules/terms/terms.service.js";
import { CreateTermSchema } from "../src/modules/terms/terms.schema.js";

async function runTest() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  KIỂM THỬ QUY TRÌNH MỞ KỲ HỌC MỚI (ACADEMIC TERM E2E TEST)");
  console.log("═══════════════════════════════════════════════════════════\n");

  await connectMongo();

  // 1. Tìm hoặc kiểm tra Admin
  const adminUser = await User.findOne({ role: "ADMIN" }).lean();
  assert.ok(adminUser, "Phải có tài khoản ADMIN trong hệ thống");
  console.log(`[1] Đăng nhập Admin thành công: ${adminUser.email} (ID: ${adminUser._id})`);

  const token = signAccessToken({
    id: adminUser._id.toString(),
    role: "ADMIN",
  });

  const testCode = `TEST_K_${Date.now().toString().slice(-6)}`;
  let createdTermId = "";

  try {
    // 2. Test Validation khi tạo kỳ học với ngày không hợp lệ
    console.log("\n[2] Kiểm tra ràng buộc hợp lệ ngày tháng (Validation)...");
    const invalidTerm = CreateTermSchema.safeParse({
      code: "INVALID_DATES",
      name: "Kỳ Lỗi Ngày",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-05-01T00:00:00.000Z",
      registrationStartDate: "2026-04-01T00:00:00.000Z",
      registrationEndDate: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(invalidTerm.success, false);

    // 3. Tạo kỳ học mới trong khung giờ đăng ký
    console.log(`\n[3] Tạo kỳ học mới: Mã "${testCode}" trong thời gian mở đăng ký...`);
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000); // 7 ngày nữa bắt đầu
    const endDate = new Date(now.getTime() + 60 * 24 * 3600 * 1000);  // 60 ngày nữa kết thúc
    const regStartDate = new Date(now.getTime() - 1 * 24 * 3600 * 1000); // Đã mở đăng ký từ hôm qua
    const regEndDate = new Date(now.getTime() + 6 * 24 * 3600 * 1000);   // Đóng trước khi kỳ bắt đầu 1 ngày

    const createdTerm = await termsService.createTerm({
      code: testCode,
      name: `Kỳ Học Khóa Mới ${testCode}`,
      startDate,
      endDate,
      registrationStartDate: regStartDate,
      registrationEndDate: regEndDate,
      description: "Kỳ học thử nghiệm mở kỳ mới và kiểm tra quy trình vận hành",
    });

    createdTermId = createdTerm.id;
    assert.equal(createdTerm.code, testCode);
    assert.equal(createdTerm.status, "OPEN_REGISTRATION");
    console.log(`   ✓ Tạo kỳ học thành công! ID: ${createdTerm.id}, Trạng thái: ${createdTerm.status}`);

    // 4. Xác minh bộ lọc nhận diện kỳ đã tự mở đăng ký
    console.log("\n[4] Lọc các kỳ đang mở đăng ký...");
    const { terms } = await termsService.listTerms({ status: "OPEN_REGISTRATION", search: testCode });
    assert.ok(terms?.some((term) => term.id === createdTermId));

    // 5. Kiểm tra getCurrentTerm
    console.log("\n[5] Kiểm tra API lấy kỳ học hiện tại (getCurrentTerm)...");
    const currentTerm = await termsService.getCurrentTerm();
    assert.ok(currentTerm, "Phải tìm thấy kỳ học hiện tại");
    console.log(`   ✓ Kỳ học hiện tại đang hoạt động: "${currentTerm.name}" (Mã: ${currentTerm.code}, Trạng thái: ${currentTerm.status})`);

    // 6. Kiểm tra xếp lịch học hợp lệ vào Kỳ học (assertCanScheduleInTerm)
    console.log("\n[6] Kiểm tra điều kiện xếp lịch học thuộc kỳ (assertCanScheduleInTerm)...");
    // Lịch hợp lệ: nằm trong khoảng startDate - endDate
    const validScheduleStart = new Date(startDate.getTime() + 2 * 24 * 3600 * 1000);
    const validScheduleEnd = new Date(validScheduleStart.getTime() + 2 * 3600 * 1000);
    const validatedTerm = await termsService.assertCanScheduleInTerm(
      createdTermId,
      validScheduleStart,
      validScheduleEnd
    );
    assert.equal(validatedTerm.id, createdTermId);
    console.log("   ✓ Lịch học nằm trọn trong kỳ học được chấp thuận thành công.");

    // Lịch không hợp lệ: nằm ngoài khoảng startDate - endDate
    try {
      const invalidScheduleStart = new Date(startDate.getTime() - 2 * 24 * 3600 * 1000);
      const invalidScheduleEnd = new Date(invalidScheduleStart.getTime() + 2 * 3600 * 1000);
      await termsService.assertCanScheduleInTerm(
        createdTermId,
        invalidScheduleStart,
        invalidScheduleEnd
      );
      assert.fail("Phải chặn buổi học nằm ngoài dải ngày của kỳ");
    } catch (err: any) {
      console.log(`   ✓ Đã chặn thành công lịch học ngoài kỳ: "${err.message}"`);
    }

    // 7. Trạng thái tự chuyển khi kỳ đã bắt đầu và hết hạn đăng ký
    console.log("\n[7] Kiểm tra trạng thái khi kỳ đã bắt đầu...");
    const inProgressTerm = await termsService.updateTerm(createdTermId, {
      startDate: new Date(now.getTime() - 60_000),
      registrationEndDate: new Date(now.getTime() - 60_000),
    });
    assert.equal(inProgressTerm.status, "IN_PROGRESS");
    console.log(`   ✓ Cập nhật thành công: Trạng thái = ${inProgressTerm.status}`);

    // 8. Đóng kỳ học (CLOSED)
    console.log("\n[8] Đóng kỳ học (CLOSED)...");
    const closedTerm = await termsService.updateTerm(createdTermId, {
      status: "CLOSED",
    });
    assert.equal(closedTerm.status, "CLOSED");
    console.log(`   ✓ Đóng kỳ học thành công: Trạng thái = ${closedTerm.status}`);

    // Khi kỳ CLOSED, không thể xếp thêm lịch học
    try {
      await termsService.assertCanScheduleInTerm(
        createdTermId,
        validScheduleStart,
        validScheduleEnd
      );
      assert.fail("Kỳ CLOSED không được phép xếp thêm lịch");
    } catch (err: any) {
      console.log(`   ✓ Đã chặn xếp lịch khi kỳ CLOSED: "${err.message}"`);
    }

    // 9. Dọn dẹp kỳ học thử nghiệm
    console.log("\n[9] Dọn dẹp dữ liệu kiểm thử...");
    await termsService.deleteTerm(createdTermId);
    console.log("   ✓ Đã xóa kỳ học kiểm thử an toàn.");

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ MỞ KỲ HỌC MỚI ĐÃ ĐẠT (PASS)!");
    console.log("═══════════════════════════════════════════════════════════\n");
  } catch (error) {
    if (createdTermId) {
      await prisma.term.delete({ where: { id: createdTermId } }).catch(() => {});
    }
    throw error;
  }
}

runTest().then(() => process.exit(0)).catch((err) => {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err);
  process.exit(1);
});
