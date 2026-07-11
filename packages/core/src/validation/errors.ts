import type { z } from "zod";
import { ValidationError } from "../errors.js";

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export function formatZodError(error: z.ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "_root",
    message: issue.message,
    code: issue.code,
  }));
}

export function createValidationError(zodError: z.ZodError): ValidationError {
  const details = formatZodError(zodError);
  return new ValidationError("Validation failed", "VALIDATION_ERROR", details);
}
