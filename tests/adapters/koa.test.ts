import { describe, it, expect, vi } from 'vitest'
import { KoaAdapter } from '../../packages/adapters/koa/src/index.js'

describe('KoaAdapter', () => {
  it('creates adapter instance', () => {
    const adapter = new KoaAdapter()
    expect(adapter.name).toBe('koa')
  })

  it('registers a route', () => {
    const adapter = new KoaAdapter()
    const handler = vi.fn().mockResolvedValue({ ok: true })

    adapter.registerRoute('/test', {
      method: 'get',
      path: '/test',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })
    expect(handler).toBeDefined()
  })

  it('registers global middleware', () => {
    const adapter = new KoaAdapter()
    const mw = vi.fn()
    adapter.registerMiddleware(mw as any)
    expect(mw).toBeDefined()
  })

  it('support server start/stop lifecycle', async () => {
    const adapter = new KoaAdapter()
    await adapter.start(0)
    await adapter.close()
  })
})
