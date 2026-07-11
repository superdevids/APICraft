# APICraft Testing Guide

This guide covers the testing strategy, patterns, and best practices for APICraft. Tests ensure that decorators store correct metadata, validation works as expected, adapters handle requests properly, and generators produce correct output.

> **Prerequisite reading:** [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines and [DEVELOPMENT.md](./DEVELOPMENT.md) for the development workflow.

---

## Table of Contents

1. [Test Framework: Vitest](#1-test-framework-vitest)
2. [Test Structure](#2-test-structure)
3. [Running Tests](#3-running-tests)
4. [Writing Unit Tests](#4-writing-unit-tests)
5. [Writing Integration Tests](#5-writing-integration-tests)
6. [Writing Generator Tests](#6-writing-generator-tests)
7. [Writing Adapter Tests](#7-writing-adapter-tests)
8. [Writing Middleware Tests](#8-writing-middleware-tests)
9. [Mocking Strategies](#9-mocking-strategies)
10. [Test Coverage Goals](#10-test-coverage-goals)
11. [CI/CD Test Integration](#11-cicd-test-integration)
12. [Comprehensive Example Test File](#12-comprehensive-example-test-file)

---

## 1. Test Framework: Vitest

APICraft uses [Vitest](https://vitest.dev/) for all testing. Vitest was chosen because:

- **Fast** — Uses Vite's transform pipeline, fast cold starts
- **ESM-native** — First-class ES module support (APICraft is ESM-only)
- **Jest-compatible API** — `describe`, `it`, `expect`, `vi` for mocking
- **TypeScript support** — No transpilation needed
- **Built-in coverage** — V8 coverage provider out of the box
- **Watch mode** — Fast incremental test re-runs

### Vitest Configuration

The test configuration lives at `tests/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,              // Use global describe/it/expect
    environment: 'node',        // Node.js environment
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
    },
    server: {
      deps: {
        inline: ['reflect-metadata', 'zod'],
      },
    },
    optimizeDeps: {
      include: ['reflect-metadata', 'zod'],
    },
    ssr: {
      noExternal: [
        'reflect-metadata', 'zod',
        '@apicraft/core',
        '@apicraft/adapter-express',
        '@apicraft/middleware-auth',
      ],
    },
  },
})
```

### Setup File

`tests/setup.ts` runs before all tests:

```typescript
import { beforeAll, afterAll } from 'vitest'

beforeAll(() => {
  // Global setup — e.g., initialize test database
})

afterAll(() => {
  // Global teardown — e.g., close connections
})
```

---

## 2. Test Structure

Tests are organized in the top-level `tests/` directory, mirroring the package structure:

```
tests/
├── core/                # @apicraft/core tests
│   ├── app.test.ts          # APICraftApp integration
│   ├── decorators.test.ts   # All decorators (@api, @get, @param, etc.)
│   ├── errors.test.ts       # APIError, ValidationError, etc.
│   ├── hooks.test.ts        # LifecycleManager and hooks
│   ├── metadata.test.ts     # DefinitionRegistry
│   ├── plugins.test.ts      # PluginManager
│   ├── upload.test.ts       # FileValidator, validateUploadedFile
│   ├── validation.test.ts   # ValidationEngine, buildZodSchema, coercion
│   └── websocket.test.ts    # WebSocketEngine, RoomManager
├── adapters/            # Adapter tests
│   ├── express.test.ts
│   ├── fastify.test.ts
│   ├── hono.test.ts
│   ├── koa.test.ts
│   └── nest.test.ts
├── generators/          # Generator tests
│   ├── client.test.ts       # Client SDK generator
│   ├── docs.test.ts         # Documentation UI generator
│   ├── openapi.test.ts      # OpenAPI 3.1 generator
│   ├── react.test.ts        # React Query hooks generator
│   └── zod.test.ts          # Zod schema generator
├── middleware/          # Middleware tests
│   ├── auth.test.ts
│   ├── compression.test.ts
│   ├── cors.test.ts
│   ├── helmet.test.ts
│   ├── logger.test.ts
│   └── rate-limiter.test.ts
├── integration/         # Full-stack integration tests
│   ├── full-stack.test.ts
│   └── todo-api.test.ts
├── setup.ts             # Global test setup
└── vitest.config.ts     # Vitest configuration
```

### Test File Naming

- All test files use the `.test.ts` extension
- One test file per module/class being tested
- Test file names match the source module name (e.g., `validation.ts` → `validation.test.ts`)

---

## 3. Running Tests

### Commands

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file change)
pnpm test:watch

# Run tests with V8 coverage report
pnpm test:coverage

# Run a specific test file
pnpm test -- tests/core/decorators.test.ts

# Run tests matching a name pattern
pnpm test -- -t "should coerce string to number"

# Run tests for a specific package
pnpm --filter @apicraft/core test
```

### Coverage Report

```bash
pnpm test:coverage
```

Output includes:

- **Text** — Console summary table with per-file coverage
- **JSON** — `coverage/coverage-summary.json` (for CI gates)
- **HTML** — `coverage/index.html` (detailed line-by-line view)

---

## 4. Writing Unit Tests

Unit tests verify individual functions and classes in isolation.

### Testing Decorators

Decorator tests verify that metadata is stored correctly via `Reflect.defineMetadata`. Always start test files with `import 'reflect-metadata'`.

```typescript
import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { api, get, post, param, query as queryDec, body } from '../../packages/core/src/decorators/index.js'
import { API_METADATA_KEY, ROUTE_METADATA_KEY, PARAM_METADATA_KEY } from '../../packages/core/src/metadata/index.js'

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

    @get('/:id')
    getById(@param('id') id: string) {}
  }

  it('@get stores correct method and path', () => {
    const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
    const listRoute = routes.find((r: any) => r.handlerName === 'list')
    expect(listRoute.method).toBe('get')
    expect(listRoute.path).toBe('/')
  })

  it('@param stores parameter metadata', () => {
    const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, UsersAPI.prototype, 'getById')
    const idParam = params.find((p: any) => p.name === 'id')
    expect(idParam.kind).toBe('param')
    expect(idParam.index).toBe(0)
    expect(idParam.required).toBe(true)
  })
})
```

### Testing Validation

```typescript
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ValidationEngine } from '../../packages/core/src/validation/index.js'
import { ValidationError } from '../../packages/core/src/errors.js'

describe('ValidationEngine.validate', () => {
  it('validates data against a Zod schema', () => {
    const schema = z.object({ name: z.string() })
    const result = ValidationEngine.validate(schema, { name: 'Alice' }, 'test')
    expect(result).toEqual({ name: 'Alice' })
  })

  it('throws ValidationError for invalid data', () => {
    const schema = z.object({ name: z.string() })
    expect(() => ValidationEngine.validate(schema, { name: 123 }, 'test')).toThrow(ValidationError)
  })
})

describe('ValidationEngine.coerceType', () => {
  it('coerces string to number', () => {
    expect(ValidationEngine.coerceType('42', 'number')).toBe(42)
  })

  it('coerces string to boolean', () => {
    expect(ValidationEngine.coerceType('true', 'boolean')).toBe(true)
    expect(ValidationEngine.coerceType('1', 'boolean')).toBe(true)
    expect(ValidationEngine.coerceType('false', 'boolean')).toBe(false)
    expect(ValidationEngine.coerceType('0', 'boolean')).toBe(false)
  })

  it('throws on invalid number coercion', () => {
    expect(() => ValidationEngine.coerceType('abc', 'number')).toThrow()
  })
})
```

### Testing Metadata Registry

```typescript
import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { DefinitionRegistry } from '../../packages/core/src/metadata/index.js'
import { api, get } from '../../packages/core/src/decorators/index.js'

describe('DefinitionRegistry', () => {
  it('registerAPI and getAPIDefinition round-trip', () => {
    const registry = DefinitionRegistry.getInstance()

    @api('/test-roundtrip', { tags: ['rt'] })
    class RoundtripAPI {}

    const def = registry.getAPIDefinition(RoundtripAPI)
    expect(def).toBeDefined()
    expect(def!.prefix).toBe('/test-roundtrip')
    expect(def!.tags).toEqual(['rt'])
  })

  it('scan returns complete API definitions', () => {
    const registry = DefinitionRegistry.getInstance()

    @api('/scanned', { tags: ['scan'] })
    class ScannedAPI {
      @get('/')
      list() {}
    }

    const results = registry.scan([ScannedAPI])
    expect(results).toHaveLength(1)
    expect(results[0].prefix).toBe('/scanned')
    expect(results[0].routes).toHaveLength(1)
    expect(results[0].routes[0].handlerName).toBe('list')
  })
})
```

---

## 5. Writing Integration Tests

Integration tests verify full request/response cycles through the adapter layer.

```typescript
import 'reflect-metadata'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import { ExpressAdapter } from '../../packages/adapters/express/src/index.js'

describe('ExpressAdapter Integration', () => {
  it('creates a working Express app', () => {
    const adapter = new ExpressAdapter()
    expect(adapter.name).toBe('express')
    expect(adapter.app).toBeDefined()
  })

  it('can register routes with handlers', async () => {
    const adapter = new ExpressAdapter()
    const handler = async () => ({ ok: true })

    adapter.registerRoute('/health', {
      method: 'get',
      path: '/health',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })

    await adapter.start(0)
    expect(adapter).toBeDefined()
    await adapter.close()
  })
})
```

### Testing with `APICraftApp`

Use a mock adapter to test the application pipeline without starting a real server:

```typescript
import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { APICraftApp } from '../../packages/core/src/app.js'
import { api, get, post } from '../../packages/core/src/decorators/index.js'
import type { APICraftConfig, RequestContext } from '../../packages/core/src/types/index.js'

function createMockAdapter() {
  return {
    name: 'test',
    registerRoutes: vi.fn(),
    createRequestContext: vi.fn(),
    sendResponse: vi.fn(),
    listen: vi.fn(),
    close: vi.fn(),
  }
}

describe('APICraftApp.create()', () => {
  it('creates an app with a custom adapter', () => {
    const adapter = createMockAdapter()
    const config: APICraftConfig = {
      title: 'Test API',
      version: '1.0.0',
      adapter,
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
    const adapter = createMockAdapter()
    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      hooks: {},
    }
    const app = APICraftApp.create({
      title: 'Test',
      version: '1.0.0',
      adapter,
      plugins: [plugin],
    })
    const pm = app.getPluginManager()
    expect(pm.getPlugin('test-plugin')).toBeDefined()
    app.close()
  })
})
```

---

## 6. Writing Generator Tests

Generator tests verify that each generator produces correct output from API definitions.

```typescript
import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { OpenAPIGenerator } from '../../packages/generators/openapi/src/index.js'
import { DefinitionRegistry } from '../../packages/core/src/metadata/index.js'
import { api, get, post, param, body } from '../../packages/core/src/decorators/index.js'

describe('OpenAPIGenerator', () => {
  it('generates valid OpenAPI 3.1 document', () => {
    @api('/users', { tags: ['Users'] })
    class UsersAPI {
      @get('/')
      list() {}

      @get('/:id')
      getById(@param('id') id: string) {}

      @post('/')
      create(@body() body: any) {}
    }

    const registry = DefinitionRegistry.getInstance()
    const definitions = registry.scan([UsersAPI])
    const generator = new OpenAPIGenerator()
    const spec = generator.generate(definitions, {
      title: 'Test API',
      version: '1.0.0',
    }) as any

    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Test API')
    expect(spec.paths).toHaveProperty('/users')
    expect(spec.paths).toHaveProperty('/users/{id}')
  })

  it('includes security schemes for guarded routes', () => {
    // ... test with @guard decorator
  })
})
```

### Testing Zod Schema Generation

```typescript
import { describe, it, expect } from 'vitest'
import { buildZodSchema } from '../../packages/core/src/validation/schema-builder.js'
import type { TypeSchema } from '../../packages/core/src/types/index.js'

describe('buildZodSchema', () => {
  it('builds string schema', () => {
    const schema = buildZodSchema({ kind: 'string', name: 'string' })
    expect(schema.safeParse('hello').success).toBe(true)
    expect(schema.safeParse(123).success).toBe(false)
  })

  it('builds object schema with required fields', () => {
    const ts: TypeSchema = {
      kind: 'object',
      name: 'User',
      properties: { name: { kind: 'string', name: 'string' } },
      required: ['name'],
    }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(false)
  })

  it('handles string constraints', () => {
    const ts: TypeSchema = {
      kind: 'string', name: 'string',
      zodInfo: { min: 3, max: 10, pattern: '^[a-z]+$' },
    }
    const schema = buildZodSchema(ts)
    expect(schema.safeParse('abc').success).toBe(true)
    expect(schema.safeParse('ab').success).toBe(false)
    expect(schema.safeParse('ABCD').success).toBe(false)
  })
})
```

---

## 7. Writing Adapter Tests

Adapter tests verify that each framework adapter correctly registers routes, creates request contexts, and sends responses.

```typescript
import 'reflect-metadata'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ExpressAdapter } from '../../packages/adapters/express/src/index.js'

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter

  beforeAll(() => {
    adapter = new ExpressAdapter()
  })

  it('has the correct name', () => {
    expect(adapter.name).toBe('express')
  })

  it('registers a GET route', () => {
    const handler = async () => ({ ok: true })
    adapter.registerRoute('/test', {
      method: 'get',
      path: '/test',
      handler,
      parameters: [],
      middleware: [],
      guards: [],
    })
    // Verify route was registered on the Express app
    expect(adapter.app._router).toBeDefined()
  })

  it('creates a RequestContext from Express req/res', () => {
    const mockReq = {
      method: 'GET',
      path: '/test',
      params: { id: '123' },
      query: { page: '1' },
      headers: { 'content-type': 'application/json' },
      body: null,
      ip: '127.0.0.1',
    }
    const ctx = adapter.createRequestContext(mockReq, {})
    expect(ctx.request.method).toBe('GET')
    expect(ctx.request.params.id).toBe('123')
    expect(ctx.request.query.page).toBe('1')
  })
})
```

---

## 8. Writing Middleware Tests

Middleware tests verify the `before`, `after`, and `onError` lifecycle methods.

```typescript
import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { RequestIdMiddleware } from '../../packages/middleware/request-id/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

function createMockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    request: {
      method: 'GET', path: '/', params: {}, query: {},
      headers: {}, body: undefined, ip: '127.0.0.1',
    },
    response: { statusCode: 200, headers: {}, body: undefined },
    state: new Map(),
    logger: console as any,
    ...overrides,
  }
}

describe('RequestIdMiddleware', () => {
  it('generates a UUID when no header is present', async () => {
    const mw = new RequestIdMiddleware()
    const ctx = createMockContext()
    await mw.before(ctx)

    const requestId = ctx.state.get('requestId')
    expect(requestId).toBeDefined()
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    expect(ctx.response.headers['X-Request-Id']).toBeDefined()
  })

  it('uses existing header when present', async () => {
    const mw = new RequestIdMiddleware()
    const ctx = createMockContext({
      request: {
        method: 'GET', path: '/', params: {}, query: {},
        headers: { 'x-request-id': 'existing-id' },
        body: undefined, ip: '127.0.0.1',
      },
      response: { statusCode: 200, headers: {}, body: undefined },
      state: new Map(),
      logger: console as any,
    })
    await mw.before(ctx)
    expect(ctx.state.get('requestId')).toBe('existing-id')
  })
})
```

### Testing Auth Guards

```typescript
import { describe, it, expect } from 'vitest'
import { JWTAuthGuard } from '../../packages/middleware/auth/src/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

describe('JWTAuthGuard', () => {
  it('rejects requests without Authorization header', async () => {
    const guard = new JWTAuthGuard({ secret: 'test-secret' })
    const ctx: any = {
      request: { headers: {} },
      response: { statusCode: 0, headers: {}, body: undefined },
      state: new Map(),
    }
    const result = await guard.authenticate(ctx)
    expect(result).toBe(false)
  })

  it('accepts valid JWT tokens', async () => {
    const guard = new JWTAuthGuard({ secret: 'test-secret' })
    const token = jwt.sign({ id: '1', roles: ['user'] }, 'test-secret')
    const ctx: any = {
      request: { headers: { authorization: `Bearer ${token}` } },
      response: { statusCode: 0, headers: {}, body: undefined },
      state: new Map(),
    }
    const result = await guard.authenticate(ctx)
    expect(result).toBe(true)
    expect(ctx.user).toBeDefined()
    expect(ctx.user.id).toBe('1')
  })
})
```

---

## 9. Mocking Strategies

### Mocking the Adapter

For unit tests that need `APICraftApp` without a real server, inject a mock adapter:

```typescript
const mockAdapter = {
  name: 'mock',
  registerRoutes: vi.fn(),
  createRequestContext: vi.fn().mockReturnValue({
    request: { method: 'GET', path: '/', params: {}, query: {}, headers: {}, body: undefined, ip: '127.0.0.1' },
    response: { statusCode: 200, headers: {}, body: undefined },
    state: new Map(),
    logger: console,
  }),
  sendResponse: vi.fn(),
  listen: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}
```

### Mocking Functions with `vi`

```typescript
import { vi } from 'vitest'

const mockFn = vi.fn()
mockFn.mockReturnValue(true)
mockFn.mockRejectedValue(new Error('fail'))

// Reset between tests
beforeEach(() => {
  vi.clearAllMocks()
})
```

### Creating Mock Contexts

Create a helper to build `RequestContext` mocks:

```typescript
function createMockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    request: {
      method: 'GET',
      path: '/',
      params: {},
      query: {},
      headers: {},
      body: undefined,
      ip: '127.0.0.1',
    },
    response: { statusCode: 200, headers: {}, body: undefined },
    state: new Map(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  }
}
```

---

## 10. Test Coverage Goals

We aim for **80%+ code coverage** across all packages.

### Running Coverage

```bash
pnpm test:coverage
```

### Coverage Configuration

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['packages/*/src/**/*.ts'],
}
```

### What to Test

| Component | What to Cover |
|-----------|---------------|
| **Decorators** | All class, method, and parameter decorators store correct metadata |
| **Validation** | Type coercion (success + error cases), Zod schema building for all `TypeSchema` kinds |
| **Errors** | Each error class has correct status code, code, and `toJSON()` output |
| **Metadata** | `DefinitionRegistry` registration, retrieval, and `scan()` merging logic |
| **App** | Adapter resolution, plugin initialization, guard execution, throttle enforcement |
| **Generators** | Output structure and content for each generator |
| **Adapters** | Route registration, request context creation, response sending |
| **Middleware** | `before`, `after`, `onError` lifecycle for each middleware |
| **Edge cases** | Empty inputs, invalid data, boundary values, concurrent access |

---

## 11. CI/CD Test Integration

### GitHub Actions

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install -g pnpm@8
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test:coverage
      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage below 80% — failing"
            exit 1
          fi
```

---

## 12. Comprehensive Example Test File

Here is a comprehensive test file demonstrating all major testing patterns:

```typescript
import 'reflect-metadata'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import {
  api, get, post, put, del, param, query as queryDec, body,
  response, guard, use, throttle, version,
} from '../../packages/core/src/decorators/index.js'
import {
  DefinitionRegistry,
  API_METADATA_KEY, ROUTE_METADATA_KEY, PARAM_METADATA_KEY,
} from '../../packages/core/src/metadata/index.js'
import { ValidationEngine } from '../../packages/core/src/validation/index.js'
import { buildZodSchema, SchemaRegistry } from '../../packages/core/src/validation/schema-builder.js'
import { CommonSchemas, createDTO } from '../../packages/core/src/validation/validators.js'
import { APIError, ValidationError, NotFoundError } from '../../packages/core/src/errors.js'
import type { Guard, Middleware, RequestContext } from '../../packages/core/src/types/index.js'

// ─── Mock implementations ───

class MockGuard implements Guard {
  async authenticate(_ctx: RequestContext): Promise<boolean> { return true }
  async onFailure(_ctx: RequestContext): Promise<void> {}
}

class MockMiddleware implements Middleware {
  async before(_ctx: RequestContext): Promise<void> {}
  async after(_ctx: RequestContext): Promise<void> {}
  async onError(_ctx: RequestContext, _error: Error): Promise<void> {}
}

// ─── Decorator tests ───

describe('Decorators', () => {
  describe('@api', () => {
    it('stores prefix and tags', () => {
      @api('/test', { tags: ['tag1'] })
      class TestAPI {}
      const def = Reflect.getOwnMetadata(API_METADATA_KEY, TestAPI)
      expect(def.prefix).toBe('/test')
      expect(def.tags).toEqual(['tag1'])
    })
  })

  describe('@throttle', () => {
    it('stores throttle config', () => {
      @api('/api')
      class T {
        @get('/')
        @throttle({ window: 60000, max: 10 })
        list() {}
      }
      const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, T.prototype)
      expect(routes[0].throttle).toEqual({ window: 60000, max: 10 })
    })
  })

  describe('@guard on class', () => {
    it('stores guard with api scope', () => {
      @api('/admin')
      @guard(MockGuard)
      class A {}
      const def = Reflect.getOwnMetadata(API_METADATA_KEY, A)
      expect(def.guards).toHaveLength(1)
      expect(def.guards[0].scope).toBe('api')
    })
  })
})

// ─── Validation tests ───

describe('Validation', () => {
  describe('coerceType', () => {
    it.each([
      ['42', 'number', 42],
      ['true', 'boolean', true],
      ['false', 'boolean', false],
      ['1', 'boolean', true],
      ['0', 'boolean', false],
    ])('coerces %s to %s', (value, type, expected) => {
      expect(ValidationEngine.coerceType(value, type as any)).toBe(expected)
    })

    it('throws on invalid number', () => {
      expect(() => ValidationEngine.coerceType('abc', 'number')).toThrow()
    })
  })

  describe('buildZodSchema', () => {
    it('handles reference kind via SchemaRegistry', () => {
      SchemaRegistry.register('User', z.object({ id: z.string() }))
      const schema = buildZodSchema({ kind: 'reference', name: 'User' })
      expect(schema.safeParse({ id: '1' }).success).toBe(true)
    })

    it('falls back to z.any() for unregistered reference', () => {
      SchemaRegistry.clear()
      const schema = buildZodSchema({ kind: 'reference', name: 'Unknown' })
      expect(schema.safeParse('anything').success).toBe(true)
    })
  })

  describe('CommonSchemas', () => {
    it('validates UUID', () => {
      expect(CommonSchemas.uuid.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
      expect(CommonSchemas.uuid.safeParse('not-a-uuid').success).toBe(false)
    })

    it('pagination has defaults', () => {
      expect(CommonSchemas.pagination.page.safeParse(undefined).data).toBe(1)
      expect(CommonSchemas.pagination.limit.safeParse(undefined).data).toBe(10)
    })
  })
})

// ─── Error tests ───

describe('Errors', () => {
  it('ValidationError has status 400', () => {
    const err = new ValidationError('Bad input')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
  })

  it('NotFoundError has status 404', () => {
    const err = new NotFoundError('Not found')
    expect(err.statusCode).toBe(404)
  })

  it('toJSON serializes error details', () => {
    const err = new APIError(400, 'Bad', 'BAD', [{ field: 'name' }])
    const json = err.toJSON()
    expect(json.error.statusCode).toBe(400)
    expect(json.error.details).toEqual([{ field: 'name' }])
  })
})

// ─── Registry tests ───

describe('DefinitionRegistry.scan', () => {
  it('merges class-level and route-level guards', () => {
    const registry = DefinitionRegistry.getInstance()

    @api('/protected')
    @guard(MockGuard)
    class ProtectedAPI {
      @get('/')
      @guard(MockGuard)
      list() {}
    }

    const defs = registry.scan([ProtectedAPI])
    const route = defs[0].routes[0]
    // Class-level guard + route-level guard
    expect(route.guards.length).toBeGreaterThanOrEqual(2)
  })
})
```

---

## Testing Checklist

Before submitting a PR, ensure:

- [ ] All existing tests pass (`pnpm test`)
- [ ] New code has unit tests
- [ ] Bug fixes include a regression test
- [ ] Edge cases are covered (empty, invalid, boundary values)
- [ ] Error paths are tested
- [ ] Coverage stays at or above 80%
- [ ] Tests run in isolation (no shared mutable state between tests)
- [ ] `import 'reflect-metadata'` is at the top of files that use decorators
- [ ] Mocks are reset between tests (`vi.clearAllMocks()` in `beforeEach`)
