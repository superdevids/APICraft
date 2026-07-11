import { describe, it, expect, vi } from 'vitest'
import { CORSMiddleware } from '../../packages/middleware/cors/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function makeContext(method = 'GET', origin?: string): RequestContext {
  return {
    request: {
      method,
      path: '/',
      params: {},
      query: {},
      headers: { ...(origin ? { origin } : {}) } as Record<string, string | string[] | undefined>,
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

describe('CORSMiddleware', () => {
  it('sets Access-Control-Allow-Origin header', async () => {
    const mw = new CORSMiddleware()
    const ctx = makeContext('GET', 'https://example.com')
    await mw.before(ctx)
    expect(ctx.response.headers['Access-Control-Allow-Origin']).toBe('https://example.com')
  })

  it('uses wildcard when no origin', async () => {
    const mw = new CORSMiddleware()
    const ctx = makeContext('GET')
    await mw.before(ctx)
    expect(ctx.response.headers['Access-Control-Allow-Origin']).toBe('*')
  })

  it('handles OPTIONS preflight with 204', async () => {
    const mw = new CORSMiddleware()
    const ctx = makeContext('OPTIONS', 'https://example.com')
    await mw.before(ctx)
    expect(ctx.response.statusCode).toBe(204)
    expect(ctx.response.headers['Access-Control-Allow-Methods']).toBeDefined()
    expect(ctx.response.headers['Access-Control-Allow-Headers']).toBeDefined()
  })

  it('respects custom origin configuration', async () => {
    const mw = new CORSMiddleware({ origin: 'https://app.example.com' })
    const ctx = makeContext('GET', 'https://app.example.com')
    await mw.before(ctx)
    expect(ctx.response.headers['Access-Control-Allow-Origin']).toBe('https://app.example.com')
  })

  it('rejects non-matching custom origin', async () => {
    const mw = new CORSMiddleware({ origin: 'https://app.example.com' })
    const ctx = makeContext('GET', 'https://evil.com')
    await mw.before(ctx)
    expect(ctx.response.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('supports credentials', async () => {
    const mw = new CORSMiddleware({ credentials: true })
    const ctx = makeContext('GET', 'https://example.com')
    await mw.before(ctx)
    expect(ctx.response.headers['Access-Control-Allow-Credentials']).toBe('true')
  })

  it('supports array of origins', async () => {
    const mw = new CORSMiddleware({ origin: ['https://app1.com', 'https://app2.com'] })
    const ctx1 = makeContext('GET', 'https://app1.com')
    await mw.before(ctx1)
    expect(ctx1.response.headers['Access-Control-Allow-Origin']).toBe('https://app1.com')

    const ctx2 = makeContext('GET', 'https://evil.com')
    await mw.before(ctx2)
    expect(ctx2.response.headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('exposed headers are set', async () => {
    const mw = new CORSMiddleware({ exposedHeaders: ['X-Custom-Header'] })
    const ctx = makeContext('GET', 'https://example.com')
    await mw.before(ctx)
    expect(ctx.response.headers['Access-Control-Expose-Headers']).toBe('X-Custom-Header')
  })
})
