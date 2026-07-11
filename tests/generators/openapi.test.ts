import { describe, it, expect } from 'vitest'
import { OpenAPIGenerator } from '../../packages/generators/openapi/src/index.js'
import type { APIDefinition, RouteDefinition, ParameterDefinition } from '../../packages/core/src/types/index.js'

function makeParam(overrides: Partial<ParameterDefinition>): ParameterDefinition {
  return {
    kind: 'param',
    name: 'param',
    index: 0,
    type: { kind: 'string', name: 'string' },
    required: true,
    ...overrides,
  }
}

function makeRoute(overrides: Partial<RouteDefinition>): RouteDefinition {
  return {
    method: 'get',
    path: '/',
    fullPath: '/api',
    handlerName: 'handler',
    parameters: [],
    responseStatus: 200,
    responseContentType: 'application/json',
    guards: [],
    middleware: [],
    ...overrides,
  }
}

describe('OpenAPIGenerator', () => {
  it('generates valid OpenAPI 3.1 document structure', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: ['test'],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/test' })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('Test')
    expect(doc.info.version).toBe('1.0.0')
    expect(doc.paths).toBeDefined()
    expect(doc.components).toBeDefined()
  })

  it('converts :id path parameters to {id} format', () => {
    const apiDef: APIDefinition = {
      name: 'ItemsAPI',
      prefix: '/items',
      tags: [],
      routes: [makeRoute({
        method: 'get',
        path: '/:id',
        fullPath: '/items/:id',
        parameters: [makeParam({ kind: 'param', name: 'id', index: 0 })],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    expect(doc.paths['/items/{id}']).toBeDefined()
  })

  it('includes query parameters with defaults', () => {
    const apiDef: APIDefinition = {
      name: 'ItemsAPI',
      prefix: '/items',
      tags: [],
      routes: [makeRoute({
        method: 'get',
        path: '/',
        fullPath: '/items',
        parameters: [makeParam({ kind: 'query', name: 'page', index: 0, default: 1 })],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    const pathKey = '/items'
    const operation: any = (doc.paths[pathKey] as any)?.get
    expect(operation).toBeDefined()
    expect(operation.parameters).toBeDefined()
    const pageParam = operation.parameters.find((p: any) => p.name === 'page')
    expect(pageParam).toBeDefined()
    expect(pageParam.in).toBe('query')
  })

  it('includes request body schema', () => {
    const apiDef: APIDefinition = {
      name: 'ItemsAPI',
      prefix: '/items',
      tags: [],
      routes: [makeRoute({
        method: 'post',
        path: '/',
        fullPath: '/items',
        parameters: [makeParam({
          kind: 'body',
          name: 'body',
          index: 0,
          type: {
            kind: 'object',
            name: 'CreateItemDTO',
            properties: {
              title: { kind: 'string', name: 'string' },
              price: { kind: 'number', name: 'number' },
            },
            required: ['title'],
          },
        })],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    const operation: any = (doc.paths['/items'] as any)?.post
    expect(operation.requestBody).toBeDefined()
    expect(operation.requestBody.content['application/json']).toBeDefined()
  })

  it('includes response schemas', () => {
    const apiDef: APIDefinition = {
      name: 'ItemsAPI',
      prefix: '/items',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/items' })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    const operation: any = (doc.paths['/items'] as any)?.get
    expect(operation.responses['200']).toBeDefined()
    expect(operation.responses['400']).toBeDefined()
    expect(operation.responses['500']).toBeDefined()
  })

  it('includes tags from @api decorator', () => {
    const apiDef: APIDefinition = {
      name: 'ItemsAPI',
      prefix: '/items',
      tags: ['items', 'products'],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/items' })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    expect(doc.tags).toBeDefined()
    expect(doc.tags!.some((t) => t.name === 'items')).toBe(true)
    expect(doc.tags!.some((t) => t.name === 'products')).toBe(true)
  })

  it('generateJSON returns valid JSON string', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/test' })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const json = gen.generateJSON()
    const parsed = JSON.parse(json)
    expect(parsed.openapi).toBe('3.1.0')
  })

  it('generateYAML returns valid YAML string', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/test' })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const yaml = gen.generateYAML()
    expect(typeof yaml).toBe('string')
    expect(yaml).toContain('openapi:')
    expect(yaml).toContain('3.1.0')
  })

  it('includes servers when configured', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/test' })],
      guards: [],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], {
      title: 'Test',
      version: '1.0.0',
      servers: [{ url: 'https://api.example.com', description: 'Production' }],
    })
    const doc = gen.generate()
    expect(doc.servers).toBeDefined()
    expect(doc.servers![0].url).toBe('https://api.example.com')
  })

  it('builds security schemes from guards', () => {
    class MockGuard {
      static name = 'JWTAuthGuard'
    }

    const apiDef: APIDefinition = {
      name: 'SecureAPI',
      prefix: '/secure',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/secure' })],
      guards: [{ class: MockGuard as any, scope: 'api' }],
      middleware: [],
    }

    const gen = new OpenAPIGenerator([apiDef], { title: 'Test', version: '1.0.0' })
    const doc = gen.generate()
    expect(doc.components.securitySchemes).toBeDefined()
  })
})
