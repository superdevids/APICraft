import { describe, it, expect } from 'vitest'
import { ClientSDKGenerator } from '../../packages/generators/client/src/index.js'
import type { APIDefinition, RouteDefinition } from '../../packages/core/src/types/index.js'

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

describe('ClientSDKGenerator', () => {
  it('generates fetch client with typed methods', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [
        makeRoute({
          method: 'get',
          path: '/',
          fullPath: '/todos',
          handlerName: 'list',
          parameters: [{
            kind: 'query',
            name: 'page',
            index: 0,
            type: { kind: 'number', name: 'number' },
            required: false,
            default: 1,
          }],
        }),
      ],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateFetchClient()
    expect(code).toContain('class APICraftClient')
    expect(code).toContain('getList')
    expect(code).toContain('fetch(url')
    expect(code).toContain('class APIError')
  })

  it('GET endpoints use URLSearchParams', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [
        makeRoute({
          method: 'get',
          path: '/',
          fullPath: '/todos',
          handlerName: 'list',
          parameters: [{
            kind: 'query',
            name: 'page',
            index: 0,
            type: { kind: 'number', name: 'number' },
            required: false,
          }],
        }),
      ],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateFetchClient()
    expect(code).toContain('URLSearchParams')
  })

  it('POST endpoints send JSON body', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [
        makeRoute({
          method: 'post',
          path: '/',
          fullPath: '/todos',
          handlerName: 'create',
          parameters: [{
            kind: 'body',
            name: 'body',
            index: 0,
            type: { kind: 'object', name: 'CreateTodoDTO', properties: { title: { kind: 'string', name: 'string' } }, required: ['title'] },
            required: true,
          }],
        }),
      ],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateFetchClient()
    expect(code).toContain('JSON.stringify(body)')
    expect(code).toContain("'Content-Type': 'application/json'")
  })

  it('includes APIError class in output', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute()],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateFetchClient()
    expect(code).toContain('class APIError extends Error')
    expect(code).toContain('throw new APIError(res.status, errorBody)')
  })

  it('generates TypeScript interfaces for object types', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [
        makeRoute({
          method: 'post',
          path: '/',
          fullPath: '/todos',
          handlerName: 'create',
          parameters: [{
            kind: 'body',
            name: 'body',
            index: 0,
            type: {
              kind: 'object',
              name: 'CreateTodoDTO',
              properties: { title: { kind: 'string', name: 'string' }, completed: { kind: 'boolean', name: 'boolean' } },
              required: ['title'],
            },
            required: true,
          }],
        }),
      ],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateFetchClient()
    expect(code).toContain('interface CreateTodoDTO')
    expect(code).toContain('title: string')
    expect(code).toContain('completed?: boolean')
  })

  it('generates axios client variant', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute()],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateAxiosClient()
    expect(code).toContain('class APICraftAxiosClient')
    expect(code).toContain('AxiosInstance')
    expect(code).toContain('import axios')
  })

  it('generates method names correctly', () => {
    const apiDef: APIDefinition = {
      name: 'UsersAPI',
      prefix: '/users',
      tags: [],
      routes: [
        makeRoute({ method: 'get', path: '/', fullPath: '/users', handlerName: 'list' }),
        makeRoute({ method: 'post', path: '/', fullPath: '/users', handlerName: 'create' }),
        makeRoute({ method: 'get', path: '/:id', fullPath: '/users/:id', handlerName: 'getById' }),
      ],
      guards: [],
      middleware: [],
    }

    const gen = new ClientSDKGenerator([apiDef])
    const code = gen.generateFetchClient()
    expect(code).toContain('getList')
    expect(code).toContain('postCreate')
    expect(code).toContain('getGetById')
  })
})
