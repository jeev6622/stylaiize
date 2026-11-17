import { asyncHandler } from "@/utils/async-handler";
import { z } from "zod";

/**
 * Validates request inputs against a Zod schema.
 * Parsed (typed) values are written back onto req.body/query/params.
 */
export function validate(
  schema: z.ZodTypeAny,
  source: "body" | "query" | "params" = "body",
) {
  return asyncHandler(async (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw result.error;
    }
    req[source] = result.data;
    next();
  });
}
