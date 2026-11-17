import { z } from "zod";
import { env } from "@/config/env";

const imagePartSchema = z.object({
  mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
  data: z
    .string()
    .min(1, "Image data is required.")
    .max(
      env.AI_MAX_IMAGE_CHARS,
      "Image is too large. Please upload a smaller image.",
    ),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, "Conversation id cannot be empty.").nullish(),
  content: z.string().trim().min(1, "Message cannot be empty.").max(4000, "Message is too long."),
  images: z.array(imagePartSchema).max(4, "Maximum 4 images per message.").optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
