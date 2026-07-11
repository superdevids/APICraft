import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { APICraftApp } from '../../packages/core/src/app.js'
import { DefinitionRegistry, PARAM_METADATA_KEY } from '../../packages/core/src/metadata/index.js'
import { api, get, post } from '../../packages/core/src/decorators/index.js'
import type { APICraftConfig, Middleware, RequestContext } from '../../packages/core/src/types/index.js'

class TestMiddleware implements Middleware {
  async before(ctx: RequestContext): Promise<void> {
    ctx.state.set('middlewareRan', true)
  }
  async after(_ctx: RequestContext): Promise<void> {}
}

describe('APICraftApp.create()', () => {
  it('creates an app with valid config using a custom adapter', () => {
    const customAdapter = {
      name: 'test',
      registerRoutes: vi.fn(),
      createRequestContext: vi.fn(),
      sendResponse: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
    }
    const config: APICraftConfig = {
      title: 'Test API',
      version: '1.0.0',
      adapter: customAdapter,
    }
    const app = APICraftApp.create(config)
    expect(app).toBeInstanceOf(APICraftApp)
    app.close()
  })

  it('resolves adapter from object', () => {
    const customAdapter = {
      name: 'custom',
      registerRoutes: vi.fn(),
      createRequestContext: vi.fn(),
      sendResponse: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
    }
    const config: APICraftConfig = {
      title: 'Test',
      version: '1.0.0',
      adapter: customAdapter,
    }
    const app = APICraftApp.create(config)
    expect(app).toBeInstanceOf(APICraftApp)
    app.close()
  })

  it('throws for unknown adapter string', () => {
    const config: APICraftConfig = {
      title: 'Test',
      version: '1.0.0',
      adapter: 'unknown-adapter' as any,
    }
    expect(() => APICraftApp.create(config)).toThrow(/Unknown adapter/)
  })

  it('initializes plugins from config', () => {
    const customAdapter = {
      name: 'test', registerRoutes: vi.fn(), createRequestContext: vi.fn(),
      sendResponse: vi.fn(), listen: vi.fn(), close: vi.fn(),
    }
    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      hooks: {},
    }
    const config: APICraftConfig = {
      title: 'Test',
      version: '1.0.0',
      adapter: customAdapter,
      plugins: [plugin],
    }
    const app = APICraftApp.create(config)
    const pm = app.getPluginManager()
    expect(pm.getPlugin('test-plugin')).toBeDefined()
    app.close()
  })

  it('initializes WebSocket engine', () => {
    const customAdapter = {
      name: 'test', registerRoutes: vi.fn(), createRequestContext: vi.fn(),
      sendResponse: vi.fn(), listen: vi.fn(), close: vi.fn(),
    }
    const config: APICraftConfig = {
      title: 'Test',
      version: '1.0.0',
      adapter: customAdapter,
    }
    const app = APICraftApp.create(config)
    const ws = app.getWebSocketEngine()
    expect(ws).toBeDefined()
    expect(typeof ws.register).toBe('function')
    app.close()
  })
})

describe('APICraftApp.getOpenAPISpec()', () => {
  @api('/items', { tags: ['items'] })
  class ItemsAPI {
    @get('/')
    list() { return [] }

    @post('/')
    create() { return {} }
  }

  it('returns properly structured spec with custom adapter', () => {
    const registry = DefinitionRegistry.getInstance()
    registry.registerParam(ItemsAPI.prototype, {
      kind: 'param', name: '_dummy', index: 0,
      type: { kind: 'string', name: 'string' },
      required: true,
    })

    const customAdapter = {
      name: 'test', registerRoutes: vi.fn(), createRequestContext: vi.fn(),
      sendResponse: vi.fn(), listen: vi.fn(), close: vi.fn(),
    }
    const config: APICraftConfig = {
      title: 'Test Spec',
      version: '2.0.0',
      description: 'A test spec',
      adapter: customAdapter,
      apis: [ItemsAPI],
    }
    const app = APICraftApp.create(config)
    const spec: any = app.getOpenAPISpec()
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Test Spec')
    expect(spec.info.version).toBe('2.0.0')
    expect(spec.info.description).toBe('A test spec')
    expect(spec.paths).toBeDefined()
    app.close()
  })

  it('includes paths from registered APIs', () => {
    const customAdapter = {
      name: 'test', registerRoutes: vi.fn(), createRequestContext: vi.fn(),
      sendResponse: vi.fn(), listen: vi.fn(), close: vi.fn(),
    }
    const config: APICraftConfig = {
      title: 'Test',
      version: '1.0.0',
      adapter: customAdapter,
      apis: [ItemsAPI],
    }
    const app = APICraftApp.create(config)
    const spec: any = app.getOpenAPISpec()
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(1)
    app.close()
  })
})

describe('APICraftApp lifecycle', () => {
  it('listen() and close() work', async () => {
    const customAdapter = {
      name: 'test', registerRoutes: vi.fn(), createRequestContext: vi.fn(),
      sendResponse: vi.fn(), listen: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
    }
    const config: APICraftConfig = {
      title: 'Lifecycle Test',
      version: '1.0.0',
      adapter: customAdapter,
    }
    const app = APICraftApp.create(config)
    await app.listen(0)
    expect(customAdapter.listen).toHaveBeenCalledWith(0)
    await app.close()
    expect(customAdapter.close).toHaveBeenCalled()
  })
})
