import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { DefinitionRegistry, API_METADATA_KEY, ROUTE_METADATA_KEY, PARAM_METADATA_KEY } from '../../packages/core/src/metadata/index.js'
import type { APIDefinition, RouteDefinition, ParameterDefinition } from '../../packages/core/src/types/index.js'

describe('DefinitionRegistry', () => {
  let registry: DefinitionRegistry

  beforeEach(() => {
    registry = DefinitionRegistry.getInstance()
  })

  describe('registerAPI and getAPIDefinition', () => {
    it('registers and retrieves an API definition', () => {
      const def: APIDefinition = {
        name: 'TestAPI',
        prefix: '/test',
        tags: ['test'],
        routes: [],
        guards: [],
        middleware: [],
      }

      class TestAPI {}
      registry.registerAPI(TestAPI, def)

      const retrieved = registry.getAPIDefinition(TestAPI)
      expect(retrieved).toBeDefined()
      expect(retrieved!.name).toBe('TestAPI')
      expect(retrieved!.prefix).toBe('/test')
      expect(retrieved!.tags).toEqual(['test'])
    })

    it('merges metadata on re-registration', () => {
      const initial: APIDefinition = {
        name: 'MergeAPI',
        prefix: '/merge',
        tags: ['tag1'],
        routes: [],
        guards: [],
        middleware: [],
      }

      class MergeAPI {}
      registry.registerAPI(MergeAPI, initial)

      const update: APIDefinition = {
        name: 'MergeAPI',
        prefix: '/merge',
        tags: ['tag1', 'tag2'],
        routes: [],
        guards: [],
        middleware: [],
      }
      registry.registerAPI(MergeAPI, update)

      const retrieved = registry.getAPIDefinition(MergeAPI)
      expect(retrieved!.tags).toEqual(['tag1', 'tag2'])
    })
  })

  describe('getAllDefinitions', () => {
    it('returns all registered API definitions', () => {
      const countBefore = registry.getAllDefinitions().length

      class API1 {}
      class API2 {}
      registry.registerAPI(API1, { name: 'API1', prefix: '/a', tags: [], routes: [], guards: [], middleware: [] })
      registry.registerAPI(API2, { name: 'API2', prefix: '/b', tags: [], routes: [], guards: [], middleware: [] })

      const all = registry.getAllDefinitions()
      expect(all.length).toBeGreaterThanOrEqual(countBefore + 2)
    })
  })

  describe('registerRoute and getRouteDefinitions', () => {
    it('registers and retrieves route definitions', () => {
      class TestClass {
        handler() {}
      }

      const route: RouteDefinition = {
        method: 'get',
        path: '/',
        fullPath: '/test',
        handlerName: 'handler',
        parameters: [],
        responseStatus: 200,
        responseContentType: 'application/json',
        guards: [],
        middleware: [],
      }

      registry.registerRoute(TestClass.prototype, route)
      const routes = registry.getRouteDefinitions(TestClass as unknown as Function)
      expect(routes).toHaveLength(1)
      expect(routes[0].method).toBe('get')
      expect(routes[0].fullPath).toBe('/test')
    })
  })

  describe('registerParam and getParamDefinitions', () => {
    it('registers and retrieves parameter definitions', () => {
      class TestClass {
        handler() {}
      }

      const param: ParameterDefinition = {
        kind: 'param',
        name: 'id',
        index: 0,
        type: { kind: 'string', name: 'string' },
        required: true,
      }

      registry.registerParam(TestClass.prototype, param)
      const params = registry.getParamDefinitions(TestClass as unknown as Function)
      expect(params).toHaveLength(1)
      expect(params[0].kind).toBe('param')
      expect(params[0].name).toBe('id')
    })
  })

  describe('scan', () => {
    it('processes classes when params are registered', () => {
      class TestAPI {
        list() {}
        create() {}
      }

      const apiDef: APIDefinition = {
        name: 'TestAPI',
        prefix: '/test',
        tags: ['api'],
        routes: [],
        guards: [],
        middleware: [],
      }

      Reflect.defineMetadata(API_METADATA_KEY, apiDef, TestAPI)
      Reflect.defineMetadata(API_METADATA_KEY, apiDef, TestAPI.prototype)
      registry.registerAPI(TestAPI, apiDef)

      const routeList: RouteDefinition = {
        method: 'get',
        path: '/',
        fullPath: '/test',
        handlerName: 'list',
        parameters: [],
        responseStatus: 200,
        responseContentType: 'application/json',
        guards: [],
        middleware: [],
      }

      const routeCreate: RouteDefinition = {
        method: 'post',
        path: '/',
        fullPath: '/test',
        handlerName: 'create',
        parameters: [],
        responseStatus: 201,
        responseContentType: 'application/json',
        guards: [],
        middleware: [],
      }

      registry.registerRoute(TestAPI.prototype, routeList)
      registry.registerRoute(TestAPI.prototype, routeCreate)

      registry.registerParam(TestAPI.prototype, {
        kind: 'param', name: 'dummy', index: 0,
        type: { kind: 'string', name: 'string' },
        required: true,
      })

      const results = registry.scan([TestAPI])
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('TestAPI')
      expect(results[0].routes).toHaveLength(2)
    })

    it('skips classes without API metadata', () => {
      class Undecorated {}
      const results = registry.scan([Undecorated])
      expect(results).toHaveLength(0)
    })
  })

  describe('metadata keys', () => {
    it('API_METADATA_KEY is correct', () => {
      expect(API_METADATA_KEY).toBe('apicraft:api')
    })

    it('ROUTE_METADATA_KEY is correct', () => {
      expect(ROUTE_METADATA_KEY).toBe('apicraft:route')
    })

    it('PARAM_METADATA_KEY is correct', () => {
      expect(PARAM_METADATA_KEY).toBe('apicraft:param')
    })
  })
})
