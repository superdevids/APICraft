import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RateLimiterMiddleware, RateLimitError } from '../../packages/middleware/rate-limiter/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function makeContext(ip = '127.0.0.1'): RequestContext {
  return {
    request: {
      method: 'GET',
      path: '/',
      params: {},
      query: {},
      headers: {},
      body: null,
      ip,
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

describe('RateLimiterMiddleware', () => {
  let mw: RateLimiterMiddleware

  beforeEach(() => {
    mw = new RateLimiterMiddleware({ window: 60000, max: 3 })
  })

  afterEach(() => {
    mw.dispose()
  })

  it('allows requests under limit', async () => {
    const ctx1 = makeContext()
    await expect(mw.before(ctx1)).resolves.toBeUndefined()

    const ctx2 = makeContext()
    await expect(mw.before(ctx2)).resolves.toBeUndefined()
  })

  it('sets rate limit headers', async () => {
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['X-RateLimit-Limit']).toBe('3')
    expect(ctx.response.headers['X-RateLimit-Remaining']).toBe('2')
    expect(ctx.response.headers['X-RateLimit-Reset']).toBeDefined()
  })

  it('blocks requests over limit with 429', async () => {
    for (let i = 0; i < 3; i++) {
      const ctx = makeContext()
      await mw.before(ctx)
    }

    const ctxOver = makeContext()
    await expect(mw.before(ctxOver)).rejects.toThrow(RateLimitError)
  })

  it('sets Retry-After header', async () => {
    for (let i = 0; i < 3; i++) {
      const ctx = makeContext()
      await mw.before(ctx)
    }

    const ctxOver = makeContext()
    try {
      await mw.before(ctxOver)
    } catch (e) {
      const err = e as RateLimitError
      expect(err.statusCode).toBe(429)
    }
    expect(ctxOver.response.headers['Retry-After']).toBeDefined()
  })

  it('window resets correctly', async () => {
    const mwShort = new RateLimiterMiddleware({ window: 50, max: 1 })
    const ctx1 = makeContext()
    await mwShort.before(ctx1)

    const ctx2 = makeContext()
    await expect(mwShort.before(ctx2)).rejects.toThrow(RateLimitError)

    await new Promise((r) => setTimeout(r, 60))

    const ctx3 = makeContext()
    await expect(mwShort.before(ctx3)).resolves.toBeUndefined()
    mwShort.dispose()
  })

  it('key generator works per-IP', async () => {
    const ctx1 = makeContext('192.168.1.1')
    const ctx2 = makeContext('192.168.1.2')
    const ctx3 = makeContext('192.168.1.1')

    await mw.before(ctx1)
    await mw.before(ctx2)
    await mw.before(ctx3)

    expect(ctx1.response.headers['X-RateLimit-Remaining']).toBe('2')
    expect(ctx3.response.headers['X-RateLimit-Remaining']).toBe('1')
  })

  it('custom key generator', async () => {
    const mwCustom = new RateLimiterMiddleware({
      window: 60000, max: 1,
      keyGenerator: (ctx) => ctx.request.headers['x-api-key'] as string || ctx.request.ip,
    })
    const ctx = makeContext()
    ctx.request.headers['x-api-key'] = 'my-key'
    await mwCustom.before(ctx)
    await expect(mwCustom.before(ctx)).rejects.toThrow(RateLimitError)
    mwCustom.dispose()
  })
})
