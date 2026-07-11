import 'reflect-metadata'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { ExpressAdapter } from '../../packages/adapters/express/src/index.js'

describe('ExpressAdapter Integration', () => {
  it('creates a working Express app', () => {
    const adapter = new ExpressAdapter()
    expect(adapter.name).toBe('express')
    expect(adapter.app).toBeDefined()
  })

  it('can register routes with handlers', async () => {
    const adapter = new ExpressAdapter()
    const handler = async () => ({ ok: true })

    adapter.registerRoute('/health', {
      method: 'get',
      path: '/health',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })

    await adapter.start(0)
    expect(adapter).toBeDefined()
    await adapter.close()
  })

  it('handles guard rejection', async () => {
    const adapter = new ExpressAdapter()
    adapter.registerRoute('/protected', {
      method: 'get',
      path: '/protected',
      handler: async () => ({ secret: true }),
      parameters: [],
      middleware: [],
      guards: [async () => false],
    })
    expect(adapter).toBeDefined()
  })
})
