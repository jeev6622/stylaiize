import { Router } from "express";
import { chatRateLimiter } from "../middleware/rate-limit";
import { validate } from "../middleware/validate.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  listConversationsController,
  createConversationController,
  getConversationController,
  deleteConversationController,
  sendMessageController,
} from "../controllers/chat.controller";
import { sendMessageSchema } from "../validators/chat.schema";

const router = Router();

router.use(chatRateLimiter);

router.get("/conversations", requireAuth, listConversationsController);
router.post("/conversations", requireAuth, createConversationController);
router.get("/conversations/:id", requireAuth, getConversationController);
router.delete("/conversations/:id", requireAuth, deleteConversationController);

router.post("/", requireAuth, validate(sendMessageSchema), sendMessageController);

export default router;
