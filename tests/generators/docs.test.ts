import { describe, it, expect } from 'vitest'
import { DocUIGenerator } from '../../packages/generators/docs/src/index.js'

describe('DocUIGenerator', () => {
  const spec = {
    openapi: '3.1.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/test': {
        get: {
          summary: 'Test endpoint',
          responses: { '200': { description: 'Success' } },
        },
      },
    },
  }

  it('generates Scalar UI HTML', () => {
    const gen = new DocUIGenerator(spec)
    const html = gen.generateScalarUI()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Scalar UI')
    expect(html).toContain('@scalar/api-reference')
  })

  it('generates Swagger UI HTML', () => {
    const gen = new DocUIGenerator(spec)
    const html = gen.generateSwaggerUI()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Swagger UI')
    expect(html).toContain('swagger-ui-dist')
  })

  it('HTML contains CDN links', () => {
    const gen = new DocUIGenerator(spec)
    const scalarHtml = gen.generateScalarUI()
    expect(scalarHtml).toContain('cdn.jsdelivr.net')

    const swaggerHtml = gen.generateSwaggerUI()
    expect(swaggerHtml).toContain('cdn.jsdelivr.net')
  })

  it('HTML is self-contained', () => {
    const gen = new DocUIGenerator(spec)
    const html = gen.generate()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('OpenAPI spec is embedded in HTML', () => {
    const gen = new DocUIGenerator(spec)
    const html = gen.generate()
    expect(html).toContain('3.1.0')
    expect(html).toContain('Test API')
  })

  it('generate() returns Scalar UI by default', () => {
    const gen = new DocUIGenerator(spec)
    const result = gen.generate()
    expect(result).toContain('Scalar UI')
  })

  it('handles spec with servers array', () => {
    const specWithServers = {
      ...spec,
      servers: [{ url: 'https://api.example.com' }],
    }
    const gen = new DocUIGenerator(specWithServers)
    const html = gen.generate()
    expect(html).toContain('api.example.com')
  })
})
