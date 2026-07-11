import { describe, it, expect } from 'vitest'
import { APIError, ValidationError, AuthenticationError, NotFoundError } from '../../packages/core/src/errors.js'

describe('APIError', () => {
  it('creates error with statusCode and message', () => {
    const err = new APIError(418, 'I am a teapot')
    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(418)
    expect(err.message).toBe('I am a teapot')
    expect(err.name).toBe('APIError')
  })

  it('creates error with code and details', () => {
    const err = new APIError(400, 'Bad request', 'BAD_REQUEST', [{ field: 'name', message: 'Name is required' }])
    expect(err.code).toBe('BAD_REQUEST')
    expect(err.details).toHaveLength(1)
    expect(err.details![0]).toEqual({ field: 'name', message: 'Name is required' })
  })

  it('toJSON returns correct format', () => {
    const err = new APIError(404, 'Not found', 'NOT_FOUND')
    const json = err.toJSON()
    expect(json).toEqual({
      error: {
        statusCode: 404,
        message: 'Not found',
        code: 'NOT_FOUND',
        details: undefined,
      },
    })
  })

  it('toJSON includes details when present', () => {
    const err = new APIError(422, 'Invalid', 'VALIDATION_ERROR', [{ field: 'email', message: 'Invalid email', code: 'invalid_string' }])
    const json = err.toJSON()
    expect(json.error.details).toHaveLength(1)
    expect(json.error.details[0].field).toBe('email')
  })
})

describe('ValidationError', () => {
  it('extends APIError with default 400', () => {
    const err = new ValidationError()
    expect(err).toBeInstanceOf(APIError)
    expect(err).toBeInstanceOf(ValidationError)
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Validation failed')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
  })

  it('accepts custom message and details', () => {
    const details = [{ field: 'age', message: 'Must be 18+', code: 'too_small' }]
    const err = new ValidationError('Custom validation message', 'CUSTOM_CODE', details)
    expect(err.message).toBe('Custom validation message')
    expect(err.code).toBe('CUSTOM_CODE')
    expect(err.details).toEqual(details)
  })

  it('toJSON has correct structure', () => {
    const err = new ValidationError()
    const json = err.toJSON()
    expect(json.error.statusCode).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('AuthenticationError', () => {
  it('extends APIError with default 401', () => {
    const err = new AuthenticationError()
    expect(err).toBeInstanceOf(APIError)
    expect(err).toBeInstanceOf(AuthenticationError)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Authentication failed')
    expect(err.code).toBe('AUTHENTICATION_ERROR')
    expect(err.name).toBe('AuthenticationError')
  })

  it('accepts custom message and code', () => {
    const err = new AuthenticationError('Token expired', 'TOKEN_EXPIRED')
    expect(err.message).toBe('Token expired')
    expect(err.code).toBe('TOKEN_EXPIRED')
  })

  it('toJSON has correct structure', () => {
    const err = new AuthenticationError()
    const json = err.toJSON()
    expect(json.error.statusCode).toBe(401)
    expect(json.error.code).toBe('AUTHENTICATION_ERROR')
  })
})

describe('NotFoundError', () => {
  it('extends APIError with default 404', () => {
    const err = new NotFoundError()
    expect(err).toBeInstanceOf(APIError)
    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Resource not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
  })

  it('accepts custom message', () => {
    const err = new NotFoundError('User not found')
    expect(err.message).toBe('User not found')
  })

  it('toJSON has correct structure', () => {
    const err = new NotFoundError('Item missing', 'ITEM_MISSING')
    const json = err.toJSON()
    expect(json.error.statusCode).toBe(404)
    expect(json.error.code).toBe('ITEM_MISSING')
    expect(json.error.message).toBe('Item missing')
  })
})

describe('Error serialization includes details array', () => {
  it('ValidationError with details serializes properly', () => {
    const details = [
      { field: 'name', message: 'Required', code: 'too_small' },
      { field: 'email', message: 'Invalid email', code: 'invalid_string' },
    ]
    const err = new ValidationError('Validation failed', 'VALIDATION_ERROR', details)
    const json = err.toJSON()
    expect(json.error.details).toHaveLength(2)
    expect(json.error.details[0].field).toBe('name')
    expect(json.error.details[1].field).toBe('email')
  })
})
