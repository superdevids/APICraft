import { z } from "zod";

export const CommonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/),
  password: z.string().min(8).max(128),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/),
  pagination: {
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  },
} as const;

export function createDTO<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
  return z.object(shape);
}
