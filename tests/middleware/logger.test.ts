import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LoggerMiddleware } from '../../packages/middleware/logger/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function makeContext(): RequestContext {
  return {
    request: {
      method: 'GET',
      path: '/test',
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

describe('LoggerMiddleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores start time in state', async () => {
    const mw = new LoggerMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(ctx.state.get('startTime')).toBeDefined()
    expect(typeof ctx.state.get('startTime')).toBe('number')
  })

  it('logs request on before', async () => {
    const mw = new LoggerMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    expect(console.log).toHaveBeenCalled()
  })

  it('logs response on after', async () => {
    const mw = new LoggerMiddleware()
    const ctx = makeContext()
    await mw.before(ctx)
    await mw.after(ctx)
    expect(console.log).toHaveBeenCalled()
  })

  it('logs with warn level for 4xx responses', async () => {
    const mw = new LoggerMiddleware()
    const ctx = makeContext()
    ctx.response.statusCode = 404
    await mw.before(ctx)
    await mw.after(ctx)
    expect(console.warn).toHaveBeenCalled()
  })

  it('logs errors on onError', async () => {
    const mw = new LoggerMiddleware()
    const ctx = makeContext()
    await mw.onError(ctx, new Error('test error'))
    expect(console.error).toHaveBeenCalled()
  })

  it('supports JSON format', async () => {
    const mw = new LoggerMiddleware({ format: 'json' })
    const ctx = makeContext()
    await mw.before(ctx)
    expect(console.log).toHaveBeenCalled()
  })

  it('supports combined format', async () => {
    const mw = new LoggerMiddleware({ format: 'combined' })
    const ctx = makeContext()
    await mw.before(ctx)
    expect(console.log).toHaveBeenCalled()
  })

  it('respects log level filtering', async () => {
    const consoleDebug = vi.spyOn(console, 'log').mockImplementation(() => {})
    const mw = new LoggerMiddleware({ level: 'error' })
    const ctx = makeContext()
    await mw.before(ctx)
    expect(console.log).not.toHaveBeenCalled()
  })
})
