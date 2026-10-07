import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { JoinWaitlistSchema, WaitlistQuerySchema } from "./waitlist.schema.js";
import * as controller from "./waitlist.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("MEMBER"),
  validate(JoinWaitlistSchema),
  controller.joinScheduleWaitlist,
);

router.delete(
  "/:id",
  authenticate,
  authorize("MEMBER"),
  controller.leaveWaitlist,
);

router.get(
  "/my",
  authenticate,
  authorize("MEMBER"),
  validate(WaitlistQuerySchema, "query"),
  controller.getMyWaitlistHistory,
);

router.get(
  "/schedule/:scheduleId",
  authenticate,
  authorize("MANAGER", "RECEPTIONIST", "COACH"),
  validate(WaitlistQuerySchema, "query"),
  controller.getScheduleWaitlist,
);

export default router;
