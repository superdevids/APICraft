# APICraft Development Guide

This guide covers everything you need to contribute to APICraft — from setting up your local environment to adding new adapters, generators, and middleware.

> **Prerequisite reading:** [README.md](../README.md) for an overview, [ARCHITECTURE.md](../ARCHITECTURE.md) for the system design, and [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution conventions.

---

## Table of Contents

1. [Development Environment Setup](#1-development-environment-setup)
2. [Cloning, Installing, and Building](#2-cloning-installing-and-building)
3. [Monorepo Structure Overview](#3-monorepo-structure-overview)
4. [Package Development Workflow](#4-package-development-workflow)
5. [Testing Guide](#5-testing-guide)
6. [Debugging Tips](#6-debugging-tips)
7. [Code Style Guidelines](#7-code-style-guidelines)
8. [Adding a New Adapter](#8-adding-a-new-adapter)
9. [Adding a New Generator](#9-adding-a-new-generator)
10. [Adding New Middleware](#10-adding-new-middleware)
11. [Git Workflow](#11-git-workflow)
12. [Pull Request Process](#12-pull-request-process)
13. [Release Process](#13-release-process)
14. [Common Tasks and Troubleshooting](#14-common-tasks-and-troubleshooting)

---

## 1. Development Environment Setup

### Prerequisites

| Tool | Minimum Version | Purpose |
|------|-----------------|---------|
| Node.js | 18.x LTS | JavaScript runtime |
| pnpm | 8.x | Package manager (monorepo workspaces) |
| Git | 2.x | Version control |
| TypeScript | 5.x (installed locally) | Type checking and compilation |

### Installing pnpm

APICraft uses [pnpm](https://pnpm.io/) workspaces to manage the monorepo. Install it globally:

```bash
# Via npm
npm install -g pnpm@8

# Via Corepack (recommended — bundled with Node 18+)
corepack enable
corepack prepare pnpm@8 --activate

# Verify
pnpm --version
```

### Enabling TypeScript Decorator Metadata

APICraft relies on `reflect-metadata` and legacy decorators. Your editor should pick up the root `tsconfig.json` automatically, but if you work on a standalone package, ensure these compiler options are set:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

---

## 2. Cloning, Installing, and Building

```bash
# 1. Clone the repository
git clone git@github.com:apicraft/apicraft.git
cd apicraft

# 2. Install all dependencies (links workspace packages automatically)
pnpm install

# 3. Build all packages (tsc -b compiles the project references graph)
pnpm build

# 4. Run the full test suite to verify the environment
pnpm test
```

### Useful Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx watch src/index.ts` | Start the dev server with hot reload |
| `build` | `tsc -b` | Build all packages using project references |
| `start` | `node dist/index.js` | Run the compiled production build |
| `test` | `vitest run --config tests/vitest.config.ts` | Run all tests once |
| `test:watch` | `vitest --config tests/vitest.config.ts` | Run tests in watch mode |
| `test:coverage` | `vitest run --coverage` | Run tests with V8 coverage |
| `lint` | `biome check .` | Lint all files with Biome |
| `lint:fix` | `biome check --apply .` | Auto-fix lint issues |
| `format` | `biome format --write .` | Format all files with Biome |

### Building a Single Package

```bash
# Build only the core package
pnpm --filter @apicraft/core build

# Build a specific adapter
pnpm --filter @apicraft/adapter-express build

# Build all generators
pnpm --filter "@apicraft/generator-*" build
```

---

## 3. Monorepo Structure Overview

```
apicraft/
├── packages/
│   ├── core/                 # @apicraft/core — decorators, metadata, validation, runtime
│   ├── cli/                  # @apicraft/cli — init, generate, serve, build commands
│   ├── create-apicraft/      # Scaffolding CLI (npx create-apicraft)
│   ├── adapters/             # Framework adapters
│   │   ├── express/          # @apicraft/adapter-express
│   │   ├── fastify/          # @apicraft/adapter-fastify
│   │   ├── hono/             # @apicraft/adapter-hono
│   │   ├── koa/              # @apicraft/adapter-koa
│   │   ├── next/             # @apicraft/adapter-next
│   │   └── nest/             # @apicraft/adapter-nest
│   ├── generators/           # Code generators
│   │   ├── openapi/          # @apicraft/generator-openapi
│   │   ├── client/           # @apicraft/generator-client
│   │   ├── react/            # @apicraft/generator-react
│   │   ├── zod/              # @apicraft/generator-zod
│   │   └── docs/             # @apicraft/generator-docs
│   └── middleware/           # Pluggable middleware
│       ├── cors/             # @apicraft/middleware-cors
│       ├── logger/           # @apicraft/middleware-logger
│       ├── auth/             # @apicraft/middleware-auth
│       ├── rate-limiter/     # @apicraft/middleware-rate-limiter
│       ├── compression/      # @apicraft/middleware-compression
│       └── helmet/           # @apicraft/middleware-helmet
├── tests/                    # Integration and unit tests
│   ├── core/                 # Core engine tests
│   ├── adapters/             # Adapter tests
│   ├── generators/           # Generator tests
│   ├── middleware/           # Middleware tests
│   ├── integration/          # Full-stack integration tests
│   ├── setup.ts              # Vitest setup file
│   └── vitest.config.ts      # Vitest configuration
├── examples/                 # Example applications
│   └── todo-app/             # Todo CRUD example
├── docs/                     # Documentation (this file)
├── src/                      # Root source (re-exports for dev)
├── apicraft.config.ts        # Project configuration
├── pnpm-workspace.yaml       # Workspace definition
├── tsconfig.json             # Root TypeScript config with path aliases
└── package.json              # Root package.json
```

### Dependency Graph

```
                    ┌──────────────────────────┐
                    │      @apicraft/cli        │
                    └──────────┬───────────────┘
                               │ depends on
                    ┌──────────▼───────────────┐
                    │      @apicraft/core       │
                    └──────────┬───────────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   Adapters      │  │   Generators    │  │   Middleware     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Rule:** The package graph must be a DAG — no circular dependencies. All packages may depend on `@apicraft/core`, but `@apicraft/core` depends on nothing except `zod` and `reflect-metadata`.

---

## 4. Package Development Workflow

Each package can be developed independently using pnpm's workspace filtering.

### Working on a Single Package

```bash
# Enter watch mode for the core package (recompiles on change)
cd packages/core
pnpm dev   # or: tsc --watch

# Run tests for just one package
pnpm --filter @apicraft/core test

# Run tests in watch mode for one package
pnpm --filter @apicraft/core test -- --watch
```

### Linking Local Packages

pnpm automatically symlinks workspace packages, so changes in `packages/core` are immediately visible to `packages/adapters/express`. You only need to rebuild after structural changes:

```bash
# After adding new exports to core, rebuild so dependent packages pick them up
pnpm --filter @apicraft/core build
pnpm --filter @apicraft/adapter-express build
```

### Adding a Dependency to a Package

```bash
# Add a runtime dependency to the express adapter
pnpm --filter @apicraft/adapter-express add express

# Add a dev dependency to core
pnpm --filter @apicraft/core add -D @types/express
```

---

## 5. Testing Guide

APICraft uses [Vitest](https://vitest.dev/) as its test framework. See [TESTING.md](./TESTING.md) for the complete guide.

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report (V8 provider)
pnpm test:coverage

# Run a specific test file
pnpm test -- tests/core/decorators.test.ts

# Run tests matching a pattern
pnpm test -- -t "should coerce string to number"
```

Test files live in the top-level `tests/` directory, organized by package:

| Directory | Contents |
|-----------|----------|
| `tests/core/` | Decorators, metadata, validation, app, errors, hooks, plugins, upload, websocket |
| `tests/adapters/` | Express, Fastify, Hono, Koa, Nest adapter tests |
| `tests/generators/` | OpenAPI, client, react, zod, docs generator tests |
| `tests/middleware/` | Auth, compression, CORS, helmet, logger, rate-limiter tests |
| `tests/integration/` | Full-stack and Todo API integration tests |

We aim for **80%+ code coverage**. All new features must include tests.

---

## 6. Debugging Tips

### Inspecting Decorator Metadata

Decorator metadata is stored via `Reflect.defineMetadata`. You can inspect it directly:

```typescript
import { API_METADATA_KEY, ROUTE_METADATA_KEY, PARAM_METADATA_KEY } from '@apicraft/core'

// Check API-level metadata
const apiDef = Reflect.getOwnMetadata(API_METADATA_KEY, UsersAPI)
console.log(apiDef) // { name: 'UsersAPI', prefix: '/users', tags: [...], routes: [...] }

// Check route metadata
const routes = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, UsersAPI.prototype)
console.log(routes) // [{ method: 'get', path: '/', handlerName: 'list', ... }]

// Check parameter metadata
const params = Reflect.getOwnMetadata(PARAM_METADATA_KEY, UsersAPI.prototype, 'getById')
console.log(params) // [{ kind: 'param', name: 'id', index: 0, ... }]
```

### Debugging the Request Pipeline

Add temporary logging to your handler to trace execution:

```typescript
@api('/debug')
class DebugAPI {
  @get('/')
  async test(@context() ctx: RequestContext) {
    console.log('Request:', ctx.request)
    console.log('State:', Object.fromEntries(ctx.state))
    console.log('User:', ctx.user)
    return { ok: true }
  }
}
```

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| `Reflect.getOwnMetadata` returns `undefined` | Missing `import "reflect-metadata"` at entry point | Add `import "reflect-metadata"` at the top of your `src/index.ts` |
| Decorator metadata not stored | Class decorator runs after method decorators | Ensure `@api()` is the outermost (top) class decorator |
| Adapter not found error | Adapter package not installed | Run `npm install @apicraft/adapter-express` |
| Tests fail with `MODULE_NOT_FOUND` | Packages not built | Run `pnpm build` before `pnpm test` |
| Type inference returns `String` for all params | `emitDecoratorMetadata` disabled in tsconfig | Enable `emitDecoratorMetadata: true` |
| `z.any()` returned for reference types | Schema not registered in `SchemaRegistry` | Call `SchemaRegistry.register('Name', schema)` before building |

---

## 7. Code Style Guidelines

### TypeScript

- **Strict mode** is enabled in all packages (`"strict": true`)
- **No implicit `any`** — use `unknown` and type guards
- **Explicit return types** on all public methods
- **JSDoc comments** for all public APIs
- **ES modules** — use `import`/`export`, not `require()`
- **Legacy decorators** with `experimentalDecorators: true` and `emitDecoratorMetadata: true` for `reflect-metadata` compatibility

### Linting and Formatting

APICraft uses [Biome](https://biomejs.dev/) for both linting and formatting (not ESLint/Prettier):

```bash
pnpm lint        # Check for issues
pnpm lint:fix    # Auto-fix issues
pnpm format      # Format all files
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `APICraftApp`, `DefinitionRegistry` |
| Interfaces | PascalCase | `RequestContext`, `APIDefinition` |
| Types | PascalCase | `HTTPMethod`, `TypeSchema` |
| Functions | camelCase | `defineConfig`, `buildZodSchema` |
| Variables | camelCase | `apiPrefix`, `routeHandler` |
| Constants | UPPER_SNAKE_CASE | `API_METADATA_KEY`, `ROUTE_KEY` |
| Files | kebab-case | `schema-builder.ts`, `rate-limiter.ts` |
| Packages | @scope/kebab-case | `@apicraft/adapter-express` |

### File Organization

- One class or interface per file (small related types may be grouped)
- Files organized by feature, not by type
- Barrel files (`index.ts`) re-export the public API

---

## 8. Adding a New Adapter

This step-by-step guide shows how to create a new framework adapter. We'll use a hypothetical "Polka" framework as an example.

### Step 1: Create the Package Structure

```
packages/adapters/polka/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Step 2: Configure `package.json`

```json
{
  "name": "@apicraft/adapter-polka",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@apicraft/core": "workspace:*",
    "polka": "^0.5.2"
  },
  "peerDependencies": {
    "polka": "^0.5.2"
  }
}
```

### Step 3: Implement the `Adapter` Interface

```typescript
// packages/adapters/polka/src/index.ts
import type {
  Adapter,
  APIDefinition,
  RequestContext,
  MiddlewareDefinition,
} from '@apicraft/core'
import { polka } from 'polka'

export class PolkaAdapter implements Adapter {
  readonly name = 'polka'
  private app = polka()

  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    _globalMiddleware: MiddlewareDefinition[],
  ): void {
    for (const api of apis) {
      for (const route of api.routes) {
        const key = `${route.fullPath}:${route.method}`
        const handler = handlers.get(key)
        if (!handler) continue

        const path = this.convertPath(route.fullPath) // :id format stays
        const method = route.method === 'del' ? 'delete' : route.method

        this.app[method](path, async (req, res) => {
          const ctx = this.createRequestContext(req, res)
          await handler(ctx)
          await this.sendResponse(ctx)
        })
      }
    }
  }

  createRequestContext(req: unknown, _res: unknown): RequestContext {
    const r = req as any
    return {
      request: {
        method: r.method,
        path: r.path,
        params: r.params ?? {},
        query: r.query ?? {},
        headers: r.headers ?? {},
        body: r.body ?? undefined,
        ip: r.socket?.remoteAddress ?? '127.0.0.1',
      },
      response: {
        statusCode: 200,
        headers: {},
        body: undefined,
      },
      state: new Map(),
      logger: console as any,
    }
  }

  async sendResponse(ctx: RequestContext): Promise<void> {
    const body = ctx.response.body
      ? JSON.stringify(ctx.response.body)
      : undefined
    return new Promise((resolve) => {
      const res = (ctx as any)._res
      res.writeHead(ctx.response.statusCode, {
        'Content-Type': 'application/json',
        ...ctx.response.headers,
      })
      res.end(body, () => resolve())
    })
  }

  async listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => resolve())
    })
  }

  async close(): Promise<void> {
    this.app.server?.close()
  }

  private convertPath(path: string): string {
    return path // Polka uses the same :param syntax as Express
  }
}

export function createAdapter(): PolkaAdapter {
  return new PolkaAdapter()
}
```

### Step 4: Register in Root Config

Add a path alias to the root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@apicraft/adapter-polka": ["./packages/adapters/polka/src/index.ts"]
    }
  }
}
```

### Step 5: Register in `APICraftApp`

Add the adapter name to the adapter map in `packages/core/src/app.ts`:

```typescript
const adapterMap: Record<string, string> = {
  express: '@apicraft/adapter-express',
  polka: '@apicraft/adapter-polka',  // ← add this
  // ...
}
```

### Step 6: Write Tests

Create `tests/adapters/polka.test.ts` following the patterns in `tests/adapters/express.test.ts`.

---

## 9. Adding a New Generator

Generators transform `APIDefinition[]` metadata into output artifacts.

### Step 1: Create the Package

```
packages/generators/graphql/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Step 2: Implement the Generator

```typescript
// packages/generators/graphql/src/index.ts
import type { APIDefinition, GeneratedFile } from '@apicraft/core'

export interface GraphQLGeneratorConfig {
  output?: string
  schemaOnly?: boolean
}

export class GraphQLGenerator {
  generate(definitions: APIDefinition[], config?: GraphQLGeneratorConfig): string {
    const types: string[] = ['type Query {']
    const mutations: string[] = ['type Mutation {']

    for (const api of definitions) {
      for (const route of api.routes) {
        const fieldName = this.toCamelCase(route.handlerName)
        const args = this.buildArgs(route)

        if (route.method === 'get') {
          types.push(`  ${fieldName}${args}: ${this.inferReturnType(route)}!`)
        } else {
          mutations.push(`  ${fieldName}${args}: ${this.inferReturnType(route)}!`)
        }
      }
    }

    types.push('}')
    mutations.push('}')

    return `${types.join('\n')}\n\n${mutations.join('\n')}\n`
  }

  async generateToFile(
    definitions: APIDefinition[],
    outputPath: string,
    config?: GraphQLGeneratorConfig,
  ): Promise<GeneratedFile> {
    const content = this.generate(definitions, config)
    return { path: outputPath, content, language: 'graphql' }
  }

  private buildArgs(route: { parameters: any[] }): string {
    const params = route.parameters
      .filter((p) => p.kind === 'param' || p.kind === 'query')
      .map((p) => `$${p.name}: ${this.mapType(p.type.kind)}`)
    return params.length > 0 ? `(${params.join(', ')})` : ''
  }

  private inferReturnType(_route: any): string {
    return 'JSON'
  }

  private mapType(kind: string): string {
    const map: Record<string, string> = {
      string: 'String!',
      number: 'Int!',
      boolean: 'Boolean!',
    }
    return map[kind] ?? 'String!'
  }

  private toCamelCase(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1)
  }
}

export function createGenerator(): GraphQLGenerator {
  return new GraphQLGenerator()
}
```

### Step 3: Register in the CLI

Add a new flag to the `generate` command in `packages/cli/src/index.ts`:

```typescript
program
  .command('generate')
  .option('--graphql', 'Generate GraphQL schema')
  .action(generateCommand)
```

---

## 10. Adding New Middleware

### Step 1: Create the Package

```
packages/middleware/request-id/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Step 2: Implement the `Middleware` Interface

```typescript
// packages/middleware/request-id/src/index.ts
import { randomUUID } from 'node:crypto'
import type { Middleware, RequestContext } from '@apicraft/core'

export class RequestIdMiddleware implements Middleware {
  constructor(private options: { headerName?: string } = {}) {}

  async before(ctx: RequestContext): Promise<void> {
    const headerName = this.options.headerName ?? 'X-Request-Id'
    const existingId = ctx.request.headers[headerName.toLowerCase()] as string | undefined
    const requestId = existingId ?? randomUUID()

    ctx.state.set('requestId', requestId)
    ctx.response.headers[headerName] = requestId
  }

  async after(_ctx: RequestContext): Promise<void> {}

  async onError(ctx: RequestContext, _error: Error): Promise<void> {
    const requestId = ctx.state.get('requestId')
    if (requestId) {
      ctx.response.headers['X-Request-Id'] = requestId as string
    }
  }
}

export function createRequestIdMiddleware(options?: { headerName?: string }): RequestIdMiddleware {
  return new RequestIdMiddleware(options)
}
```

### Step 3: Use It in an API

```typescript
import { api, get, use } from '@apicraft/core'
import { RequestIdMiddleware } from '@apicraft/middleware-request-id'

@api('/users')
@use(RequestIdMiddleware, { headerName: 'X-Request-Id' })
export class UsersAPI {
  @get('/')
  async list() {
    return { data: [] }
  }
}
```

### Step 4: Write Tests

Create `tests/middleware/request-id.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { RequestIdMiddleware } from '../../packages/middleware/request-id/src/index.js'

describe('RequestIdMiddleware', () => {
  it('generates a UUID when no header is present', async () => {
    const mw = new RequestIdMiddleware()
    const ctx: any = {
      request: { headers: {} },
      response: { headers: {} },
      state: new Map(),
    }
    await mw.before(ctx)
    const id = ctx.state.get('requestId')
    expect(id).toBeDefined()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })
})
```

---

## 11. Git Workflow

### Branch Strategy

We follow a simplified GitHub Flow:

| Branch | Purpose |
|--------|---------|
| `main` | Stable, always releasable |
| `feat/<feature-name>` | Feature development |
| `fix/<issue-name>` | Bug fixes |
| `docs/<description>` | Documentation-only changes |
| `release/v<version>` | Release preparation |

```bash
# Create a feature branch from main
git checkout -b feat/my-feature main

# Make changes and commit
git add .
git commit -m "feat(core): add support for custom serializers"

# Push and open a PR
git push origin feat/my-feature
```

### Commit Conventions (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies |
| `ci` | CI/CD changes |

**Scopes:**

| Scope | Package |
|-------|---------|
| `core` | `@apicraft/core` |
| `cli` | `@apicraft/cli` |
| `adapter:*` | `@apicraft/adapter-*` |
| `gen:*` | `@apicraft/generator-*` |
| `mw:*` | `@apicraft/middleware-*` |

**Examples:**

```
feat(core): add @patch decorator for HTTP PATCH support
fix(adapter:express): handle empty body in POST requests
docs(readme): add WebSocket example
test(core): add unit tests for DefinitionRegistry.scan
```

---

## 12. Pull Request Process

1. **Find or create an issue** — Track every contribution with an issue
2. **Discuss your approach** — For significant changes, comment on the issue first
3. **Fork and branch** — Create a feature branch from `main`
4. **Make changes** — Follow the coding standards above
5. **Write tests** — All new features need tests; bug fixes need regression tests
6. **Run the full suite:**

   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

7. **Commit** using Conventional Commits format
8. **Push** and open a PR against `main`
9. **Complete the PR template** with all required information
10. **Address review feedback** — Respond to comments and make requested changes

### PR Requirements

- All tests must pass
- Linting must pass with no errors
- TypeScript compilation must produce no errors
- New features must include tests
- Bug fixes must include a test that reproduces the bug
- Documentation must be updated for new features or API changes
- The PR must be focused on a single concern

### Review Process

1. A maintainer reviews within 1–3 business days
2. You may receive requests for changes
3. Once approved, a maintainer merges your PR

---

## 13. Release Process

For maintainers:

1. **Ensure `main` is green** — All CI checks passing
2. **Create a release branch:**

   ```bash
   git checkout -b release/v0.2.0
   ```

3. **Update version numbers** across packages
4. **Update `CHANGELOG.md`** with the new version entry
5. **Create a PR** from the release branch
6. **After approval and merge**, tag the release:

   ```bash
   git checkout main
   git pull
   git tag v0.2.0
   git push origin v0.2.0
   ```

7. **Publish packages:**

   ```bash
   pnpm publish -r
   ```

---

## 14. Common Tasks and Troubleshooting

### Regenerating the Lock File

```bash
rm pnpm-lock.yaml
pnpm install
```

### Cleaning Build Artifacts

```bash
# Remove all dist/ and tsbuildinfo files
Get-ChildItem -Path packages -Recurse -Include dist,*.tsbuildinfo -Force | Remove-Item -Recurse -Force
pnpm build
```

### Running an Example

```bash
cd examples/todo-app
pnpm install
pnpm dev
# Server running on http://localhost:3000
```

### Generating All Artifacts

```bash
# From the project root
npx apicraft generate --all --output ./generated
```

### Troubleshooting Quick Reference

| Symptom | Fix |
|---------|-----|
| `Cannot find module '@apicraft/core'` | Run `pnpm install` then `pnpm build` |
| Tests fail with decorator errors | Ensure `import "reflect-metadata"` is at the top of test files |
| `TypeError: X is not a constructor` | Check that the class is exported and imported correctly |
| Biome format conflicts | Run `pnpm format` before committing |
| Path alias not resolving | Verify `tsconfig.json` paths and rebuild |
| Hot reload not picking up changes | Restart `pnpm dev` or clear `node_modules/.cache` |

---

## Questions?

- **GitHub Issues:** [github.com/apicraft/apicraft/issues](https://github.com/apicraft/apicraft/issues)
- **GitHub Discussions:** [github.com/apicraft/apicraft/discussions](https://github.com/apicraft/apicraft/discussions)

We're here to help and appreciate your contributions!
