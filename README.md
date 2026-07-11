# APICraft — Code-First API Framework

**Build REST APIs. Generate Everything. Never Write Boilerplate Again.**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![pnpm](https://img.shields.io/badge/package%20manager-pnpm-orange.svg)](https://pnpm.io/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-brightgreen)](https://nodejs.org/)

---

## Overview

APICraft is a **code-first REST API framework** for TypeScript. Define your API once using classes and decorators — and APICraft automatically generates:

- **OpenAPI 3.1 Spec** — Always up-to-date documentation
- **TypeScript Client SDK** — Type-safe API calls (fetch + axios)
- **React Query Hooks** — Data fetching with caching and mutations
- **Zod Schemas** — Reusable validation for frontend and backend
- **API Documentation UI** — Scalar UI and Swagger UI

### Why APICraft?

**The Problem:** Every REST endpoint requires 4+ separate artifacts (route handler, validation schema, OpenAPI spec, client SDK) that constantly go out of sync. Teams spend countless hours manually maintaining TypeScript types, updating documentation, and debugging mismatches between frontend expectations and backend responses.

**The Solution:** Define once. Generate everything. One source of truth.

```
@api('/users')     →  OpenAPI 3.1 Spec
class UsersAPI {   →  TypeScript Client SDK
  @get('/')        →  React Query Hooks
  @post('/')       →  Zod Schemas
  @put('/:id')     →  API Documentation UI
  @del('/:id')     →  Express / Fastify / Hono / Koa / Next.js / NestJS
}
```

APICraft is built on top of the TC39 Stage 3 decorator proposal, bringing true metadata-driven API development to TypeScript. Think of it as **tRPC for REST** — it combines end-to-end type safety with full REST compliance, making your API consumable by any HTTP client while keeping the developer experience as smooth as a typed RPC framework.

---

## Features

### Core Framework

| Feature | Description |
|---------|-------------|
| Decorator-based API Definition | `@api`, `@get`, `@post`, `@put`, `@patch`, `@del`, `@ws` |
| Parameter Decorators | `@param`, `@query`, `@body`, `@headers`, `@context`, `@upload` |
| Type Inference | Automatic TypeScript type extraction via reflect-metadata |
| 4-Layer Validation | TypeScript types + Decorator constraints + Zod runtime validation + Business logic |
| Guards | `@guard(JWTAuthGuard)` — JWT, API Key, Session authentication |
| Middleware | `@use(RateLimiter)` — per-class and per-route middleware |

### Auto-Generation

| Generator | Output | Description |
|-----------|--------|-------------|
| OpenAPI 3.1 | `openapi.json` / `openapi.yaml` | Full OpenAPI specification with schemas, paths, security |
| TypeScript Client | `client.ts` / `client-axios.ts` | Typed fetch and axios wrappers |
| React Query Hooks | `hooks.ts` | `useQuery`, `useMutation`, `useInfiniteQuery` |
| Zod Schemas | `schemas.ts` | Drop-in validation schemas |
| Documentation UI | `scalar.html` / `swagger.html` | Interactive API documentation |

### Adapters

APICraft supports multiple frameworks through a clean adapter interface. Each adapter handles routing, middleware integration, and request/response lifecycle within its own ecosystem.

| Adapter | Status | Package |
|---------|--------|---------|
| Express | Fully implemented | `@apicraft/adapter-express` |
| Fastify | Fully implemented | `@apicraft/adapter-fastify` |
| Hono | Fully implemented | `@apicraft/adapter-hono` |
| Koa | Fully implemented | `@apicraft/adapter-koa` |
| Next.js (App Router) | Fully implemented | `@apicraft/adapter-next` |
| NestJS | Fully implemented | `@apicraft/adapter-nest` |

### Built-in Middleware

| Middleware | Package | Description |
|-----------|---------|-------------|
| CORS | `@apicraft/middleware-cors` | Cross-Origin Resource Sharing with origin matching |
| Logger | `@apicraft/middleware-logger` | Structured logging (json, dev, combined formats) |
| JWT Auth | `@apicraft/middleware-auth` | JSON Web Token authentication guard |
| API Key Auth | `@apicraft/middleware-auth` | API key-based authentication guard |
| Session Auth | `@apicraft/middleware-auth` | Session-based authentication guard |
| Rate Limiter | `@apicraft/middleware-rate-limiter` | Request rate limiting (in-memory + pluggable store) |
| Compression | `@apicraft/middleware-compression` | Response compression (gzip, deflate, brotli) |
| Helmet | `@apicraft/middleware-helmet` | Security headers (CSP, HSTS, X-Frame-Options) |

### Advanced Features

- **WebSocket Support** — `@ws` decorator with room management, broadcasting, and connection lifecycle
- **File Upload** — `@upload` parameter decorator with size, type, and destination validation
- **Plugin System** — Extend APICraft with custom lifecycle hooks, middleware, and decorators
- **Lifecycle Hooks** — `beforeRequest`, `afterRequest`, `onError` at API-level granularity
- **API Versioning** — `@version('v2')` decorator for versioned namespacing
- **CLI Tools** — `init`, `generate`, `serve`, `build` commands for project scaffolding and development
- **Watch Mode** — File watching for automatic regeneration during development
- **Guard System** — Reusable authentication and authorization guards at class and method level

---

## Quick Start

### Installation

```bash
# Create a new project
npx apicraft init my-api
cd my-api
npm run dev
```

The `init` command scaffolds a complete project structure including `package.json`, `tsconfig.json`, configuration file, and a sample API with Express adapter.

### Manual Integration

```bash
npm install @apicraft/core @apicraft/adapter-express
```

### Define Your First API

```typescript
// src/apis/users.ts
import { api, get, post, put, del, param, body, query, response } from '@apicraft/core'

@api('/users', { tags: ['Users'], description: 'User management API' })
export class UsersAPI {
  private users = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ]

  @get('/')
  async list(@query('page', { default: 1 }) page: number) {
    return { data: this.users, total: this.users.length, page }
  }

  @get('/:id')
  async get(@param('id') id: string) {
    const user = this.users.find(u => u.id === id)
    if (!user) throw new NotFoundError('User not found')
    return user
  }

  @post('/')
  @response(201)
  async create(@body body: { name: string; email: string }) {
    const user = { id: String(this.users.length + 1), ...body }
    this.users.push(user)
    return user
  }

  @put('/:id')
  async update(@param('id') id: string, @body body: Partial<{ name: string; email: string }>) {
    const index = this.users.findIndex(u => u.id === id)
    if (index === -1) throw new NotFoundError('User not found')
    this.users[index] = { ...this.users[index], ...body }
    return this.users[index]
  }

  @del('/:id')
  async remove(@param('id') id: string) {
    const index = this.users.findIndex(u => u.id === id)
    if (index === -1) throw new NotFoundError('User not found')
    this.users.splice(index, 1)
    return { success: true }
  }
}
```

### Start the Server

```typescript
// src/index.ts
import { APICraftApp } from '@apicraft/core'
import { UsersAPI } from './apis/users'

const app = APICraftApp.create({
  apis: [UsersAPI],
  adapter: 'express',
  openapi: {
    title: 'My API',
    version: '1.0.0',
    description: 'A sample API built with APICraft',
  },
  middleware: {
    cors: { origin: '*' },
    logger: { level: 'info', format: 'dev' },
  },
})

app.listen(3000)
```

```bash
npx tsx src/index.ts

# Output:
#   APICraft server running on http://localhost:3000
#   API Documentation: http://localhost:3000/docs (Scalar UI)
#   OpenAPI Spec: http://localhost:3000/openapi.json
```

### Generate Client Code

```bash
# Generate all artifacts
npx apicraft generate --all

# Or selectively
npx apicraft generate --openapi --client --react

# Watch mode for development
npx apicraft generate --all --watch
```

Generated output:

```
generated/
├── openapi.json          # OpenAPI 3.1 specification (JSON)
├── openapi.yaml          # OpenAPI 3.1 specification (YAML)
├── client.ts             # Typed fetch-based client SDK
├── client-axios.ts       # Typed axios-based client SDK
├── hooks.ts              # React Query hooks (useQuery, useMutation)
├── schemas.ts            # Zod validation schemas
├── scalar.html           # Scalar API documentation UI
└── swagger.html          # Swagger UI documentation
```

---

## Architecture

APICraft is organized as a monorepo with strict separation of concerns:

```
packages/
├── core/                   # Runtime engine, decorators, metadata, validation
├── cli/                    # Command-line tools (init, generate, serve, build)
├── adapters/               # Framework adapters
│   ├── express/            # Express.js integration
│   ├── fastify/            # Fastify integration
│   ├── hono/               # Hono integration
│   ├── koa/                # Koa integration
│   ├── next/               # Next.js App Router integration
│   └── nest/               # NestJS integration
├── generators/             # Code generators
│   ├── openapi/            # OpenAPI 3.1 specification generator
│   ├── client/             # TypeScript client SDK generator
│   ├── react/              # React Query hooks generator
│   ├── zod/                # Zod schema generator
│   └── docs/               # API documentation UI generator
└── middleware/             # Pluggable middleware
    ├── cors/               # CORS middleware
    ├── logger/             # Request/response logger
    ├── auth/               # Authentication guards (JWT, API Key, Session)
    ├── rate-limiter/       # Rate limiting middleware
    ├── compression/        # Response compression
    └── helmet/             # Security headers
```

### Request Lifecycle

When a request arrives, APICraft processes it through a well-defined pipeline:

1. **Adapter receives request** — Framework-specific handler captures the incoming HTTP request
2. **Request context creation** — A `RequestContext` is built from framework-native request/response objects
3. **Plugin hooks** — `onRequest` hooks fire for all registered plugins
4. **Lifecycle hooks** — `beforeRequest` lifecycle hooks execute
5. **Global middleware (before)** — Global middleware like CORS and Helmet run
6. **API-level middleware (before)** — Class-level `@use` middleware run
7. **Route-level middleware (before)** — Method-level `@use` middleware run
8. **Guards** — Authentication guards (`@guard`) execute, setting `ctx.user` on success
9. **Parameter extraction** — Parameters are extracted and coerced from path, query, body, and headers
10. **Validation** — Zod schemas validate extracted parameters; `ValidationError` thrown on failure
11. **Handler execution** — The route handler method is called with validated parameters
12. **Response serialization** — The return value is set as `ctx.response.body`
13. **Route-level middleware (after)** — Post-handler middleware run
14. **API-level middleware (after)** — Class-level post-handler middleware run
15. **Global middleware (after)** — Global post-handler middleware run
16. **Lifecycle hooks** — `afterRequest` lifecycle hooks execute
17. **Plugin hooks** — `onResponse` hooks fire
18. **Adapter sends response** — The framework adapter serializes and sends the response

For complete architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Decorator Reference

### Class-Level Decorators

| Decorator | Example | Description |
|-----------|---------|-------------|
| `@api` | `@api('/users', { tags: ['Users'] })` | Defines an API resource with URL prefix |
| `@ws` | `@ws('/chat')` | Marks class as WebSocket handler |
| `@guard` | `@guard(JWTAuthGuard, { secret: '...' })` | Applies auth guard to all routes |
| `@use` | `@use(RateLimiter, { max: 10 })` | Attaches middleware to all routes |
| `@version` | `@version('v2')` | Sets API version prefix |

### Method-Level Decorators

| Decorator | Example | Description |
|-----------|---------|-------------|
| `@get` | `@get('/:id')` | HTTP GET endpoint |
| `@post` | `@post('/')` | HTTP POST endpoint |
| `@put` | `@put('/:id')` | HTTP PUT endpoint |
| `@patch` | `@patch('/:id')` | HTTP PATCH endpoint |
| `@del` | `@del('/:id')` | HTTP DELETE endpoint |
| `@response` | `@response(201, 'application/json')` | Custom response status and content type |
| `@throttle` | `@throttle({ window: 60000, max: 10 })` | Per-route rate limiting |

### Parameter Decorators

| Decorator | Example | Description |
|-----------|---------|-------------|
| `@param` | `@param('id', { description: 'User ID' })` | Path parameter |
| `@query` | `@query('page', { default: 1 })` | Query string parameter |
| `@body` | `@body(z.object({ name: z.string() }))` | Request body with optional Zod schema |
| `@headers` | `@headers('authorization')` | Specific or all request headers |
| `@context` | `@context()` | Full `RequestContext` object |
| `@upload` | `@upload('file', { maxSize: '5mb' })` | File upload parameter |

---

## Examples

| Example | Description | Location |
|---------|-------------|----------|
| Todo App | Simple CRUD API with Express adapter | `examples/todo-app/` |
| E-commerce API | Complex API with auth, products, orders | Coming soon |
| Next.js Integration | Next.js App Router integration | `packages/adapters/next/` |

### Todo App Quick Preview

The todo example demonstrates all CRUD operations with Zod validation and Express adapter:

```typescript
@api('/todos', { tags: ['Todos'] })
export class TodosAPI {
  private todos: Todo[] = []

  @get('/')
  async list(@query('status') status?: string) {
    if (status) return this.todos.filter(t => t.status === status)
    return this.todos
  }

  @get('/:id')
  async getById(@param('id') id: string) {
    const todo = this.todos.find(t => t.id === id)
    if (!todo) throw new NotFoundError('Todo not found')
    return todo
  }

  @post('/')
  @response(201)
  async create(@body(z.object({
    title: z.string().min(1),
    completed: z.boolean().optional().default(false),
  })) body: { title: string; completed?: boolean }) {
    const todo = { id: crypto.randomUUID(), ...body }
    this.todos.push(todo)
    return todo
  }
}
```

---

## Configuration

APICraft uses a typed configuration file (`apicraft.config.ts`) at your project root:

```typescript
import { defineConfig } from '@apicraft/core'

export default defineConfig({
  title: 'My API',
  version: '1.0.0',
  description: 'API description',
  apis: ['./src/apis/**/*.ts'],
  adapter: 'express',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  openapi: {
    servers: [{ url: 'https://api.example.com' }],
    output: './generated',
  },
  middleware: {
    cors: { origin: 'https://example.com' },
    logger: { level: 'info', format: 'json' },
  },
})
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern="users"
```

---

## Project Status

APICraft is currently in **alpha** (v0.1.0). The core feature set is implemented, including all decorators, six framework adapters, five code generators, six middleware packages, CLI tools, WebSocket support, file upload, plugin system, and lifecycle hooks. The API is subject to change before the 1.0.0 stable release.

### Roadmap

- **v0.1.x** — Stabilization, test coverage, documentation
- **v0.2.x** — Performance optimizations, streaming responses, GraphQL integration
- **v1.0.0** — Stable API, production-ready, migration guide

---

## Contributing

We welcome contributions from the community! Whether it's bug reports, feature requests, documentation improvements, or code changes, your help makes APICraft better for everyone.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Quick Start for Contributors

```bash
git clone git@github.com:apicraft/apicraft.git
cd apicraft
pnpm install
pnpm build
pnpm test
```

### Package Development

Each package in the monorepo can be developed independently:

```bash
# Work on a specific package
cd packages/core
pnpm dev

# Test all packages
pnpm -r test

# Build all packages
pnpm -r build
```

---

## License

APICraft is **100% open source** under the [MIT License](LICENSE).

All features — including decorators, generators, adapters, middleware, WebSocket engine, plugin system, and CLI — are completely free. No premium tiers, no hidden costs, no enterprise licenses required.

---

## Support

- **Documentation:** [apicraft.dev](https://apicraft.dev) (coming soon)
- **Issues:** [GitHub Issues](https://github.com/apicraft/apicraft/issues)
- **Discussions:** [GitHub Discussions](https://github.com/apicraft/apicraft/discussions) (coming soon)
- **Discord:** Join our community (coming soon)

---

## Acknowledgments

- Inspired by [tRPC](https://trpc.io/), [NestJS](https://nestjs.com/), and [Hono](https://hono.dev/)
- Built with [TypeScript](https://www.typescriptlang.org/), [Zod](https://zod.dev/), and [reflect-metadata](https://github.com/rbuckton/reflect-metadata)
- Documentation UI powered by [Scalar](https://scalar.com/) and [Swagger UI](https://swagger.io/tools/swagger-ui/)
- Thanks to all contributors and early adopters

---

<div align="center">
  <sub>Built with ❤️ by the APICraft team</sub>
</div>
