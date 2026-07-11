import { z } from "zod";
import type { ParameterDefinition, TypeSchema } from "../types/index.js";
import { createValidationError } from "./errors.js";
import { coerceType as coerceTypeFn } from "./type-coercion.js";
import { buildZodSchema } from "./schema-builder.js";

export type CoercionTargetType = "string" | "number" | "boolean" | "date";

export class ValidationEngine {
  static validate<T>(schema: z.ZodType<T>, value: unknown, fieldName: string): T {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw createValidationError(result.error);
    }
    return result.data;
  }

  static validateQueryParams(
    schemas: Record<string, { schema?: z.ZodTypeAny; default?: unknown }>,
    query: Record<string, string | string[]>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, config] of Object.entries(schemas)) {
      const raw = query[key];
      const value = raw !== undefined ? raw : config.default;

      if (value === undefined) {
        if (config.schema) {
          const parsed = config.schema.safeParse(undefined);
          if (!parsed.success) {
            throw createValidationError(parsed.error);
          }
          result[key] = parsed.data;
        }
        continue;
      }

      if (config.schema) {
        const parsed = config.schema.safeParse(value);
        if (!parsed.success) {
          throw createValidationError(parsed.error);
        }
        result[key] = parsed.data;
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  static validatePathParam(name: string, value: string, schema?: z.ZodTypeAny): unknown {
    if (!schema) return value;
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const error = createValidationError(parsed.error);
      error.message = `Path parameter "${name}" validation failed`;
      throw error;
    }
    return parsed.data;
  }

  static validateBody<T>(schema: z.ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw createValidationError(result.error);
    }
    return result.data;
  }

  static coerceType(value: string, targetType: CoercionTargetType): unknown {
    return coerceTypeFn(value, targetType);
  }

  static buildSchemaFromType(typeSchema: TypeSchema): z.ZodTypeAny {
    return buildZodSchema(typeSchema);
  }
}
