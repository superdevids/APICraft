import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { api, get, post } from '../../packages/core/src/decorators/index.js'
import { DefinitionRegistry, ROUTE_METADATA_KEY } from '../../packages/core/src/metadata/index.js'
import { OpenAPIGenerator } from '../../packages/generators/openapi/src/index.js'
import { ClientSDKGenerator } from '../../packages/generators/client/src/index.js'
import { ReactQueryGenerator } from '../../packages/generators/react/src/index.js'
import { ZodSchemaGenerator } from '../../packages/generators/zod/src/index.js'
import { DocUIGenerator } from '../../packages/generators/docs/src/index.js'
import type { APIDefinition } from '../../packages/core/src/types/index.js'

@api('/products', { tags: ['products'] })
class ProductsAPI {
  @get('/')
  list() { return [] }

  @post('/')
  create() { return {} }
}

function getDefinitions(): APIDefinition[] {
  const registry = DefinitionRegistry.getInstance()
  const def = registry.getAPIDefinition(ProductsAPI)
  if (!def) return []

  const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, ProductsAPI.prototype) ?? []
  return [{
    ...def,
    routes: routes.map((r: any) => ({
      ...r,
      guards: [...(def.guards ?? []), ...(r.guards ?? [])],
      middleware: [...(def.middleware ?? []), ...(r.middleware ?? [])],
    })),
  }]
}

describe('Full Pipeline: definitions → generate → use generated code', () => {
  it('reads decorated class definitions', () => {
    const registry = DefinitionRegistry.getInstance()
    const apiDef = registry.getAPIDefinition(ProductsAPI)
    expect(apiDef).toBeDefined()
    expect(apiDef!.name).toBe('ProductsAPI')
    expect(apiDef!.prefix).toBe('/products')
    expect(apiDef!.tags).toEqual(['products'])
  })

  it('OpenAPI generator produces valid spec from definitions', () => {
    const defs = getDefinitions()
    expect(defs.length).toBeGreaterThan(0)
    const gen = new OpenAPIGenerator(defs, { title: 'Products API', version: '1.0.0' })
    const doc = gen.generate()
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('Products API')
    expect(Object.keys(doc.paths).length).toBeGreaterThanOrEqual(1)

    const json = gen.generateJSON()
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('Client SDK generator produces code from definitions', () => {
    const defs = getDefinitions()
    const gen = new ClientSDKGenerator(defs)
    const code = gen.generateFetchClient()
    expect(code).toContain('class APICraftClient')
    expect(code).toContain('class APIError')
    expect(code).toContain('getList')
    expect(code).toContain('postCreate')
  })

  it('React Query generator produces hooks from definitions', () => {
    const defs = getDefinitions()
    const gen = new ReactQueryGenerator(defs)
    const code = gen.generate()
    expect(code).toContain('useQuery')
    expect(code).toContain('useMutation')
    expect(code).toContain('useGetList')
    expect(code).toContain('usePostCreate')
    expect(code).toContain('@tanstack/react-query')
  })

  it('Zod schema generator produces valid schemas from definitions', () => {
    const defs = getDefinitions()
    const gen = new ZodSchemaGenerator(defs)
    const code = gen.generate()
    expect(code).toContain('import { z } from')
  })

  it('Docs generator produces HTML from OpenAPI spec', () => {
    const defs = getDefinitions()
    const openapi = new OpenAPIGenerator(defs, { title: 'Products API', version: '1.0.0' }).generate()
    const gen = new DocUIGenerator(openapi)
    const html = gen.generate()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Scalar UI')
    expect(html).toContain('Products API')
  })

  it('client SDK includes axios variant', () => {
    const defs = getDefinitions()
    const gen = new ClientSDKGenerator(defs)
    const code = gen.generateAxiosClient()
    expect(code).toContain('class APICraftAxiosClient')
    expect(code).toContain('import axios')
  })

  it('docs generator can produce Swagger UI', () => {
    const defs = getDefinitions()
    const openapi = new OpenAPIGenerator(defs, { title: 'Products API', version: '1.0.0' }).generate()
    const gen = new DocUIGenerator(openapi)
    const html = gen.generateSwaggerUI()
    expect(html).toContain('Swagger UI')
    expect(html).toContain('swagger-ui-dist')
  })
})
