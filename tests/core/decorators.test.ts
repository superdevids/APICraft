import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { api, get, post, put, patch, del, param, query as queryDec, body, headers as headersDec, context, response, guard, use, version, throttle } from '../../packages/core/src/decorators/index.js'
import { DefinitionRegistry, API_METADATA_KEY, ROUTE_METADATA_KEY, PARAM_METADATA_KEY } from '../../packages/core/src/metadata/index.js'
import type { Guard, Middleware, RequestContext } from '../../packages/core/src/types/index.js'

class MockGuard implements Guard {
  async authenticate(_ctx: RequestContext): Promise<boolean> { return true }
  async onFailure(_ctx: RequestContext): Promise<void> {}
}

class MockMiddleware implements Middleware {
  async before(_ctx: RequestContext): Promise<void> {}
  async after(_ctx: RequestContext): Promise<void> {}
  async onError(_ctx: RequestContext, _error: Error): Promise<void> {}
}

describe('@api decorator', () => {
  it('stores correct prefix and tags', () => {
    @api('/test', { tags: ['tag1', 'tag2'] })
    class TestAPI {}

    const def = Reflect.getOwnMetadata(API_METADATA_KEY, TestAPI)
    expect(def).toBeDefined()
    expect(def.prefix).toBe('/test')
    expect(def.tags).toEqual(['tag1', 'tag2'])
  })

  it('stores empty tags when not provided', () => {
    @api('/no-tags')
    class NoTagsAPI {}

    const def = Reflect.getOwnMetadata(API_METADATA_KEY, NoTagsAPI)
    expect(def.tags).toEqual([])
  })
})

describe('HTTP method decorators', () => {
  @api('/users')
  class UsersAPI {
    @get('/')
    list() {}

    @post('/')
    create() {}

    @put('/:id')
    update() {}

    @patch('/:id')
    partialUpdate() {}

    @del('/:id')
    remove() {}
  }

  it('@get stores correct method and path', () => {
    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
    const listRoute = routes.find((r: any) => r.handlerName === 'list')
    expect(listRoute.method).toBe('get')
    expect(listRoute.path).toBe('/')
  })

  it('@post stores correct method', () => {
    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
    const createRoute = routes.find((r: any) => r.handlerName === 'create')
    expect(createRoute.method).toBe('post')
  })

  it('@put stores path with :id parameter', () => {
    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
    const updateRoute = routes.find((r: any) => r.handlerName === 'update')
    expect(updateRoute.method).toBe('put')
    expect(updateRoute.path).toBe('/:id')
  })

  it('@patch stores correct method', () => {
    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
    const patchRoute = routes.find((r: any) => r.handlerName === 'partialUpdate')
    expect(patchRoute.method).toBe('patch')
  })

  it('@del stores delete method', () => {
    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
    const delRoute = routes.find((r: any) => r.handlerName === 'remove')
    expect(delRoute.method).toBe('delete')
  })
})

describe('@param decorator', () => {
  it('stores parameter metadata with kind, name, index', () => {
    @api('/items')
    class ItemsAPI {
      @get('/:id')
      getById(@param('id') id: string) {}
    }

    const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, ItemsAPI.prototype, 'getById')
    expect(params).toBeDefined()
    const idParam = params.find((p: any) => p.name === 'id')
    expect(idParam.kind).toBe('param')
    expect(idParam.index).toBe(0)
    expect(idParam.required).toBe(true)
  })
})

describe('@query decorator', () => {
  it('stores query metadata with default value', () => {
    @api('/items')
    class ItemsAPI {
      @get('/')
      list(@queryDec('page', { default: 1 }) page: number) {}
    }

    const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, ItemsAPI.prototype, 'list')
    const pageParam = params.find((p: any) => p.name === 'page')
    expect(pageParam.kind).toBe('query')
    expect(pageParam.default).toBe(1)
    expect(pageParam.index).toBe(0)
  })
})

describe('@body decorator', () => {
  it('stores body metadata', () => {
    @api('/items')
    class ItemsAPI {
      @post('/')
      create(@body() body: any) {}
    }

    const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, ItemsAPI.prototype, 'create')
    const bodyParam = params.find((p: any) => p.kind === 'body')
    expect(bodyParam).toBeDefined()
    expect(bodyParam.name).toBe('body')
    expect(bodyParam.required).toBe(true)
  })
})

describe('@headers decorator', () => {
  it('stores headers metadata', () => {
    @api('/items')
    class ItemsAPI {
      @get('/')
      list(@headersDec() headers: Record<string, string>) {}
    }

    const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, ItemsAPI.prototype, 'list')
    const hParam = params.find((p: any) => p.kind === 'headers')
    expect(hParam).toBeDefined()
    expect(hParam.name).toBe('headers')
    expect(hParam.required).toBe(false)
  })
})

describe('@context decorator', () => {
  it('stores context metadata', () => {
    @api('/items')
    class ItemsAPI {
      @get('/')
      list(@context() ctx: any) {}
    }

    const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, ItemsAPI.prototype, 'list')
    const ctxParam = params.find((p: any) => p.kind === 'context')
    expect(ctxParam).toBeDefined()
    expect(ctxParam.name).toBe('context')
    expect(ctxParam.required).toBe(true)
  })
})

describe('@response decorator', () => {
  it('sets custom status code', () => {
    @api('/items')
    class ItemsAPI {
      @get('/')
      @response(201)
      create() {}
    }

    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, ItemsAPI.prototype)
    const route = routes.find((r: any) => r.handlerName === 'create')
    expect(route.responseStatus).toBe(201)
  })
})

describe('@guard decorator', () => {
  it('stores guard class reference on class', () => {
    @api('/admin')
    @guard(MockGuard)
    class AdminAPI {}

    const def = Reflect.getOwnMetadata(API_METADATA_KEY, AdminAPI)
    expect(def.guards).toHaveLength(1)
    expect(def.guards[0].class).toBe(MockGuard)
    expect(def.guards[0].scope).toBe('api')
  })

  it('stores guard class reference on route', () => {
    @api('/items')
    class ItemsAPI {
      @get('/')
      @guard(MockGuard)
      list() {}
    }

    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, ItemsAPI.prototype)
    const route = routes.find((r: any) => r.handlerName === 'list')
    expect(route.guards).toHaveLength(1)
    expect(route.guards[0].class).toBe(MockGuard)
  })
})

describe('@use decorator', () => {
  it('stores middleware class reference on class', () => {
    @api('/admin')
    @use(MockMiddleware)
    class AdminAPI {}

    const def = Reflect.getOwnMetadata(API_METADATA_KEY, AdminAPI)
    expect(def.middleware).toHaveLength(1)
    expect(def.middleware[0].class).toBe(MockMiddleware)
  })

  it('stores middleware class reference on route', () => {
    @api('/items')
    class ItemsAPI {
      @get('/')
      @use(MockMiddleware)
      list() {}
    }

    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, ItemsAPI.prototype)
    const route = routes.find((r: any) => r.handlerName === 'list')
    expect(route.middleware).toHaveLength(1)
    expect(route.middleware[0].class).toBe(MockMiddleware)
  })
})

describe('@version decorator', () => {
  it('stores version string', () => {
    @api('/api')
    @version('v1')
    class VersionedAPI {}

    const def = Reflect.getOwnMetadata(API_METADATA_KEY, VersionedAPI)
    expect(def.version).toBe('v1')
  })
})

describe('@throttle decorator', () => {
  it('stores throttle config', () => {
    @api('/api')
    class ThrottledAPI {
      @get('/')
      @throttle({ window: 60000, max: 10 })
      list() {}
    }

    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, ThrottledAPI.prototype)
    const route = routes.find((r: any) => r.handlerName === 'list')
    expect(route.throttle).toBeDefined()
    expect(route.throttle.window).toBe(60000)
    expect(route.throttle.max).toBe(10)
  })
})

describe('DefinitionRegistry reads back stored metadata', () => {
  it('registerAPI and getAPIDefinition round-trip', () => {
    const registry = DefinitionRegistry.getInstance()
    @api('/test-roundtrip', { tags: ['rt'] })
    class RoundtripAPI {}

    const def = registry.getAPIDefinition(RoundtripAPI)
    expect(def).toBeDefined()
    expect(def!.prefix).toBe('/test-roundtrip')
    expect(def!.tags).toEqual(['rt'])
  })

  it('getAllDefinitions returns registered APIs', () => {
    const registry = DefinitionRegistry.getInstance()
    const allBefore = registry.getAllDefinitions().length

    @api('/extra')
    class ExtraAPI {}

    const allAfter = registry.getAllDefinitions()
    expect(allAfter.length).toBeGreaterThanOrEqual(allBefore + 1)
    const found = allAfter.find((d) => d.name === 'ExtraAPI')
    expect(found).toBeDefined()
  })
})
