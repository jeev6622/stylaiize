/**
 * HTTP-layer re-export. The schema itself lives in the application layer because
 * both request validation and AI-output parsing use the same vocabulary.
 */
export {
  styleProfileSchema,
  type StyleProfileInput,
} from "@/application/validators/style-profile.schema";
