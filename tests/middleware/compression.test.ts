import { describe, it, expect, vi } from 'vitest'
import { CompressionMiddleware } from '../../packages/middleware/compression/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function makeContext(body: unknown = null, acceptEncoding?: string): RequestContext {
  const headers: Record<string, string | string[] | undefined> = {}
  if (acceptEncoding) headers['accept-encoding'] = acceptEncoding
  return {
    request: {
      method: 'GET',
      path: '/',
      params: {},
      query: {},
      headers,
      body: null,
      ip: '127.0.0.1',
    },
    response: {
      statusCode: 200,
      headers: {},
      body,
    },
    state: new Map(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
}

describe('CompressionMiddleware', () => {
  it('compresses response body with gzip', async () => {
    const mw = new CompressionMiddleware({ algorithm: 'gzip', threshold: 1 })
    const ctx = makeContext({ data: 'hello world' }, 'gzip')
    await mw.after(ctx)
    expect(ctx.response.headers['Content-Encoding']).toBe('gzip')
  })

  it('does not compress small responses below threshold', async () => {
    const mw = new CompressionMiddleware({ threshold: 10000 })
    const ctx = makeContext('small', 'gzip')
    await mw.after(ctx)
    expect(ctx.response.headers['Content-Encoding']).toBeUndefined()
  })

  it('does not compress without accept-encoding', async () => {
    const mw = new CompressionMiddleware({ algorithm: 'gzip', threshold: 1 })
    const ctx = makeContext('some data')
    await mw.after(ctx)
    expect(ctx.response.headers['Content-Encoding']).toBeUndefined()
  })

  it('does not compress if already encoded', async () => {
    const mw = new CompressionMiddleware({ algorithm: 'gzip', threshold: 1 })
    const ctx = makeContext('some data', 'gzip')
    ctx.response.headers['Content-Encoding'] = 'already-encoded'
    await mw.after(ctx)
    expect(ctx.response.headers['Content-Encoding']).toBe('already-encoded')
  })

  it('skips null body', async () => {
    const mw = new CompressionMiddleware({ algorithm: 'gzip', threshold: 1 })
    const ctx = makeContext(null, 'gzip')
    await mw.after(ctx)
    expect(ctx.response.headers['Content-Encoding']).toBeUndefined()
  })

  it('supports custom filter function', async () => {
    const filter = vi.fn().mockReturnValue(false)
    const mw = new CompressionMiddleware({ algorithm: 'gzip', threshold: 1, filter })
    const ctx = makeContext('some data', 'gzip')
    await mw.after(ctx)
    expect(ctx.response.headers['Content-Encoding']).toBeUndefined()
    expect(filter).toHaveBeenCalledWith(ctx)
  })
})
