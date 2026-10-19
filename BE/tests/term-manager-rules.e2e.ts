import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma.js";
import { connectMongo } from "../src/config/mongoose.js";
import { User } from "../src/models/User.js";
import * as termsService from "../src/modules/terms/terms.service.js";

async function runManagerRulesTest() {
  console.log("═════════════════════════════════════════════════════════════════════");
  console.log("  KIỂM THỬ TẬP QUY TẮC NGHIỆP VỤ MANAGER ĐỐI VỚI KỲ HỌC (TERMS)");
  console.log("═════════════════════════════════════════════════════════════════════\n");

  await connectMongo();

  // 1. Lấy hoặc tạo 2 cơ sở (Facility A và Facility B) để kiểm tra cách ly phạm vi (Scope Isolation)
  let facilities = await prisma.facility.findMany({ take: 2 });
  if (facilities.length < 2) {
    console.log("Đang tạo cơ sở phụ để phục vụ kiểm thử phân quyền...");
    const f1 = await prisma.facility.create({
      data: { name: "Cơ sở A (Cầu Giấy)", code: `F_A_${Date.now().toString().slice(-4)}`, address: "Hà Nội" },
    });
    const f2 = await prisma.facility.create({
      data: { name: "Cơ sở B (Thanh Xuân)", code: `F_B_${Date.now().toString().slice(-4)}`, address: "Hà Nội" },
    });
    facilities = [f1, f2];
  }

  const facilityA = facilities[0];
  const facilityB = facilities[1];
  console.log(`[1] Cơ sở A: "${facilityA.name}" (ID: ${facilityA.id})`);
  console.log(`    Cơ sở B: "${facilityB.name}" (ID: ${facilityB.id})`);

  const ts = Date.now().toString().slice(-5);
  const now = new Date();
  const startDate = new Date(now.getTime() + 10 * 24 * 3600 * 1000);
  const endDate = new Date(now.getTime() + 70 * 24 * 3600 * 1000);
  const regStartDate = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const regEndDate = new Date(now.getTime() + 9 * 24 * 3600 * 1000);

  let termGlobal: any = null;
  let termA: any = null;
  let termB: any = null;

  try {
    // 2. Tạo 3 kỳ học mẫu: 1 toàn hệ thống, 1 cho Cơ sở A, 1 cho Cơ sở B
    console.log("\n[2] Khởi tạo dữ liệu kỳ học cho các phạm vi khác nhau...");
    termGlobal = await termsService.createTerm({
      code: `TERM_SYS_${ts}`,
      name: `Kỳ Chung Toàn Hệ Thống ${ts}`,
      startDate,
      endDate,
      registrationStartDate: regStartDate,
      registrationEndDate: regEndDate,
      status: "OPEN_REGISTRATION",
      facilityId: null,
    });
    console.log(`   ✓ Tạo kỳ TOÀN HỆ THỐNG: ${termGlobal.name} (facilityId: null)`);

    termA = await termsService.createTerm({
      code: `TERM_F_A_${ts}`,
      name: `Kỳ Riêng Cơ Sở A ${ts}`,
      startDate,
      endDate,
      registrationStartDate: regStartDate,
      registrationEndDate: regEndDate,
      status: "OPEN_REGISTRATION",
      facilityId: facilityA.id,
    });
    console.log(`   ✓ Tạo kỳ CƠ SỞ A: ${termA.name} (facilityId: ${facilityA.id})`);

    termB = await termsService.createTerm({
      code: `TERM_F_B_${ts}`,
      name: `Kỳ Riêng Cơ Sở B ${ts}`,
      startDate,
      endDate,
      registrationStartDate: regStartDate,
      registrationEndDate: regEndDate,
      status: "PLANNING",
      facilityId: facilityB.id,
    });
    console.log(`   ✓ Tạo kỳ CƠ SỞ B: ${termB.name} (facilityId: ${facilityB.id})`);

    // 3. Rule 1: Manager Cơ sở A xem danh sách kỳ học (listTerms)
    console.log("\n[3] RULE 1: Danh sách kỳ học hiển thị cho Manager Cơ sở A...");
    const listResultA = await termsService.listTerms({ facilityId: facilityA.id });
    const termsForManagerA = listResultA.terms;
    const hasTermA = termsForManagerA.some((t) => t.id === termA.id);
    const hasTermGlobal = termsForManagerA.some((t) => t.id === termGlobal.id);
    const hasTermB = termsForManagerA.some((t) => t.id === termB.id);

    assert.ok(hasTermA, "Manager Cơ sở A phải thấy kỳ học của cơ sở mình");
    assert.ok(hasTermGlobal, "Manager Cơ sở A phải thấy kỳ học chung toàn hệ thống");
    assert.strictEqual(hasTermB, false, "Manager Cơ sở A TUYỆT ĐỐI KHÔNG ĐƯỢC thấy kỳ riêng của Cơ sở B");
    console.log("   ✓ Manager A chỉ thấy kỳ của cơ sở mình và kỳ toàn hệ thống, không thấy kỳ của cơ sở B.");

    // 4. Rule 2: Manager Cơ sở A cập nhật kỳ học (updateTerm)
    console.log("\n[4] RULE 2: Phân quyền cập nhật kỳ học (updateTerm)...");
    // 4.1 Cập nhật hợp lệ kỳ của chính cơ sở A
    const updatedA = await termsService.updateTerm(termA.id, { name: `${termA.name} (Đã Sửa)` }, facilityA.id);
    assert.ok(updatedA.name.includes("(Đã Sửa)"), "Manager A phải sửa được kỳ của cơ sở mình");
    console.log("   ✓ Manager A cập nhật thành công kỳ học của cơ sở A.");

    // 4.2 Thử sửa kỳ của Cơ sở B -> Phải bị chặn 403
    try {
      await termsService.updateTerm(termB.id, { name: "Hack Term B" }, facilityA.id);
      assert.fail("Hệ thống phải chặn Manager A sửa kỳ của Cơ sở B");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 403);
      console.log(`   ✓ Đã chặn Manager A sửa kỳ cơ sở B (403): ${err.message}`);
    }

    // 4.3 Thử sửa kỳ Toàn hệ thống (null facilityId) -> Phải bị chặn 403
    try {
      await termsService.updateTerm(termGlobal.id, { name: "Hack Global Term" }, facilityA.id);
      assert.fail("Hệ thống phải chặn Manager A sửa kỳ chung hệ thống");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 403);
      console.log(`   ✓ Đã chặn Manager A sửa kỳ toàn hệ thống (403): ${err.message}`);
    }

    // 5. Rule 3: Phân quyền xóa kỳ học (deleteTerm)
    console.log("\n[5] RULE 3: Phân quyền xóa kỳ học (deleteTerm)...");
    // 5.1 Thử xóa kỳ của Cơ sở B -> Phải chặn 403
    try {
      await termsService.deleteTerm(termB.id, facilityA.id);
      assert.fail("Hệ thống phải chặn Manager A xóa kỳ của Cơ sở B");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 403);
      console.log(`   ✓ Đã chặn Manager A xóa kỳ cơ sở B (403): ${err.message}`);
    }

    // 5.2 Thử xóa kỳ Toàn hệ thống -> Phải chặn 403
    try {
      await termsService.deleteTerm(termGlobal.id, facilityA.id);
      assert.fail("Hệ thống phải chặn Manager A xóa kỳ chung toàn hệ thống");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 403);
      console.log(`   ✓ Đã chặn Manager A xóa kỳ chung hệ thống (403): ${err.message}`);
    }

    // 6. Rule 4: Ràng buộc xếp lịch học theo kỳ và cơ sở (assertCanScheduleInTerm)
    console.log("\n[6] RULE 4: Ràng buộc khi xếp lịch học vào kỳ (assertCanScheduleInTerm)...");
    const schedStart = new Date(startDate.getTime() + 1 * 24 * 3600 * 1000);
    const schedEnd = new Date(schedStart.getTime() + 2 * 3600 * 1000);

    // 6.1 Xếp lịch lớp tại Cơ sở A vào Kỳ A -> Hợp lệ
    const okScheduleA = await termsService.assertCanScheduleInTerm(termA.id, schedStart, schedEnd, facilityA.id);
    assert.ok(okScheduleA, "Phải cho phép xếp lịch cơ sở A vào kỳ A");
    console.log("   ✓ Xếp lịch lớp Cơ sở A vào Kỳ A thành công.");

    // 6.2 Xếp lịch lớp tại Cơ sở A vào Kỳ Toàn hệ thống -> Hợp lệ
    const okScheduleGlobal = await termsService.assertCanScheduleInTerm(termGlobal.id, schedStart, schedEnd, facilityA.id);
    assert.ok(okScheduleGlobal, "Phải cho phép xếp lịch cơ sở A vào kỳ toàn hệ thống");
    console.log("   ✓ Xếp lịch lớp Cơ sở A vào Kỳ toàn hệ thống thành công.");

    // 6.3 Xếp lịch lớp tại Cơ sở A nhưng chọn Kỳ của Cơ sở B -> BỊ CHẶN 400
    try {
      await termsService.assertCanScheduleInTerm(termB.id, schedStart, schedEnd, facilityA.id);
      assert.fail("Hệ thống phải chặn xếp lịch của cơ sở A vào kỳ của cơ sở B");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 400);
      console.log(`   ✓ Đã chặn xếp lịch lớp cơ sở A vào kỳ của cơ sở B (400): ${err.message}`);
    }

    // 7. Rule 5: Lấy kỳ học hiện tại theo cơ sở (getCurrentTerm)
    console.log("\n[7] RULE 5: Tìm kiếm kỳ học hiện tại theo cơ sở (getCurrentTerm)...");
    const currentA = await termsService.getCurrentTerm(facilityA.id);
    assert.ok(currentA, "Phải tìm thấy kỳ hiện tại cho Cơ sở A");
    console.log(`   ✓ Lấy kỳ hiện tại cho Cơ sở A thành công: "${currentA.name}" (Facility: ${currentA.facilityId || "Toàn hệ thống"})`);

    // 8. Dọn dẹp dữ liệu test
    console.log("\n[8] Dọn dẹp dữ liệu kiểm thử...");
    await termsService.deleteTerm(termA.id, facilityA.id);
    await termsService.deleteTerm(termB.id, facilityB.id);
    await termsService.deleteTerm(termGlobal.id);
    console.log("   ✓ Đã dọn dẹp sạch sẽ các kỳ học thử nghiệm.");

    console.log("\n═════════════════════════════════════════════════════════════════════");
    console.log("  TẤT CẢ QUY TẮC NGHIỆP VỤ MANAGER ĐỐI VỚI KỲ HỌC ĐÃ ĐƯỢC XÁC THỰC! ");
    console.log("═════════════════════════════════════════════════════════════════════\n");
  } catch (error) {
    // Cleanup if failure
    if (termA?.id) await prisma.term.deleteMany({ where: { id: termA.id } });
    if (termB?.id) await prisma.term.deleteMany({ where: { id: termB.id } });
    if (termGlobal?.id) await prisma.term.deleteMany({ where: { id: termGlobal.id } });
    throw error;
  }
}

runManagerRulesTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
