import { describe, it, expect } from 'vitest'
import { ZodSchemaGenerator } from '../../packages/generators/zod/src/index.js'
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

describe('ZodSchemaGenerator', () => {
  it('generates body schemas', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({
        method: 'post',
        path: '/',
        fullPath: '/todos',
        handlerName: 'create',
        parameters: [{
          kind: 'body', name: 'body', index: 0,
          type: {
            kind: 'object', name: 'CreateTodoDTO',
            properties: {
              title: { kind: 'string', name: 'string' },
              completed: { kind: 'boolean', name: 'boolean' },
            },
            required: ['title'],
          },
          required: true,
        }],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new ZodSchemaGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('TodosAPICreateBodySchema')
    expect(code).toContain('title: z.string()')
    expect(code).toContain('completed: z.boolean().optional()')
  })

  it('generates query parameter schemas', () => {
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

    const gen = new ZodSchemaGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('TodosAPIListQueryParamsSchema')
    expect(code).toContain('page:')
    expect(code).toContain('limit:')
  })

  it('uses proper Zod types', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute({
        method: 'post',
        path: '/',
        fullPath: '/test',
        handlerName: 'create',
        parameters: [{
          kind: 'body', name: 'body', index: 0,
          type: {
            kind: 'object', name: 'DTO',
            properties: {
              name: { kind: 'string', name: 'string' },
              count: { kind: 'number', name: 'number' },
              active: { kind: 'boolean', name: 'boolean' },
              tags: { kind: 'array', name: 'array', items: { kind: 'string', name: 'string' } },
            },
            required: ['name'],
          },
          required: true,
        }],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new ZodSchemaGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('z.string()')
    expect(code).toContain('z.number()')
    expect(code).toContain('z.boolean()')
    expect(code).toContain('z.array(')
  })

  it('includes default values', () => {
    const apiDef: APIDefinition = {
      name: 'TodosAPI',
      prefix: '/todos',
      tags: [],
      routes: [makeRoute({
        method: 'get',
        path: '/',
        fullPath: '/todos',
        handlerName: 'list',
        parameters: [{
          kind: 'query', name: 'page', index: 0, type: { kind: 'number', name: 'number' },
          required: false, default: 1,
        }],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new ZodSchemaGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('.default(1)')
  })

  it('handles enum types', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute({
        method: 'post',
        path: '/',
        fullPath: '/test',
        handlerName: 'create',
        parameters: [{
          kind: 'body', name: 'body', index: 0,
          type: {
            kind: 'object', name: 'DTO',
            properties: {
              status: { kind: 'enum', name: 'status', enum: ['active', 'inactive'] },
            },
            required: ['status'],
          },
          required: true,
        }],
      })],
      guards: [],
      middleware: [],
    }

    const gen = new ZodSchemaGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain('z.enum')
  })

  it('generates import statement', () => {
    const apiDef: APIDefinition = {
      name: 'TestAPI',
      prefix: '/test',
      tags: [],
      routes: [makeRoute()],
      guards: [],
      middleware: [],
    }

    const gen = new ZodSchemaGenerator([apiDef])
    const code = gen.generate()
    expect(code).toContain("import { z } from 'zod'")
  })
})
