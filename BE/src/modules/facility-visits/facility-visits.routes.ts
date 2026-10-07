import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import {
  CheckInSchema,
  ReceptionCheckInSchema,
  VisitQuerySchema,
} from "./facility-visits.schema.js";
import * as controller from "./facility-visits.controller.js";

const router = Router();

router.post(
  "/check-in",
  authenticate,
  authorize("MEMBER"),
  validate(CheckInSchema),
  controller.selfCheckIn,
);

router.post(
  "/reception-check-in",
  authenticate,
  authorize("MANAGER", "RECEPTIONIST"),
  validate(ReceptionCheckInSchema),
  controller.receptionCheckIn,
);

router.get(
  "/my",
  authenticate,
  authorize("MEMBER"),
  validate(VisitQuerySchema, "query"),
  controller.getMyVisitHistory,
);

router.get(
  "/",
  authenticate,
  authorize("MANAGER", "RECEPTIONIST"),
  validate(VisitQuerySchema, "query"),
  controller.listFacilityVisits,
);

export default router;
