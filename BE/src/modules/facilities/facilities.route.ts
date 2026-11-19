import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { checkFacilityScope } from "../../middlewares/facilityScope.js";
import * as Controller from "./facilities.controller.js";
import { CreateFacilitySchema, UpdateFacilitySchema, AssignStaffSchema, AssignManagerSchema, CreateFacilityCoachSchema, CreateFacilityReceptionistSchema } from "./facilities.schema.js";

const router = Router();
// Public reads remain available; administrative filters and scoped listings require a verified identity.
router.use((req, res, next) => {
  if (req.method === "GET" && req.headers.authorization) return authenticate(req, res, next);
  next();
});

router.put("/:facilityId/manager", authenticate, authorize("ADMIN"), checkFacilityScope, validate(AssignManagerSchema), Controller.setFacilityManager);

// Manager / Admin tạo Coach kèm bộ môn tại cơ sở
router.post(
  "/:facilityId/coaches",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  checkFacilityScope,
  validate(CreateFacilityCoachSchema),
  Controller.createFacilityCoach
);

// Manager / Admin tạo Lễ tân tại cơ sở
router.post(
  "/:facilityId/receptionists",
  authenticate,
  authorize("ADMIN", "MANAGER"),
  checkFacilityScope,
  validate(CreateFacilityReceptionistSchema),
  Controller.createFacilityReceptionist
);

// Lấy danh sách facility (Public – active only; ADMIN thêm includeInactive=true để xem tất cả)
router.get("/", Controller.getFacilities);

// Chi tiết facility (Admin, hoặc staff của cơ sở đó)
router.get(
  "/:facilityId",
  authenticate,
  checkFacilityScope,
  Controller.getFacilityById
);

// Chi tiết giới hạn & hiện trạng sử dụng tài nguyên của cơ sở
router.get(
  "/:facilityId/limits",
  authenticate,
  checkFacilityScope,
  Controller.getFacilityLimits
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
