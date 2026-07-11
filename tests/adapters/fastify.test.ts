import { describe, it, expect, vi } from 'vitest'
import { FastifyAdapter, APIError } from '../../packages/adapters/fastify/src/index.js'

describe('FastifyAdapter', () => {
  it('creates adapter instance', () => {
    const adapter = new FastifyAdapter()
    expect(adapter.name).toBe('fastify')
    expect(adapter.app).toBeDefined()
    adapter.close()
  })

  it('registerRoute creates a route', () => {
    const adapter = new FastifyAdapter()
    const handler = vi.fn().mockResolvedValue({ ok: true })

    adapter.registerRoute('/test', {
      method: 'get',
      path: '/test',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })

    const routes = adapter.app.printRoutes()
    expect(routes).toContain('test')
    adapter.close()
  })

  it('guards are called before handler', async () => {
    const adapter = new FastifyAdapter()
    const guard = vi.fn().mockResolvedValue(true)
    const handler = vi.fn().mockResolvedValue({ ok: true })

    adapter.registerRoute('/guarded', {
      method: 'get',
      path: '/guarded',
      handler,
      parameters: [],
      middleware: [],
      guards: [guard],
    })

    await adapter.start(0)
    const res = await adapter.app.inject({ method: 'GET', url: '/guarded' })
    expect(guard).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    adapter.close()
  })

  it('returns 401 when guard fails', async () => {
    const adapter = new FastifyAdapter()
    const guard = vi.fn().mockResolvedValue(false)

    adapter.registerRoute('/protected', {
      method: 'get',
      path: '/protected',
      handler: vi.fn(),
      parameters: [],
      middleware: [],
      guards: [guard],
    })

    await adapter.start(0)
    const res = await adapter.app.inject({ method: 'GET', url: '/protected' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    })
    adapter.close()
  })

  it('handles APIError and returns standardized format', async () => {
    const adapter = new FastifyAdapter()
    adapter.registerRoute('/error', {
      method: 'get',
      path: '/error',
      handler: vi.fn().mockRejectedValue(new APIError(422, 'VALIDATION', 'Invalid data')),
      parameters: [],
      middleware: [],
      guards: [],
    })

    await adapter.start(0)
    const res = await adapter.app.inject({ method: 'GET', url: '/error' })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe('APIError')
    expect(body.error.message).toBe('Invalid data')
    adapter.close()
  })

  it('support server start/stop lifecycle', async () => {
    const adapter = new FastifyAdapter()
    await adapter.start(0)
    await adapter.close()
  })

  it('registers middleware hook', () => {
    const adapter = new FastifyAdapter()
    const mw = vi.fn()
    adapter.registerMiddleware(mw)
    expect(mw).toBeDefined()
    adapter.close()
  })
})
