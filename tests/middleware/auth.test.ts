import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { JWTAuthGuard, APIKeyAuthGuard, SessionAuthGuard } from '../../packages/middleware/auth/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function makeContext(headers: Record<string, string | string[] | undefined> = {}): RequestContext {
  return {
    request: {
      method: 'GET',
      path: '/',
      params: {},
      query: {},
      headers: headers as Record<string, string | string[] | undefined>,
      body: null,
      ip: '127.0.0.1',
    },
    response: {
      statusCode: 200,
      headers: {},
      body: null,
    },
    state: new Map(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
}

describe('JWTAuthGuard', () => {
  const secret = 'test-secret-key'

  it('valid token → authenticated', async () => {
    const token = jwt.sign({ sub: 'user123', roles: ['admin'] }, secret)
    const guard = new JWTAuthGuard({ secret })
    const ctx = makeContext({ authorization: `Bearer ${token}` })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(true)
    expect(ctx.user).toBeDefined()
    expect(ctx.user!.id).toBe('user123')
    expect(ctx.user!.roles).toContain('admin')
  })

  it('invalid token → returns false', async () => {
    const guard = new JWTAuthGuard({ secret })
    const ctx = makeContext({ authorization: 'Bearer invalid-token' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('missing token → returns false', async () => {
    const guard = new JWTAuthGuard({ secret })
    const ctx = makeContext({})
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('wrong scheme → returns false', async () => {
    const guard = new JWTAuthGuard({ secret })
    const ctx = makeContext({ authorization: 'Basic dXNlcjpwYXNz' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('onFailure sets 401 status', async () => {
    const guard = new JWTAuthGuard({ secret })
    const ctx = makeContext()
    await guard.onFailure(ctx)
    expect(ctx.response.statusCode).toBe(401)
  })
})

describe('APIKeyAuthGuard', () => {
  it('valid key → authenticated', async () => {
    const guard = new APIKeyAuthGuard({ keys: ['secret-key-123'] })
    const ctx = makeContext({ 'x-api-key': 'secret-key-123' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(true)
    expect(ctx.user!.id).toBe('secret-key-123')
  })

  it('invalid key → returns false', async () => {
    const guard = new APIKeyAuthGuard({ keys: ['secret-key-123'] })
    const ctx = makeContext({ 'x-api-key': 'wrong-key' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('missing key → returns false', async () => {
    const guard = new APIKeyAuthGuard({ keys: ['secret-key-123'] })
    const ctx = makeContext({})
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('supports query param key', async () => {
    const guard = new APIKeyAuthGuard({ keys: ['key-from-query'] })
    const ctx = makeContext({})
    ctx.request.query['api_key'] = 'key-from-query'
    const result = await guard.authenticate(ctx)
    expect(result).toBe(true)
  })

  it('onFailure sets 401 status', async () => {
    const guard = new APIKeyAuthGuard({ keys: ['key'] })
    const ctx = makeContext()
    await guard.onFailure(ctx)
    expect(ctx.response.statusCode).toBe(401)
  })

  it('supports key map with user data', async () => {
    const guard = new APIKeyAuthGuard({ keys: { 'org-key': { id: 'org-1', roles: ['viewer'] } } })
    const ctx = makeContext({ 'x-api-key': 'org-key' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(true)
    expect(ctx.user!.id).toBe('org-1')
    expect(ctx.user!.roles).toContain('viewer')
  })
})

describe('SessionAuthGuard', () => {
  it('valid session → authenticated', async () => {
    const store = new Map<string, unknown>()
    store.set('sess-123', { id: 'user-1', roles: ['user'] })
    const guard = new SessionAuthGuard({ store, secret: 'secret' })
    const ctx = makeContext({ cookie: 'session=sess-123' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(true)
    expect(ctx.user!.id).toBe('user-1')
  })

  it('invalid session → returns false', async () => {
    const store = new Map<string, unknown>()
    const guard = new SessionAuthGuard({ store, secret: 'secret' })
    const ctx = makeContext({ cookie: 'session=invalid-sess' })
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('missing cookie → returns false', async () => {
    const store = new Map<string, unknown>()
    const guard = new SessionAuthGuard({ store, secret: 'secret' })
    const ctx = makeContext({})
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('onFailure sets 401 status', async () => {
    const guard = new SessionAuthGuard({ store: new Map(), secret: 'secret' })
    const ctx = makeContext()
    await guard.onFailure(ctx)
    expect(ctx.response.statusCode).toBe(401)
  })
})
