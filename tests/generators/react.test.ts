import { describe, it, expect } from 'vitest'
import { ReactQueryGenerator } from '../../packages/generators/react/src/index.js'
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

describe('ReactQueryGenerator', () => {
  it('generates useQuery for GET endpoints', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/todos', handlerName: 'list' })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('useQuery')
    expect(code).toContain('useGetList')
    expect(code).toContain('queryKey:')
  })

  it('generates useMutation for POST endpoints', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'post', path: '/', fullPath: '/todos', handlerName: 'create', parameters: [{
        kind: 'body', name: 'body', index: 0,
        type: { kind: 'object', name: 'TodoDTO', properties: { title: { kind: 'string', name: 'string' } }, required: ['title'] },
        required: true,
      }] })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('useMutation')
    expect(code).toContain('usePostCreate')
    expect(code).toContain('mutationFn:')
  })

  it('generates useMutation for PUT endpoints', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'put', path: '/:id', fullPath: '/todos/:id', handlerName: 'update' })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('useMutation')
    expect(code).toContain('usePutUpdate')
  })

  it('generates useMutation for DELETE endpoints', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'delete', path: '/:id', fullPath: '/todos/:id', handlerName: 'remove' })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('useMutation')
    expect(code).toContain('useDeleteRemove')
  })

  it('generates useMutation for PATCH endpoints', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'patch', path: '/:id', fullPath: '/todos/:id', handlerName: 'partialUpdate' })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('useMutation')
    expect(code).toContain('usePatchPartialUpdate')
  })

  it('query keys follow convention', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'get', path: '/', fullPath: '/todos', handlerName: 'list' })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain("'todos'")
  })

  it('auto-invalidates queries on mutation success', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({ method: 'post', path: '/', fullPath: '/todos', handlerName: 'create' })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('invalidateQueries')
    expect(code).toContain('queryKey:')
  })

  it('generates useInfiniteQuery for paginated endpoints', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({
        method: 'get',
        path: '/',
        fullPath: '/todos',
        handlerName: 'list',
        parameters: [
          { kind: 'query', name: 'page', index: 0, type: { kind: 'number', name: 'number' }, required: false, default: 1 },
          { kind: 'query', name: 'limit', index: 1, type: { kind: 'number', name: 'number' }, required: false, default: 10 },
        ],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('useInfiniteQuery')
    expect(code).toContain('getNextPageParam')
    expect(code).toContain('initialPageParam')
  })

  it('includes setApiClient function', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute()],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('function setApiClient')
  })

  it('imports from @tanstack/react-query', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute()],
      guards: [],
      middleware: [],
    }

    const gen = new ReactQueryGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain("@tanstack/react-query")
  })
})
