import type { CoercionTargetType } from "./index.js";

export const typeCoercers: Record<string, (value: string) => unknown> = {
  string: (v: string): string => v,
  number: (v: string): number => {
    const n = Number(v);
    if (isNaN(n)) throw new Error(`Cannot coerce "${v}" to number`);
    return n;
  },
  boolean: (v: string): boolean => {
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    throw new Error(`Cannot coerce "${v}" to boolean`);
  },
  date: (v: string): Date => {
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new Error(`Cannot coerce "${v}" to date`);
    return d;
  },
};

export function coerceType(value: string, targetType: CoercionTargetType): unknown {
  const coercer = typeCoercers[targetType];
  if (!coercer) throw new Error(`Unknown target type "${targetType}" for coercion`);
  return coercer(value);
}
