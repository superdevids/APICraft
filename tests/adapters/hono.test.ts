import { describe, it, expect } from 'vitest'
import { HonoAdapter } from '../../packages/adapters/hono/src/index.js'

describe('HonoAdapter', () => {
  it('creates adapter instance', () => {
    const adapter = new HonoAdapter()
    expect(adapter.name).toBe('hono')
  })
})
