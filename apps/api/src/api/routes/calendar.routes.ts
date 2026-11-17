import { Router } from "express";
import { apiRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createCalendarEventSchema,
  updateCalendarEventSchema,
} from "../validators/calendar.schema";
import {
  createCalendarEventController,
  listCalendarEventsController,
  getCalendarEventController,
  updateCalendarEventController,
  deleteCalendarEventController,
} from "../controllers/calendar.controller";

const router = Router();

router.use(apiRateLimiter);

router.get("/", requireAuth, listCalendarEventsController);
router.post("/", requireAuth, validate(createCalendarEventSchema), createCalendarEventController);
router.get("/:id", requireAuth, getCalendarEventController);
router.patch("/:id", requireAuth, validate(updateCalendarEventSchema), updateCalendarEventController);
router.delete("/:id", requireAuth, deleteCalendarEventController);

export default router;
