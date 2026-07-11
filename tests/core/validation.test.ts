import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ValidationEngine } from '../../packages/core/src/validation/index.js'
import { formatZodError, createValidationError } from '../../packages/core/src/validation/errors.js'
import { buildZodSchema } from '../../packages/core/src/validation/schema-builder.js'
import { CommonSchemas, createDTO } from '../../packages/core/src/validation/validators.js'
import { ValidationError } from '../../packages/core/src/errors.js'
import type { TypeSchema } from '../../packages/core/src/types/index.js'

describe('ValidationEngine.validate', () => {
  it('validates data against a Zod schema', () => {
    const schema = z.object({ name: z.string() })
    const result = ValidationEngine.validate(schema, { name: 'Alice' }, 'test')
    expect(result).toEqual({ name: 'Alice' })
  })

  it('throws ValidationError for invalid data', () => {
    const schema = z.object({ name: z.string() })
    expect(() => ValidationEngine.validate(schema, { name: 123 }, 'test')).toThrow(ValidationError)
  })
})

describe('ValidationEngine.coerceType', () => {
  it('coerces string to number', () => {
    const result = ValidationEngine.coerceType('42', 'number')
    expect(result).toBe(42)
  })

  it('coerces string to boolean true', () => {
    expect(ValidationEngine.coerceType('true', 'boolean')).toBe(true)
    expect(ValidationEngine.coerceType('1', 'boolean')).toBe(true)
  })

  it('coerces string to boolean false', () => {
    expect(ValidationEngine.coerceType('false', 'boolean')).toBe(false)
    expect(ValidationEngine.coerceType('0', 'boolean')).toBe(false)
  })

  it('coerces string to date', () => {
    const result = ValidationEngine.coerceType('2024-01-15', 'date')
    expect(result).toBeInstanceOf(Date)
    expect((result as Date).getFullYear()).toBe(2024)
  })

  it('throws on invalid number coercion', () => {
    expect(() => ValidationEngine.coerceType('abc', 'number')).toThrow()
  })

  it('throws on invalid boolean coercion', () => {
    expect(() => ValidationEngine.coerceType('maybe', 'boolean')).toThrow()
  })

  it('throws on invalid date coercion', () => {
    expect(() => ValidationEngine.coerceType('not-a-date', 'date')).toThrow()
  })
})

describe('ValidationEngine.validateQueryParams', () => {
  it('validates query params with defaults', () => {
    const schemas = {
      page: { schema: z.coerce.number().int().positive(), default: 1 },
      limit: { schema: z.coerce.number().int().min(1).max(100), default: 10 },
    }
    const result = ValidationEngine.validateQueryParams(schemas, {})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(10)
  })

  it('coerces query param values', () => {
    const schemas = {
      page: { schema: z.coerce.number().int().positive() },
    }
    const result = ValidationEngine.validateQueryParams(schemas, { page: '3' })
    expect(result.page).toBe(3)
  })

  it('throws on invalid query params', () => {
    const schemas = {
      page: { schema: z.coerce.number().int().positive() },
    }
    expect(() => ValidationEngine.validateQueryParams(schemas, { page: '-1' })).toThrow(ValidationError)
  })
})

describe('ValidationEngine.validateBody', () => {
  it('validates body against a DTO schema', () => {
    const schema = z.object({ email: z.string().email() })
    const result = ValidationEngine.validateBody(schema, { email: 'test@example.com' })
    expect(result.email).toBe('test@example.com')
  })

  it('throws on invalid body', () => {
    const schema = z.object({ email: z.string().email() })
    expect(() => ValidationEngine.validateBody(schema, { email: 'invalid' })).toThrow(ValidationError)
  })
})

describe('formatZodError', () => {
  it('maps Zod errors to standard format', () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().min(0) })
    const result = schema.safeParse({ name: '', age: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const formatted = formatZodError(result.error)
      expect(formatted.length).toBeGreaterThanOrEqual(2)
      expect(formatted[0]).toHaveProperty('field')
      expect(formatted[0]).toHaveProperty('message')
      expect(formatted[0]).toHaveProperty('code')
    }
  })
})

describe('createValidationError', () => {
  it('creates ValidationError from ZodError', () => {
    const schema = z.object({ name: z.string() })
    const result = schema.safeParse({ name: 123 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const err = createValidationError(result.error)
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.statusCode).toBe(400)
      expect(err.details).toBeDefined()
      expect(err.details!.length).toBeGreaterThan(0)
    }
  })
})

describe('buildZodSchema', () => {
  it('builds string schema', () => {
    const ts: TypeSchema = { kind: 'string', name: 'string' }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse('hello').success).toBe(true)
    expect(schema.safeParse(123).success).toBe(false)
  })

  it('builds number schema', () => {
    const ts: TypeSchema = { kind: 'number', name: 'number' }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse(42).success).toBe(true)
    expect(schema.safeParse('abc').success).toBe(false)
  })

  it('builds boolean schema', () => {
    const ts: TypeSchema = { kind: 'boolean', name: 'boolean' }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse(true).success).toBe(true)
  })

  it('builds enum schema', () => {
    const ts: TypeSchema = { kind: 'enum', name: 'status', enum: ['active', 'inactive'] }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse('active').success).toBe(true)
    expect(schema.safeParse('unknown').success).toBe(false)
  })

  it('builds array schema', () => {
    const ts: TypeSchema = { kind: 'array', name: 'array', items: { kind: 'string', name: 'string' } }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse(['a', 'b']).success).toBe(true)
    expect(schema.safeParse('not-array').success).toBe(false)
  })

  it('builds object schema', () => {
    const ts: TypeSchema = {
      kind: 'object',
      name: 'User',
      properties: { name: { kind: 'string', name: 'string' } },
      required: ['name'],
    }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(false)
  })

  it('builds union schema', () => {
    const ts: TypeSchema = {
      kind: 'union',
      name: 'union',
      members: [{ kind: 'string', name: 'string' }, { kind: 'number', name: 'number' }],
    }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse('hello').success).toBe(true)
    expect(schema.safeParse(42).success).toBe(true)
  })

  it('handles string with constraints', () => {
    const ts: TypeSchema = { kind: 'string', name: 'string', zodInfo: { min: 3, max: 10, pattern: '^[a-z]+$' } }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse('abc').success).toBe(true)
    expect(schema.safeParse('ab').success).toBe(false)
    expect(schema.safeParse('ABCD').success).toBe(false)
  })
})

describe('CommonSchemas', () => {
  it('uuid validates correctly', () => {
    expect(CommonSchemas.uuid.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
    expect(CommonSchemas.uuid.safeParse('not-a-uuid').success).toBe(false)
  })

  it('email validates correctly', () => {
    expect(CommonSchemas.email.safeParse('test@example.com').success).toBe(true)
    expect(CommonSchemas.email.safeParse('invalid').success).toBe(false)
  })

  it('url validates correctly', () => {
    expect(CommonSchemas.url.safeParse('https://example.com').success).toBe(true)
    expect(CommonSchemas.url.safeParse('not-a-url').success).toBe(false)
  })

  it('isoDate validates correctly', () => {
    expect(CommonSchemas.isoDate.safeParse('2024-01-15').success).toBe(true)
    expect(CommonSchemas.isoDate.safeParse('2024-01-15T12:00:00Z').success).toBe(true)
  })

  it('password validates min length', () => {
    expect(CommonSchemas.password.safeParse('short').success).toBe(false)
    expect(CommonSchemas.password.safeParse('longenoughpassword').success).toBe(true)
  })

  it('pagination schema has defaults', () => {
    const pageResult = CommonSchemas.pagination.page.safeParse(undefined)
    expect(pageResult.success).toBe(true)
    if (pageResult.success) expect(pageResult.data).toBe(1)

    const limitResult = CommonSchemas.pagination.limit.safeParse(undefined)
    expect(limitResult.success).toBe(true)
    if (limitResult.success) expect(limitResult.data).toBe(10)
  })
})

describe('createDTO', () => {
  it('creates a Zod object from a shape', () => {
    const UserDTO = createDTO({
      name: z.string(),
      email: z.string().email(),
    })
    expect(UserDTO.safeParse({ name: 'Alice', email: 'alice@test.com' }).success).toBe(true)
    expect(UserDTO.safeParse({ name: 'Alice' }).success).toBe(false)
  })
})
