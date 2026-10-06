import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { checkFacilityScope } from "../../middlewares/facilityScope.js";
import * as Controller from "./facilities.controller.js";
import { CreateFacilitySchema, UpdateFacilitySchema, AssignStaffSchema } from "./facilities.schema.js";

const router = Router();

// Lấy danh sách facility (Dùng chung, scope lọc theo role)
router.get("/", authenticate, Controller.getFacilities);

// Chi tiết facility (Admin, hoặc staff của cơ sở đó)
router.get(
  "/:facilityId",
  authenticate,
  checkFacilityScope,
  Controller.getFacilityById
);

// ADMIN only
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(CreateFacilitySchema),
  Controller.createFacility
);

// Sửa facility
router.put(
  "/:facilityId",
  authenticate,
  authorize("ADMIN"),
  checkFacilityScope,
  validate(UpdateFacilitySchema),
  Controller.updateFacility
);

// Phân công staff (Admin có thể phân công cho mọi cơ sở, Manager phân công cho cơ sở của mình)
router.post(
  "/:facilityId/staff",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  checkFacilityScope, // Nếu là Manager, phải thuộc cơ sở này mới được phân công
  validate(AssignStaffSchema),
  Controller.assignStaff
);

// Xóa phân công staff
router.delete(
  "/:facilityId/staff/:userId/:role",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  checkFacilityScope,
  Controller.removeStaff
);

export default router;
