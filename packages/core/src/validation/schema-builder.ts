import { z } from "zod";
import type { TypeSchema } from "../types/index.js";

export function buildZodSchema(typeSchema: TypeSchema): z.ZodTypeAny {
  switch (typeSchema.kind) {
    case "string": {
      let s = z.string();
      if (typeSchema.zodInfo?.min !== undefined) s = s.min(typeSchema.zodInfo.min);
      if (typeSchema.zodInfo?.max !== undefined) s = s.max(typeSchema.zodInfo.max);
      if (typeSchema.zodInfo?.email) s = s.email();
      if (typeSchema.zodInfo?.uuid) s = s.uuid();
      if (typeSchema.zodInfo?.pattern) s = s.regex(new RegExp(typeSchema.zodInfo.pattern));
      if (typeSchema.format === "date-time") s = s.datetime({ offset: true }) as any;
      return s;
    }
    case "number": {
      let n = z.number();
      if (typeSchema.zodInfo?.min !== undefined) n = n.min(typeSchema.zodInfo.min);
      if (typeSchema.zodInfo?.max !== undefined) n = n.max(typeSchema.zodInfo.max);
      return n;
    }
    case "boolean":
      return z.boolean();
    case "enum": {
      if (!typeSchema.enum || typeSchema.enum.length === 0) return z.string();
      return z.enum(typeSchema.enum as [string, ...string[]]);
    }
    case "array": {
      if (!typeSchema.items) return z.array(z.any());
      return z.array(buildZodSchema(typeSchema.items));
    }
    case "object": {
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, prop] of Object.entries(typeSchema.properties || {})) {
        shape[key] = buildZodSchema(prop);
      }
      const obj = z.object(shape);
      if (typeSchema.required && typeSchema.required.length > 0) {
        return obj;
      }
      return obj.partial();
    }
    case "union": {
      if (!typeSchema.members || typeSchema.members.length === 0) return z.any();
      if (typeSchema.members.length === 1) return buildZodSchema(typeSchema.members[0]);
      const [first, second, ...rest] = typeSchema.members.map((m) => buildZodSchema(m));
      return z.union([first, second, ...rest]);
    }
    case "reference":
    default:
      return z.any();
  }
}
