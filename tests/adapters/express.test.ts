import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import { ExpressAdapter, APIError } from '../../packages/adapters/express/src/index.js'

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter

  beforeEach(() => {
    adapter = new ExpressAdapter()
  })

  afterEach(async () => {
    await adapter.close()
  })

  it('creates adapter instance', () => {
    expect(adapter.name).toBe('express')
    expect(adapter.app).toBeDefined()
  })

  it('registerRoute registers on Express app', () => {
    const routeHandler = vi.fn().mockResolvedValue({ id: 1, name: 'test' })
    adapter.registerRoute('/test', {
      method: 'get',
      path: '/test',
      handler: routeHandler,
      parameters: [],
      middleware: [],
      guards: [],
    })
    const routes = adapter.app._router.stack.filter((r: any) => r.route).length
    expect(routes).toBeGreaterThanOrEqual(1)
  })

  it('guards are called before handler', async () => {
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

    const req = { method: 'GET', path: '/guarded', params: {}, query: {}, body: {}, headers: {}, ip: '127.0.0.1' } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() } as any
    const next = vi.fn()

    const stack = adapter.app._router.stack
    const layer = stack.find((l: any) => l.route?.path === '/guarded')
    await layer.route?.stack[0]?.handle(req, res, next)

    expect(guard).toHaveBeenCalled()
    expect(handler).toHaveBeenCalled()
  })

  it('returns 401 when guard fails', async () => {
    const guard = vi.fn().mockResolvedValue(false)
    const handler = vi.fn()

    adapter.registerRoute('/protected', {
      method: 'get',
      path: '/protected',
      handler,
      parameters: [],
      middleware: [],
      guards: [guard],
    })

    const req = { method: 'GET', path: '/protected', params: {}, query: {}, body: {}, headers: {}, ip: '127.0.0.1' } as any
    const jsonFn = vi.fn()
    const res = { status: vi.fn().mockReturnValue({ json: jsonFn }), end: vi.fn() } as any
    const next = vi.fn()

    const stack = adapter.app._router.stack
    const layer = stack.find((l: any) => l.route?.path === '/protected')
    await layer.route?.stack[0]?.handle(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(jsonFn).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
    }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('middleware chain executes in order', async () => {
    const order: number[] = []
    const mw1 = vi.fn().mockImplementation(async () => { order.push(1) })
    const mw2 = vi.fn().mockImplementation(async () => { order.push(2) })
    const handler = vi.fn().mockImplementation(async () => { order.push(3); return { ok: true } })

    adapter.registerRoute('/ordered', {
      method: 'get',
      path: '/ordered',
      handler,
      parameters: [],
      middleware: [mw1, mw2],
      guards: [],
    })

    const req = { method: 'GET', path: '/ordered', params: {}, query: {}, body: {}, headers: {}, ip: '127.0.0.1' } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() } as any
    const next = vi.fn()

    const stack = adapter.app._router.stack
    const layer = stack.find((l: any) => l.route?.path === '/ordered')
    await layer.route?.stack[0]?.handle(req, res, next)

    expect(order).toEqual([1, 2, 3])
  })

  it('handles APIError and returns standardized format', async () => {
    const handler = vi.fn().mockRejectedValue(new APIError(400, 'BAD_REQUEST', 'Something went wrong'))

    adapter.registerRoute('/error', {
      method: 'get',
      path: '/error',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })

    const req = { method: 'GET', path: '/error', params: {}, query: {}, body: {}, headers: {}, ip: '127.0.0.1' } as any
    const jsonFn = vi.fn()
    const res = { status: vi.fn().mockReturnValue({ json: jsonFn }), end: vi.fn() } as any
    const next = vi.fn()

    const stack = adapter.app._router.stack
    const layer = stack.find((l: any) => l.route?.path === '/error')
    await layer.route?.stack[0]?.handle(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonFn).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'APIError' }),
    }))
  })

  it('returns 500 on unexpected error', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Unexpected'))
    const next = vi.fn()

    adapter.registerRoute('/crash', {
      method: 'get',
      path: '/crash',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })

    const req = { method: 'GET', path: '/crash', params: {}, query: {}, body: {}, headers: {}, ip: '127.0.0.1' } as any
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() } as any

    const stack = adapter.app._router.stack
    const layer = stack.find((l: any) => l.route?.path === '/crash')
    await layer.route?.stack[0]?.handle(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('support server start/stop lifecycle', async () => {
    await adapter.start(0)
    await adapter.close()
  })

  it('creates router', () => {
    const router = adapter.createRouter()
    expect(router).toBeDefined()
  })

  it('registers global middleware', () => {
    const mw = vi.fn()
    adapter.registerMiddleware(mw as any)
    expect(adapter.app._router.stack.length).toBeGreaterThanOrEqual(1)
  })
})
