import { describe, it, expect } from 'vitest'
import { NestJSAdapter } from '../../packages/adapters/nest/src/index.js'

describe('NestJSAdapter', () => {
  it('creates adapter instance', () => {
    const adapter = new NestJSAdapter()
    expect(adapter.name).toBe('nest')
    adapter.close()
  })

  it('creates a request context', () => {
    const adapter = new NestJSAdapter()
    const req = { params: {}, query: {}, headers: {}, body: null, ip: '127.0.0.1', method: 'GET', path: '/test', socket: { remoteAddress: '127.0.0.1' } }
    const ctx = adapter.createRequestContext(req, { setHeader: () => {}, status: () => {}, json: () => {}, end: () => {} })
    expect(ctx).toBeDefined()
    expect(ctx.request.method).toBe('get')
    adapter.close()
  })
})
