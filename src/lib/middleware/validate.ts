import { type ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors/index";

/**
 * Parse and validate a request body against a Zod schema.
 *
 * @throws ValidationError if the body fails validation.
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Validation failed", error.issues);
    }
    throw error;
  }
}

/**
 * Parse and validate URL query parameters against a Zod schema.
 *
 * Converts URLSearchParams to a plain object before parsing.
 * Supports coercion (e.g., z.coerce.number()) for query string values.
 *
 * @throws ValidationError if the params fail validation.
 */
export function validateQuery<T>(
  schema: ZodSchema<T>,
  params: URLSearchParams
): T {
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }

  try {
    return schema.parse(obj);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Invalid query parameters", error.issues);
    }
    throw error;
  }
}
