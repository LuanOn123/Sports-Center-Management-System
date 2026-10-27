import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { chatWithAssistant } from "../src/modules/ai/ai.service.js";

test("AI Assistant queries DB and answers course inquiries accurately", async (t) => {
  if (!process.env.GROQ_API_KEY) {
    t.skip("GROQ_API_KEY is not defined, skipping AI test");
    return;
  }

  await t.test("should answer how many courses are available using DB data", async () => {
    const res = await chatWithAssistant({
      message: "Trung tâm có bao nhiêu khóa học và gồm những lớp nào?",
    });

    assert.ok(typeof res === "string" && res.length > 20, "Response should be a non-empty string");
    // Ensure it no longer gives the fallback generic missing-data message
    assert.strictEqual(
      res.includes("chưa có dữ liệu chi tiết về danh sách các lớp học"),
      false,
      "Should not claim lack of course data"
    );
    console.log("[AI Reply for Courses]:\n", res);
  });

  await t.test("should answer membership plans inquiry using DB data", async () => {
    const res = await chatWithAssistant({
      message: "Giá các gói tập thế nào?",
    });

    assert.ok(typeof res === "string" && res.length > 20, "Response should be a non-empty string");
    console.log("[AI Reply for Plans]:\n", res);
  });
});
