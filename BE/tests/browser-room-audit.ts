import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { prisma } from "../src/config/prisma.js";
import { connectTestMongo, createIdentity, deleteIdentities } from "./helpers/identity.js";
import { hashPassword } from "../src/utils/bcrypt.js";

async function main() {
  assert.match(new URL(process.env.DATABASE_URL!).searchParams.get("schema") || "", /^scms_verify_/);
  assert.match(new URL(process.env.MONGO_URI!).pathname, /^\/scms_verify_/);
  const apiUrl = process.env.AUDIT_API_URL || "http://127.0.0.1:8093/api/v1";
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname));
  assert.equal((await fetch(apiUrl + "/health")).status, 200);
  await connectTestMongo();
  const require = createRequire(fileURLToPath(new URL("../../FE/package.json", import.meta.url)));
  const { chromium, expect } = require("@playwright/test");
  const run = randomUUID();
  let userId = "", facilityId = "";
  const browser = await chromium.launch({ headless: true });
  try {
    // Only fixture setup uses direct DB writes. All room mutations go through UI and real HTTP.
    const password = "Audit-Integration!2026";
    const user = await createIdentity({ email: `${run}-room@test.invalid`, fullName: "Audit Room Manager", password: await hashPassword(password), role: "MANAGER" });
    userId = user.id;
    const facility = await prisma.facility.create({ data: { code: `ROOM-${run}`, name: "Browser CRUD audit", address: "Isolated test fixture" } });
    facilityId = facility.id;
    await prisma.facilityStaff.create({ data: { facilityId, userId, role: "MANAGER" } });
    const page = await browser.newPage({ baseURL: process.env.AUDIT_FE_URL || "http://127.0.0.1:5176" });
    page.setDefaultTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    page.on("response", (r: any) => { if (r.url().startsWith(apiUrl) && r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/manager\/dashboard$/, { timeout: 60000 });
    await page.goto("/manager/rooms");
    await expect(page.getByRole("combobox", { name: "Cơ sở đang làm việc" })).toHaveValue(facilityId, { timeout: 60000 });
    await page.getByRole("button", { name: "Thêm phòng tập", exact: true }).click();
    const name = `Browser room ${run}`;
    await page.getByRole("dialog").getByLabel(/^Tên/).fill(name);
    await page.getByRole("dialog").getByLabel("Sức chứa").fill("12");
    await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
    await expect(page.locator("main")).toContainText(name, { timeout: 60000 });
    const room = await prisma.room.findFirstOrThrow({ where: { facilityId, name } });
    assert.equal(room.capacity, 12);
    console.log("PASS real UI: manager login -> create room -> list -> PostgreSQL");
    await page.getByRole("button", { name: "Xem chi tiết", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toContainText(name, { timeout: 60000 });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).first().click();
    await page.getByRole("dialog").getByLabel("Sức chứa").fill("15");
    await page.getByRole("dialog").getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
    assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).capacity, 15);
    await page.reload();
    await expect(page.locator("main")).toContainText(name, { timeout: 60000 });
    console.log("PASS real UI: detail -> update capacity -> reload -> persisted PostgreSQL value");
    await page.getByRole("button", { name: "Ngừng hoạt động", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60000 });
    assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: room.id } })).isActive, false);
    await page.waitForLoadState("networkidle");
    assert.deepEqual(errors, []);
    console.log("PASS real UI: deactivate -> PostgreSQL inactive; no console/API failures or interceptions");
  } finally {
    await browser.close();
    await prisma.room.deleteMany({ where: { facilityId } });
    await prisma.auditLog.deleteMany({ where: { facilityId } });
    await prisma.facilityStaff.deleteMany({ where: { facilityId } });
    if (facilityId) await prisma.facility.delete({ where: { id: facilityId } });
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
      const { RefreshToken } = await import("../src/models/RefreshToken.js");
      await RefreshToken.deleteMany({ userId });
      await deleteIdentities([userId]);
    }
    await prisma.$disconnect();
    await mongoose.disconnect();
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
