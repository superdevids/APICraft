import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PluginManager } from '../../packages/core/src/plugins/index.js'
import type { APICraftPlugin, APIDefinition, RouteDefinition, RequestContext } from '../../packages/core/src/types/index.js'

describe('PluginManager', () => {
  let pluginManager: PluginManager

  beforeEach(() => {
    pluginManager = new PluginManager()
  })

  describe('register and getPlugin', () => {
    it('registers a plugin', () => {
      const plugin: APICraftPlugin = { name: 'my-plugin', version: '1.0.0', hooks: {} }
      pluginManager.register(plugin)
      expect(pluginManager.getPlugin('my-plugin')).toBe(plugin)
    })

    it('throws when registering plugin without name', () => {
      const plugin = { version: '1.0.0', hooks: {} } as APICraftPlugin
      expect(() => pluginManager.register(plugin)).toThrow(/name.*version/)
    })

    it('throws when registering plugin without version', () => {
      const plugin = { name: 'no-ver', hooks: {} } as APICraftPlugin
      expect(() => pluginManager.register(plugin)).toThrow(/name.*version/)
    })

    it('throws when registering duplicate plugin', () => {
      const plugin: APICraftPlugin = { name: 'dupe', version: '1.0.0', hooks: {} }
      pluginManager.register(plugin)
      expect(() => pluginManager.register(plugin)).toThrow(/already registered/)
    })
  })

  describe('unregister', () => {
    it('unregisters a plugin', () => {
      const plugin: APICraftPlugin = { name: 'temp', version: '1.0.0', hooks: {} }
      pluginManager.register(plugin)
      pluginManager.unregister('temp')
      expect(pluginManager.getPlugin('temp')).toBeUndefined()
    })

    it('throws when unregistering non-existent plugin', () => {
      expect(() => pluginManager.unregister('nonexistent')).toThrow(/not registered/)
    })
  })

  describe('getAllPlugins', () => {
    it('returns all registered plugins', () => {
      pluginManager.register({ name: 'a', version: '1.0.0', hooks: {} })
      pluginManager.register({ name: 'b', version: '2.0.0', hooks: {} })
      expect(pluginManager.getAllPlugins()).toHaveLength(2)
    })
  })

  describe('trigger hooks', () => {
    it('triggerOnDefinitionScan calls plugin hooks', () => {
      const hookFn = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'test',
        version: '1.0.0',
        hooks: { onDefinitionScan: hookFn },
      }
      pluginManager.register(plugin)
      const definitions: APIDefinition[] = []
      pluginManager.triggerOnDefinitionScan(definitions)
      expect(hookFn).toHaveBeenCalledWith(definitions)
    })

    it('triggerOnRouteRegister calls plugin hooks', () => {
      const hookFn = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'test',
        version: '1.0.0',
        hooks: { onRouteRegister: hookFn },
      }
      pluginManager.register(plugin)
      const route = {} as RouteDefinition
      pluginManager.triggerOnRouteRegister(route)
      expect(hookFn).toHaveBeenCalledWith(route)
    })

    it('triggerOnGenerateOpenAPI calls plugin hooks', () => {
      const hookFn = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'test',
        version: '1.0.0',
        hooks: { onGenerateOpenAPI: hookFn },
      }
      pluginManager.register(plugin)
      const spec = { openapi: '3.1.0' }
      pluginManager.triggerOnGenerateOpenAPI(spec)
      expect(hookFn).toHaveBeenCalledWith(spec)
    })

    it('triggerOnRequest calls async plugin hooks', async () => {
      const hookFn = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'test',
        version: '1.0.0',
        hooks: { onRequest: hookFn },
      }
      pluginManager.register(plugin)
      const ctx = {} as RequestContext
      await pluginManager.triggerOnRequest(ctx)
      expect(hookFn).toHaveBeenCalledWith(ctx)
    })

    it('triggerOnResponse calls async plugin hooks', async () => {
      const hookFn = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'test',
        version: '1.0.0',
        hooks: { onResponse: hookFn },
      }
      pluginManager.register(plugin)
      const ctx = {} as RequestContext
      await pluginManager.triggerOnResponse(ctx)
      expect(hookFn).toHaveBeenCalledWith(ctx)
    })

    it('triggerOnError calls async plugin hooks', async () => {
      const hookFn = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'test',
        version: '1.0.0',
        hooks: { onError: hookFn },
      }
      pluginManager.register(plugin)
      const ctx = {} as RequestContext
      const error = new Error('test error')
      await pluginManager.triggerOnError(ctx, error)
      expect(hookFn).toHaveBeenCalledWith(ctx, error)
    })

    it('error isolation: one plugin error does not break others', () => {
      const badPlugin: APICraftPlugin = {
        name: 'bad',
        version: '1.0.0',
        hooks: { onDefinitionScan: () => { throw new Error('bad plugin error') } },
      }
      const goodFn = vi.fn()
      const goodPlugin: APICraftPlugin = {
        name: 'good',
        version: '1.0.0',
        hooks: { onDefinitionScan: goodFn },
      }
      pluginManager.register(badPlugin)
      pluginManager.register(goodPlugin)
      pluginManager.triggerOnDefinitionScan([])
      expect(goodFn).toHaveBeenCalled()
    })

    it('plugin hooks receive correct arguments', () => {
      const onRouteRegister = vi.fn()
      const plugin: APICraftPlugin = {
        name: 'args-test',
        version: '1.0.0',
        hooks: { onRouteRegister },
      }
      pluginManager.register(plugin)
      const route: RouteDefinition = {
        method: 'get',
        path: '/test',
        fullPath: '/api/test',
        handlerName: 'handler',
        parameters: [],
        responseStatus: 200,
        responseContentType: 'application/json',
        guards: [],
        middleware: [],
      }
      pluginManager.triggerOnRouteRegister(route)
      expect(onRouteRegister).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', path: '/test' }),
      )
    })
  })
})
