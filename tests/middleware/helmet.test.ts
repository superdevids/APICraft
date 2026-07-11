import { describe, it, expect, vi } from 'vitest'
import { HelmetMiddleware } from '../../packages/middleware/helmet/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function makeContext(): RequestContext {
  return {
    request: {
      method: 'GET',
      path: '/',
      params: {},
      query: {},
      headers: {},
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

describe('HelmetMiddleware', () => {
  it('sets Content-Security-Policy by default', async () => {
    const mw = new HelmetMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['Content-Security-Policy']).toBeDefined()
    expect(ctx.response.headers['Content-Security-Policy']).toContain("default-src 'self'")
  })

  it('sets X-Frame-Options to DENY by default', async () => {
    const mw = new HelmetMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['X-Frame-Options']).toBe('DENY')
  })

  it('sets X-Content-Type-Options to nosniff', async () => {
    const mw = new HelmetMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('sets X-XSS-Protection', async () => {
    const mw = new HelmetMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['X-XSS-Protection']).toBeDefined()
  })

  it('sets Strict-Transport-Security', async () => {
    const mw = new HelmetMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['Strict-Transport-Security']).toContain('max-age=31536000')
  })

  it('sets Referrer-Policy', async () => {
    const mw = new HelmetMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['Referrer-Policy']).toBeDefined()
  })

  it('allows CSP customization', async () => {
    const mw = new HelmetMiddleware({
      contentSecurityPolicy: {
        'default-src': ["'self'", 'https://cdn.example.com'],
        'script-src': ["'self'", "'unsafe-inline'"],
      },
    })
    const ctx = makeContext()
    await mw.before(ctx)
    const csp = ctx.response.headers['Content-Security-Policy']
    expect(csp).toContain('cdn.example.com')
    expect(csp).toContain("'unsafe-inline'")
  })

  it('disables CSP when set to false', async () => {
    const mw = new HelmetMiddleware({ contentSecurityPolicy: false })
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['Content-Security-Policy']).toBeUndefined()
  })

  it('supports custom X-Frame-Options', async () => {
    const mw = new HelmetMiddleware({ xFrameOptions: 'SAMEORIGIN' })
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.response.headers['X-Frame-Options']).toBe('SAMEORIGIN')
  })
})
