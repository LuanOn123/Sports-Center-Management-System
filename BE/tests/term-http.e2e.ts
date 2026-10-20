import "dotenv/config";
import assert from "node:assert/strict";
import { signAccessToken } from "../src/utils/jwt.js";
import { connectMongo } from "../src/config/mongoose.js";
import { User } from "../src/models/User.js";

const BASE_URL = "http://localhost:8080/api/v1";

async function runHttpTest() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  TEST HTTP API MỞ KỲ HỌC MỚI (REST API /api/v1/terms)");
  console.log("═══════════════════════════════════════════════════════════\n");

  await connectMongo();
  const adminUser = await User.findOne({ role: "ADMIN" }).lean();
  assert.ok(adminUser, "Phải có ADMIN trong Mongo");

  const adminToken = signAccessToken({ id: adminUser._id.toString(), role: "ADMIN" });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };

  const testCode = `HTTP_K_${Date.now().toString().slice(-5)}`;
  let termId = "";

  try {
    // 1. POST /terms - Tạo kỳ học mới
    console.log(`[1] Gửi POST /terms để tạo kỳ học mới: ${testCode}...`);
    const now = new Date();
    const startDate = new Date(now.getTime() + 5 * 24 * 3600 * 1000).toISOString();
    const endDate = new Date(now.getTime() + 45 * 24 * 3600 * 1000).toISOString();
    const regStartDate = new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString();
    const regEndDate = new Date(now.getTime() + 4 * 24 * 3600 * 1000).toISOString();

    const createRes = await fetch(`${BASE_URL}/terms`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: testCode,
        name: `Kỳ Kiểm Thử HTTP ${testCode}`,
        startDate,
        endDate,
        registrationStartDate: regStartDate,
        registrationEndDate: regEndDate,
        status: "PLANNING",
        description: "Kiểm thử tạo và mở kỳ học qua HTTP API",
      }),
    });

    const createJson = await createRes.json() as any;
    assert.equal(createRes.status, 201, `POST /terms thất bại: ${JSON.stringify(createJson)}`);
    termId = createJson.data.id;
    console.log(`   ✓ POST /terms thành công (201 Created), ID: ${termId}`);

    // 2. PATCH /terms/:id - Mở kỳ học (chuyển sang OPEN_REGISTRATION)
    console.log("\n[2] Gửi PATCH /terms/:id để MỞ ĐĂNG KÝ kỳ học...");
    const patchRes = await fetch(`${BASE_URL}/terms/${termId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "OPEN_REGISTRATION",
      }),
    });
    const patchJson = await patchRes.json() as any;
    assert.equal(patchRes.status, 200, `PATCH /terms/:id thất bại: ${JSON.stringify(patchJson)}`);
    assert.equal(patchJson.data.status, "OPEN_REGISTRATION");
    console.log(`   ✓ PATCH /terms/${termId} thành công (200 OK), Trạng thái mới: ${patchJson.data.status}`);

    // 3. GET /terms/current - Lấy kỳ học đang mở
    console.log("\n[3] Gửi GET /terms/current để xác nhận kỳ học đang mở...");
    const currentRes = await fetch(`${BASE_URL}/terms/current`, {
      method: "GET",
      headers,
    });
    const currentJson = await currentRes.json() as any;
    assert.equal(currentRes.status, 200);
    assert.ok(currentJson.data, "Phải có dữ liệu current term");
    console.log(`   ✓ GET /terms/current thành công, Kỳ hiện tại: ${currentJson.data.name} (${currentJson.data.status})`);

    // 4. GET /terms - Danh sách kỳ học
    console.log("\n[4] Gửi GET /terms?status=OPEN_REGISTRATION...");
    const listRes = await fetch(`${BASE_URL}/terms?status=OPEN_REGISTRATION`, {
      method: "GET",
      headers,
    });
    const listJson = await listRes.json() as any;
    assert.equal(listRes.status, 200);
    const termList = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.terms ?? []);
    const found = termList.some((t: any) => t.id === termId);
    assert.ok(found, "Kỳ học vừa mở phải xuất hiện trong danh sách OPEN_REGISTRATION");
    console.log(`   ✓ GET /terms tìm thấy kỳ học vừa mở trong danh sách (${termList.length} kỳ đang mở)`);

    // 5. DELETE /terms/:id - Dọn dẹp
    console.log("\n[5] Gửi DELETE /terms/:id để dọn dẹp...");
    const delRes = await fetch(`${BASE_URL}/terms/${termId}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(delRes.status, 200);
    console.log("   ✓ DELETE /terms/:id hoàn tất, dọn dẹp xong.");

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  🎉 HTTP REST API TEST MỞ KỲ HỌC HOÀN TOÀN THÀNH CÔNG!");
    console.log("═══════════════════════════════════════════════════════════\n");
  } catch (err) {
    if (termId) {
      await fetch(`${BASE_URL}/terms/${termId}`, { method: "DELETE", headers }).catch(() => {});
    }
    throw err;
  } finally {
    process.exit(0);
  }
}

runHttpTest().catch((err) => {
  console.error("❌ Lỗi HTTP test:", err);
  process.exit(1);
});
