# APICraft Architecture

This document describes the architectural design, component relationships, and data flow of the APICraft framework. It is intended for contributors, maintainers, and anyone interested in understanding how APICraft works under the hood.

---

## Overview

APICraft is a **decorator-driven, code-first REST API framework** for TypeScript. Its architecture follows a layered design with strict separation of concerns:

1. **Definition Layer** — Decorators capture API metadata at definition time
2. **Metadata Layer** — The `DefinitionRegistry` stores and indexes all metadata
3. **Pipeline Layer** — The runtime builds execution pipelines from metadata
4. **Adapter Layer** — Framework adapters translate APICraft primitives to specific HTTP libraries
5. **Generator Layer** — Code generators produce artifacts from metadata
6. **Plugin Layer** — Extensions hook into the lifecycle at every stage

```
┌─────────────────────────────────────────────────────────────────────┐
│                         APICraft Runtime                             │
│                                                                      │
│  ┌──────────────────┐    ┌─────────────────────────────────────┐    │
│  │  Definition       │    │       Generator Engine               │    │
│  │  Registry         │    │  ┌──────────┐ ┌──────────┐          │    │
│  │                   │    │  │ OpenAPI  │ │ Client   │          │    │
│  │  - Scan classes   │───→│  │ Generator│ │ Generator│          │    │
│  │  - Extract meta   │    │  └──────────┘ └──────────┘          │    │
│  │  - Validate       │    │  ┌──────────┐ ┌──────────┐          │    │
│  └──────────────────┘    │  │ React    │ │ Zod      │          │    │
│                          │  │ Generator│ │ Generator│          │    │
│  ┌──────────────────┐    │  └──────────┘ └──────────┘          │    │
│  │  Pipeline Builder │    │  ┌──────────┐                       │    │
│  │                   │    │  │ Docs     │                       │    │
│  │  - Middleware     │    │  │ Generator│                       │    │
│  │  - Guards         │    │  └──────────┘                       │    │
│  │  - Handlers       │    └─────────────────────────────────────┘    │
│  └──────────────────┘                                               │
│                          ┌─────────────────────────────────────┐    │
│  ┌──────────────────┐    │       Plugin System                  │    │
│  │  Adapter Layer    │    │                                      │    │
│  │                   │    │  onDefinitionScan → ┐                │    │
│  │  Express/Fastify  │    │  onRouteRegister   → │ Lifecycle     │    │
│  │  Hono/Koa         │    │  onGenerateOpenAPI → │ Hooks         │    │
│  │  Next.js/NestJS   │    │  onRequest         → │               │    │
│  │                   │    │  onResponse        → │               │    │
│  └──────────────────┘    │  onError           → ┘                │    │
│                          └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

APICraft is organized as a pnpm monorepo with packages grouped by function:

```
apicraft/
├── pnpm-workspace.yaml          # Workspace definition
├── tsconfig.json                # Root TypeScript config with path aliases
├── packages/
│   ├── core/                    # @apicraft/core — Runtime engine
│   │   ├── src/
│   │   │   ├── index.ts         # Barrel exports
│   │   │   ├── app.ts           # APICraftApp — main application class
│   │   │   ├── config.ts        # defineConfig — configuration helper
│   │   │   ├── errors.ts        # APIError, ValidationError, etc.
│   │   │   ├── metadata/        # DefinitionRegistry — metadata storage
│   │   │   ├── decorators/      # All TC39 decorators (@api, @get, etc.)
│   │   │   ├── validation/      # ValidationEngine, schema builder, coercers
│   │   │   ├── plugins/         # PluginManager — plugin lifecycle
│   │   │   ├── hooks/           # LifecycleManager — per-API hooks
│   │   │   ├── websocket/       # WebSocket engine and room manager
│   │   │   ├── upload/          # File upload handling
│   │   │   └── types/           # All TypeScript interfaces and types
│   │   └── package.json
│   │
│   ├── cli/                     # @apicraft/cli — Command-line tools
│   │   ├── src/
│   │   │   ├── index.ts         # Commander program setup
│   │   │   └── commands/        # init, generate, serve, build
│   │   └── package.json
│   │
│   ├── adapters/                # Framework adapters
│   │   ├── express/             # Express.js adapter
│   │   ├── fastify/             # Fastify adapter
│   │   ├── hono/                # Hono adapter
│   │   ├── koa/                 # Koa adapter
│   │   ├── next/                # Next.js App Router adapter
│   │   └── nest/                # NestJS adapter
│   │
│   ├── generators/              # Code generators
│   │   ├── openapi/             # OpenAPI 3.1 generator
│   │   ├── client/              # TypeScript client SDK generator
│   │   ├── react/               # React Query hooks generator
│   │   ├── zod/                 # Zod schema generator
│   │   └── docs/                # API documentation UI generator
│   │
│   └── middleware/              # Pluggable middleware and guards
│       ├── cors/                # CORS middleware
│       ├── logger/              # Request/response logger middleware
│       ├── auth/                # Authentication guards (JWT, API Key, Session)
│       ├── rate-limiter/        # Rate limiting middleware
│       ├── compression/         # Response compression middleware
│       └── helmet/              # Security headers middleware
│
├── examples/
│   └── todo-app/                # Example Todo API application
│
├── src/                         # Root source (re-exports for development)
├── docs/                        # Documentation resources
├── tests/                       # Integration tests
├── apicraft.config.ts           # Project configuration
├── package.json
└── README.md
```

### Dependency Graph

```
                    ┌──────────────────────────┐
                    │      @apicraft/cli        │
                    │  (init, generate, serve,  │
                    │        build)             │
                    └──────────┬───────────────┘
                               │ depends on
                    ┌──────────▼───────────────┐
                    │      @apicraft/core       │
                    │  (decorators, metadata,   │
                    │   validation, runtime)    │
                    └──────────┬───────────────┘
                               │ depends on
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│   Adapters      │  │   Generators    │  │   Middleware     │
│                 │  │                 │  │                 │
│ express, fastify│  │ openapi, client │  │ cors, logger     │
│ hono, koa      │  │ react, zod      │  │ auth, rate-limit │
│ next, nest     │  │ docs            │  │ compression,     │
│                 │  │                 │  │ helmet           │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Core Engine

### DefinitionRegistry

The `DefinitionRegistry` is a singleton that serves as the central metadata store. It uses `reflect-metadata` to store and retrieve decorator data on class prototypes.

```typescript
// packages/core/src/metadata/index.ts (conceptual)
class DefinitionRegistry {
  private static instance: DefinitionRegistry

  // Metadata key constants
  static readonly API_KEY = 'apicraft:api'
  static readonly ROUTE_KEY = 'apicraft:route'
  static readonly PARAM_KEY = 'apicraft:param'

  // Registration methods
  registerAPI(target: object, metadata: APIMetadata): void
  registerRoute(target: object, metadata: RouteMetadata): void
  registerParam(target: object, metadata: ParamMetadata): void

  // Query methods
  getAPIDefinition(target: object): APIMetadata | undefined
  getRouteDefinitions(target: object): RouteMetadata[]
  getParamDefinitions(target: object): ParamMetadata[]

  // Scan: the main entry point — converts raw metadata to full definitions
  scan(classes: Function[]): APIDefinition[]
}
```

**How scanning works:**

1. Iterate over each class in the provided array
2. Read `apicraft:api` metadata to get the API-level configuration (prefix, tags, guards, middleware)
3. Read `apicraft:route` metadata for each method to get HTTP method, path, and route-level decorators
4. Read `apicraft:param` metadata for each method parameter to get extraction rules
5. Resolve full paths by combining API prefix with route paths
6. Merge class-level and method-level guards and middleware
7. Return a complete `APIDefinition[]` array

```typescript
// Example output of registry.scan([UsersAPI])
[
  {
    name: 'UsersAPI',
    prefix: '/users',
    tags: ['Users'],
    description: 'User management API',
    routes: [
      {
        method: 'get',
        path: '/',
        fullPath: '/users',
        handlerName: 'list',
        parameters: [
          { kind: 'query', name: 'page', index: 0, type: ..., default: 1 }
        ],
        responseStatus: 200,
        guards: [],
        middleware: [],
      },
      {
        method: 'get',
        path: '/:id',
        fullPath: '/users/:id',
        handlerName: 'get',
        parameters: [
          { kind: 'param', name: 'id', index: 0, type: ... }
        ],
        responseStatus: 200,
        guards: [],
        middleware: [],
      },
      // ... more routes
    ],
    guards: [],
    middleware: [],
  }
]
```

### Decorator System

Decorators are the primary way users define APIs. Each decorator stores metadata using `Reflect.defineMetadata`.

**Class decorator pattern:**

```typescript
function api(prefix: string, options?: { tags?: string[]; description?: string }): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(
      DefinitionRegistry.API_KEY,
      { prefix, tags: options?.tags ?? [], description: options?.description },
      target
    )
  }
}
```

**Method decorator pattern:**

```typescript
function get(path: string): MethodDecorator {
  return (target, propertyKey) => {
    const routes = Reflect.getOwnMetadata(DefinitionRegistry.ROUTE_KEY, target.constructor) ?? []
    routes.push({ method: 'get', path, handlerName: propertyKey })
    Reflect.defineMetadata(DefinitionRegistry.ROUTE_KEY, routes, target.constructor)
  }
}
```

**Parameter decorator pattern:**

```typescript
function param(name: string, options?: { zod?: z.ZodTypeAny; required?: boolean; description?: string }): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const params = Reflect.getOwnMetadata(DefinitionRegistry.PARAM_KEY, target.constructor, propertyKey as string) ?? []
    params.push({ kind: 'param', name, index: parameterIndex, ...options })
    Reflect.defineMetadata(DefinitionRegistry.PARAM_KEY, params, target.constructor, propertyKey as string)
  }
}
```

All decorators are designed to be compositional — you can layer multiple decorators on a single method or class and they merge correctly.

### Pipeline Builder

When `APICraftApp` initializes, it builds an execution pipeline for each route. The pipeline is a chain of functions that process the request in sequence:

```
Request → Global Before Middleware → API Before Middleware → Route Before Middleware
  → Guards → Parameter Extraction → Validation → Handler → Response
  → Route After Middleware → API After Middleware → Global After Middleware
```

Each step in the pipeline is represented as a function:

```typescript
type PipelineStep = (ctx: RequestContext) => Promise<void>

class PipelineBuilder {
  buildPipeline(route: RouteDefinition, api: APIDefinition): PipelineStep[] {
    return [
      // Before middleware (in order: global → API → route)
      ...globalMiddleware.filter(m => m.before),
      ...api.middleware.filter(m => m.before),
      ...route.middleware.filter(m => m.before),

      // Guards
      ...api.guards,
      ...route.guards,

      // Parameter extraction and validation
      this.buildParameterExtractor(route.parameters),

      // Handler
      this.buildHandler(route.handlerName),

      // After middleware (in order: route → API → global)
      ...route.middleware.filter(m => m.after),
      ...api.middleware.filter(m => m.after),
      ...globalMiddleware.filter(m => m.after),
    ]
  }
}
```

---

## Adapter Architecture

Adapters are the bridge between APICraft's runtime and specific HTTP frameworks. Each adapter implements a common interface to register routes, handle requests, and send responses.

### Adapter Interface

```typescript
interface Adapter {
  /** Human-readable adapter name */
  readonly name: string

  /** Register all API routes with the framework */
  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    globalMiddleware: MiddlewareDefinition[]
  ): void

  /** Convert framework-native request to APICraft RequestContext */
  createRequestContext(req: any, res: any): RequestContext

  /** Send the response through the framework */
  sendResponse(ctx: RequestContext, res: any): void | Promise<void>

  /** Start the server */
  listen(port: number, host?: string): Promise<void>

  /** Stop the server */
  close(): Promise<void>
}
```

### Adapter Implementation Patterns

There are two implementation patterns used across adapters:

**Pattern 1: Self-contained pipeline (Express, Fastify, Koa)**

These adapters define their own `Pipeline`, `ParameterDefinition`, `RequestContext`, and middleware types. They do not depend on the core's runtime for request handling, giving them full control over the execution flow.

```typescript
// Example: Express adapter (conceptual)
class ExpressAdapter implements Adapter {
  private app = express()

  registerRoute(path: string, pipeline: Pipeline): void {
    const method = pipeline.method.toLowerCase()
    this.app[method](path, async (req, res, next) => {
      try {
        const ctx = this.createContext(req, res)
        for (const step of pipeline.guards) await step(ctx)
        for (const step of pipeline.middleware) await step(ctx)
        const args = this.extractParams(req, pipeline.parameters)
        const result = await pipeline.handler(...args)
        res.json(result)
      } catch (err) {
        next(err)
      }
    })
  }
}
```

**Pattern 2: Core adapter interface (Hono, Next.js, NestJS)**

These adapters implement the core `Adapter` interface directly and use the `APICraftApp`'s bound handlers. The core manages the pipeline, and the adapter focuses on translation between HTTP framework primitives and `RequestContext`.

```typescript
// Example: Hono adapter (conceptual)
class HonoAdapter implements Adapter {
  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    globalMiddleware: MiddlewareDefinition[]
  ): void {
    for (const api of apis) {
      for (const route of api.routes) {
        const key = `${route.method}:${route.fullPath}`
        const handler = handlers.get(key)

        this.app.on(route.method, route.fullPath, async (c) => {
          const ctx = this.createRequestContext(c, await this.parseBody(c))
          await handler(ctx)
          return this.sendResponse(ctx, c)
        })
      }
    }
  }
}
```

### Adding a New Adapter

To create a new adapter for a framework:

1. Create `packages/adapters/<name>/` with `package.json` and `src/index.ts`
2. Implement the `Adapter` interface (or the self-contained Pipeline pattern)
3. Export `createAdapter()` factory function
4. Register in the root `tsconfig.json` paths

---

## Generator Engine

Generators transform `APIDefinition[]` metadata into output artifacts. Each generator implements a standard interface.

### Generator Interface

```typescript
interface Generator {
  /** Generate artifact from API definitions */
  generate(definitions: APIDefinition[], config?: any): string | object

  /** Write generated artifact to file */
  generateToFile(definitions: APIDefinition[], outputPath: string, config?: any): Promise<void>
}
```

### Generator Pipeline

The generation pipeline is driven by the CLI's `generate` command:

```
APIDefinition[]
       │
       ▼
┌────────────────┐
│ OpenAPI         │ → openapi.json / openapi.yaml
│ Generator       │
└────────────────┘
       │
       ▼
┌────────────────┐
│ Client SDK      │ → client.ts / client-axios.ts
│ Generator       │
└────────────────┘
       │
       ▼
┌────────────────┐
│ React Query     │ → hooks.ts
│ Generator       │
└────────────────┘
       │
       ▼
┌────────────────┐
│ Zod Schemas     │ → schemas.ts
│ Generator       │
└────────────────┘
       │
       ▼
┌────────────────┐
│ Documentation   │ → scalar.html / swagger.html
│ UI Generator    │
└────────────────┘
```

### OpenAPI Generator

The `OpenAPIGenerator` builds an OpenAPI 3.1 document:

```typescript
class OpenAPIGenerator implements Generator {
  generate(definitions: APIDefinition[], config?: APICraftConfig): OpenAPI3_1Document {
    const spec: OpenAPI3_1Document = {
      openapi: '3.1.0',
      info: { title: config.title, version: config.version },
      paths: {},
      components: { schemas: {} },
    }

    for (const api of definitions) {
      for (const route of api.routes) {
        const path = this.convertPath(route.fullPath) // :id → {id}
        const operation = this.buildOperation(route, api)
        spec.paths[path] = spec.paths[path] ?? {}
        spec.paths[path][route.method] = operation
      }
    }

    return spec
  }

  private convertPath(path: string): string {
    return path.replace(/:(\w+)/g, '{$1}')
  }
}
```

Output methods: `generate()` returns the spec object, `generateJSON()` serializes to JSON, `generateYAML()` serializes to YAML via `js-yaml`.

### Client SDK Generator

The `ClientSDKGenerator` produces a standalone TypeScript client class:

- **Fetch client** (`generateFetchClient()`) — Uses the `fetch` API with typed methods
- **Axios client** (`generateAxiosClient()`) — Uses `axios` with typed methods

Each generated method includes:
- Path parameter interpolation
- Query string construction
- Request body serialization
- Error handling via a generated `APIError` class
- Full TypeScript return types

### React Query Generator

The `ReactQueryGenerator` produces React hooks using `@tanstack/react-query`:

- **GET routes** → `use<Name>Query()` using `useQuery`
- **POST/PUT/PATCH/DELETE routes** → `use<Name>Mutation()` using `useMutation`
- **Paginated GET routes** → `use<Name>InfiniteQuery()` using `useInfiniteQuery`
- Query key generation from route paths
- Automatic query invalidation on mutation success
- Singleton `setApiClient()` for client configuration

### Zod Schema Generator

The `ZodSchemaGenerator` produces `schemas.ts` with exported Zod schemas. It handles all `TypeSchema` kinds:

- `string` — `z.string()` with optional `.min()`, `.max()`, `.email()`, `.uuid()`, `.regex()`, `.datetime()`
- `number` — `z.number()` with optional `.min()`, `.max()`
- `boolean` — `z.boolean()`
- `enum` — `z.enum([...])`
- `array` — `z.array(inner)`
- `object` — `z.object({...})`
- `union` — `z.union([...])`
- `reference` — `z.lazy(() => ...)`

### Documentation UI Generator

The `DocUIGenerator` produces standalone HTML files that load either:

- **Scalar UI** (`generateScalarUI()`) — Modern, clean API documentation with dark mode and purple theme
- **Swagger UI** (`generateSwaggerUI()`) — Classic Swagger UI with try-it-out functionality

Both load the OpenAPI spec from a CDN-hosted URL and all rendering libraries from CDN, requiring no server-side rendering.

---

## Plugin System

The plugin system allows extensions to hook into APICraft's lifecycle at every stage.

### Plugin Interface

```typescript
interface APICraftPlugin {
  name: string
  version: string
  hooks: {
    onDefinitionScan?: (definitions: APIDefinition[]) => void
    onRouteRegister?: (route: RouteDefinition) => void
    onGenerateOpenAPI?: (spec: object) => void
    onRequest?: (ctx: RequestContext) => void | Promise<void>
    onResponse?: (ctx: RequestContext) => void | Promise<void>
    onError?: (ctx: RequestContext, error: Error) => void | Promise<void>
  }
  middleware?: MiddlewareDefinition[]
  decorators?: Record<string, (...args: any[]) => Decorator>
  generators?: Record<string, Generator>
}
```

### Plugin Manager

The `PluginManager` class manages the lifecycle of registered plugins:

```typescript
class PluginManager {
  register(plugin: APICraftPlugin): void     // Register (validates name + version, prevents duplicates)
  unregister(name: string): void              // Remove a plugin
  getPlugin(name: string): APICraftPlugin | undefined
  getAllPlugins(): APICraftPlugin[]

  // Triggers all hooks at the appropriate lifecycle stage
  triggerOnDefinitionScan(definitions: APIDefinition[]): void
  triggerOnRouteRegister(route: RouteDefinition): void
  triggerOnGenerateOpenAPI(spec: object): void
  triggerOnRequest(ctx: RequestContext): Promise<void>
  triggerOnResponse(ctx: RequestContext): Promise<void>
  triggerOnError(ctx: RequestContext, error: Error): Promise<void>
}
```

### Hook Execution Order

```
1. onDefinitionScan      — After all API definitions are scanned
2. onRouteRegister       — Before each route is registered with the adapter
3. onGenerateOpenAPI     — After OpenAPI spec is built (can modify spec)
4. onRequest             — Before each request handler runs
5. onResponse            — After successful response
6. onError               — When a handler throws
```

---

## Websocket Engine

APICraft includes a built-in WebSocket engine for real-time communication.

### WebSocket Handler Registration

```typescript
@ws('/chat')
class ChatHandler implements WebSocketHandler {
  async onConnect(ctx: WebSocketContext) {
    console.log(`Client ${ctx.id} connected`)
    ctx.broadcast({ type: 'user-joined', userId: ctx.id })
  }

  async onMessage(ctx: WebSocketContext, message: any) {
    const { room, text } = message
    ctx.to(room).send({ type: 'message', userId: ctx.id, text })
  }

  async onDisconnect(ctx: WebSocketContext) {
    ctx.broadcast({ type: 'user-left', userId: ctx.id })
  }
}
```

### WebSocket Engine

```typescript
class WebSocketEngine {
  register(pattern: string, handler: WebSocketHandler): void
  hasHandler(pattern: string): boolean
  getPatterns(): string[]

  handleConnection(ws: WebSocket, req: IncomingMessage, pattern: string, params: Record<string, string>): void
  getRoomManager(): WebSocketRoomManager
}
```

### Room Manager

```typescript
class WebSocketRoomManager {
  join(connectionId: string, connection: WebSocket, room: string): void
  leave(connectionId: string, room: string): void
  broadcast(room: string, data: any, exclude?: string[]): void
  getConnections(room: string): Map<string, WebSocket>
  removeConnection(connectionId: string): void
  getConnectionRooms(connectionId: string): string[]
}
```

### WebSocket Context

```typescript
interface WebSocketContext {
  readonly id: string
  readonly connection: WebSocket
  readonly url: string
  readonly params: Record<string, string>
  readonly query: Record<string, string>
  readonly headers: Record<string, string>
  user?: AuthenticatedUser
  room?: string
  readonly state: Map<string, unknown>

  send(data: any): void
  join(room: string): void
  leave(room: string): void
  to(room: string): { send: (data: any) => void }
  broadcast(data: any): void
}
```

---

## Data Flow

### Request Lifecycle (Detailed)

This is the complete sequence of operations when a request reaches an APICraft-powered server:

```
CLIENT
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 1. ADAPTER RECEIVES REQUEST                       │
│    - Framework (Express/Fastify/etc.) receives    │
│      HTTP request and invokes registered handler  │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 2. REQUEST CONTEXT CREATION                       │
│    - Adapter.buildContext(req, res) → RequestContext│
│    - Extracts: method, path, params, query,        │
│      headers, body, ip                              │
│    - Creates empty state Map                        │
│    - Sets up structured logger                      │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 3. PLUGIN onRequest HOOKS                         │
│    - PluginManager.triggerOnRequest(ctx)          │
│    - All registered plugins receive context       │
│    - Can modify ctx.state, ctx.user, etc.         │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 4. LIFECYCLE beforeRequest HOOKS                  │
│    - LifecycleManager.executeBeforeRequest(ctx)   │
│    - API-specific lifecycle callbacks             │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 5. GLOBAL BEFORE MIDDLEWARE                       │
│    - CORS middleware (sets headers, handles OPTIONS)│
│    - Helmet middleware (sets security headers)     │
│    - Logger middleware (logs incoming request)     │
│    - Compression middleware (prepares encodings)   │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 6. API-LEVEL BEFORE MIDDLEWARE                    │
│    - Middleware registered via @use() on the class │
│    - Rate limiter checks quota                     │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 7. ROUTE-LEVEL BEFORE MIDDLEWARE                  │
│    - Middleware registered via @use() on method    │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 8. AUTHENTICATION GUARDS                          │
│    - Guards registered via @guard()               │
│    - JWT Auth: verify token, set ctx.user         │
│    - API Key Auth: check key, set ctx.user        │
│    - Session Auth: look up session, set ctx.user  │
│    - On failure: respond 401, halt pipeline       │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 9. PARAMETER EXTRACTION                           │
│    - Path params: extract from ctx.request.params │
│    - Query params: extract from ctx.request.query │
│    - Body: extract from ctx.request.body          │
│    - Headers: extract from ctx.request.headers    │
│    - Context: pass ctx directly                   │
│    - Upload: extract file from multipart          │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 10. VALIDATION                                    │
│     - Validate each param against Zod schema      │
│     - Coerce types (string → number, etc.)        │
│     - On failure: throw ValidationError (400)      │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 11. HANDLER EXECUTION                             │
│     - Call route handler method with params       │
│     - Handler returns result object               │
│     - Set ctx.response.body = return value        │
│     - Set ctx.response.statusCode = result status │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 12. ROUTE-LEVEL AFTER MIDDLEWARE                  │
│     - Post-handler middleware runs                 │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 13. API-LEVEL AFTER MIDDLEWARE                    │
│     - Class-level post-handler middleware          │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 14. GLOBAL AFTER MIDDLEWARE                       │
│     - Compression: compress response body          │
│     - Logger: log response status + duration       │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 15. LIFECYCLE afterRequest HOOKS                  │
│     - LifecycleManager.executeAfterRequest(ctx)   │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 16. PLUGIN onResponse HOOKS                       │
│     - PluginManager.triggerOnResponse(ctx)        │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 17. ADAPTER SENDS RESPONSE                        │
│     - Adapter.sendResponse(ctx, res)              │
│     - Framework sends HTTP response to client     │
└──────────────────────────────────────────────────┘
  │
  ▼
CLIENT
```

### Error Handling Flow

When any step throws an error:

```
ERROR THROWN
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 1. ROUTE ERROR HANDLER                            │
│    - Try/catch around handler execution            │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 2. LIFECYCLE onError HOOKS                        │
│    - LifecycleManager.executeOnError(ctx, error)  │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 3. PLUGIN onError HOOKS                           │
│    - PluginManager.triggerOnError(ctx, error)     │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 4. ERROR MIDDLEWARE                               │
│    - Middleware.onError handlers run               │
│    - Logger logs the error                         │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 5. ERROR SERIALIZATION                            │
│    - APIError: serialize statusCode, code, details│
│    - Unknown error: serialize 500 Internal Server │
│    - Set ctx.response.body with error JSON        │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 6. ADAPTER SENDS ERROR RESPONSE                   │
│    - Send serialized error to client              │
└──────────────────────────────────────────────────┘
```

### Generation Pipeline (Detailed)

```
START: CLI command `apicraft generate --all`
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 1. LOAD CONFIG                                    │
│    - Load apicraft.config.ts                      │
│    - Resolve output directory (default: ./generated)│
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 2. SCAN DEFINITIONS                               │
│    - Import API classes from config.apis          │
│    - DefinitionRegistry.scan(classes)             │
│    - Returns APIDefinition[]                      │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 3. OPENAPI GENERATOR                              │
│    - OpenAPIGenerator.generate(definitions)       │
│    - Build paths, schemas, security               │
│    - Plugin.onGenerateOpenAPI hook                 │
│    - Write openapi.json + openapi.yaml            │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 4. CLIENT SDK GENERATOR                           │
│    - ClientSDKGenerator.generate(definitions)     │
│    - Build fetch client class                     │
│    - Build axios client class                     │
│    - Write client.ts + client-axios.ts            │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 5. REACT QUERY GENERATOR                          │
│    - ReactQueryGenerator.generate(definitions)    │
│    - Build hooks (useQuery, useMutation, etc.)    │
│    - Write hooks.ts                               │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 6. ZOD SCHEMA GENERATOR                           │
│    - ZodSchemaGenerator.generate(definitions)     │
│    - Build Zod schemas from TypeSchema            │
│    - Write schemas.ts                             │
└──────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 7. DOCS UI GENERATOR                              │
│    - DocUIGenerator.generate(openapiSpec)         │
│    - Build Scalar UI HTML                         │
│    - Build Swagger UI HTML                        │
│    - Write scalar.html + swagger.html             │
└──────────────────────────────────────────────────┘
  │
  ▼
DONE: All artifacts written to output directory
```

---

## Type System

APICraft uses a comprehensive type system to represent API metadata at runtime.

### Core Type Hierarchy

```
TypeSchema
├── kind: string | number | boolean | enum | array | object | union | reference
├── name?: string
├── format?: string
├── enum?: string[]
├── items?: TypeSchema            (for array kind)
├── properties?: Record<string, TypeSchema>  (for object kind)
├── required?: string[]           (for object kind)
├── members?: TypeSchema[]        (for union kind)
├── ref?: string                  (for reference kind)
├── minLength?: number
├── maxLength?: number
├── minimum?: number
├── maximum?: number
├── pattern?: string
├── zodInfo?: any
└── description?: string
```

### Type Extraction

Type information is extracted from TypeScript constructor parameter types at runtime using `reflect-metadata` and `Reflect.getMetadata('design:paramtypes', ...)`. This is then converted to the `TypeSchema` format for use by generators and validators.

### Validation Layers

APICraft implements a 4-layer validation strategy:

| Layer | When | What | How |
|-------|------|------|-----|
| 1. TypeScript | Compile time | Static type checks | TypeScript compiler |
| 2. Decorator | Definition time | Constraint metadata | Decorator options |
| 3. Zod | Runtime | Schema validation | `z.safeParse()` |
| 4. Business Logic | Runtime | Domain rules | Handler code |

---

## Security

### Authentication Guards

APICraft provides three built-in authentication guards that implement the `Guard` interface:

```typescript
interface Guard {
  authenticate(ctx: RequestContext): Promise<boolean>
  onFailure?(ctx: RequestContext): Promise<void>
}
```

| Guard | Authentication Method | Configuration |
|-------|----------------------|---------------|
| `JWTAuthGuard` | Bearer token from Authorization header | `secret`, `algorithms` |
| `APIKeyAuthGuard` | `x-api-key` header or `api_key` query param | `keys`, `headerName` |
| `SessionAuthGuard` | Cookie-based session ID | `store`, `cookieName`, `secret` |

### Security Headers

The `HelmetMiddleware` sets the following headers:

| Header | Default Value | Purpose |
|--------|---------------|---------|
| `Content-Security-Policy` | `default-src 'self'` | Prevents XSS and data injection |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enables XSS filter (legacy) |
| `Strict-Transport-Security` | `max-age=31536000` | Enforces HTTPS |
| `X-Permitted-Cross-Domain-Policies` | `none` | Restricts Adobe Flash/PDF cross-domain |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer header |

### Rate Limiting

The `RateLimiterMiddleware` uses a sliding window algorithm:

```typescript
interface RateLimiterConfig {
  window: number    // Time window in milliseconds (default: 60000)
  max: number       // Maximum requests per window (default: 60)
  keyGenerator?: (ctx: RequestContext) => string  // Custom key (default: IP)
  message?: string  // Custom error message
  statusCode?: number  // Custom status code (default: 429)
}
```

It sets headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

The store is pluggable via the `RateLimitStore` interface, with a default in-memory implementation that uses `Map<string, { count: number; reset: number }>` with automatic cleanup.

---

## Performance

### Caching Strategies

- **In-memory rate limit store** — Uses `Map` with periodic cleanup intervals to prevent memory leaks
- **Middleware processing** — Pipeline steps are composed at initialization time, not per-request, reducing runtime overhead
- **Compression** — Response compression (gzip, deflate, brotli) reduces payload size; compression level and threshold are configurable

### Compression Algorithms

The `CompressionMiddleware` supports three algorithms negotiated via `Accept-Encoding`:

| Algorithm | Library | Level Range | Best for |
|-----------|---------|-------------|----------|
| gzip | `zlib.createGzip()` | 1–9 (default: 6) | Widest browser support |
| deflate | `zlib.createDeflate()` | 1–9 (default: 6) | Legacy compatibility |
| brotli | `zlib.createBrotliCompress()` | 1–11 (default: 4) | Best compression ratio |

### Optimization Patterns

- **Definition scanning** occurs once at startup, not per request
- **Pipeline construction** is eager at initialization — no dynamic dispatch at runtime
- **Parameter extraction** uses pre-built extraction functions per route
- **Validation schemas** are compiled once per Zod schema definition
- **Generated clients** are tree-shakeable — unused endpoints can be eliminated by bundlers

---

## Validation System

The validation system lives in `packages/core/src/validation/` and provides:

### ValidationEngine

```typescript
class ValidationEngine {
  static validate<T>(schema: z.ZodType<T>, value: unknown, fieldName: string): T
  static validateQueryParams(schemas: Record<string, z.ZodTypeAny>, query: Record<string, string>): Record<string, any>
  static validatePathParam(name: string, value: string, schema?: z.ZodTypeAny): any
  static validateBody<T>(schema: z.ZodType<T>, body: unknown): T
  static coerceType(value: string, targetType: CoercionTargetType): unknown
  static buildSchemaFromType(typeSchema: TypeSchema): z.ZodTypeAny
}
```

### Schema Builder

The `buildZodSchema()` function converts a `TypeSchema` to a Zod schema at runtime. This is the core mechanism that enables code generation to produce Zod schemas from decorated metadata.

### Type Coercion

String values from HTTP requests are coerced to target types:

| Target Type | Coercion |
|------------|----------|
| `string` | Identity (no change) |
| `number` | `parseFloat()` or `parseInt()` for integers |
| `boolean` | `'true'` → `true`, `'false'` → `false`, `'1'` → `true`, `'0'` → `false` |
| `date` | `new Date(value)` |

---

## Configuration

APICraft uses a typed configuration system via `defineConfig()`:

```typescript
// apicraft.config.ts
import { defineConfig } from '@apicraft/core'

export default defineConfig({
  title: 'My API',
  version: '1.0.0',
  description: 'API description',
  apis: ['./src/apis/**/*.ts'],
  adapter: 'express',
  server: { port: 3000, host: '0.0.0.0' },
  openapi: { servers: [{ url: 'https://api.example.com' }], output: './generated' },
  client: { output: './generated', name: 'APICraftClient' },
  middleware: {
    cors: { origin: '*' },
    logger: { level: 'info', format: 'dev' },
    rateLimiter: { window: 60000, max: 60 },
    compression: { algorithm: 'gzip', threshold: 1024 },
    helmet: { contentSecurityPolicy: false },
  },
  plugins: [],
  auth: {
    jwt: { secret: process.env.JWT_SECRET },
  },
})
```

The `APICraftApp.create(config)` method accepts a partial config object and merges it with sensible defaults. Adapters referenced by name (e.g., `'express'`) are resolved via `require('@apicraft/adapter-express').createAdapter()`.

---

## Guard System

Guards implement authentication and authorization separately from business logic:

```typescript
interface Guard {
  /** Authenticate the request. Return false to reject. */
  authenticate(ctx: RequestContext): Promise<boolean>

  /** Optional: called when authentication fails. Default responds 401. */
  onFailure?(ctx: RequestContext): Promise<void>
}
```

Guards are applied via the `@guard()` decorator at the class or method level:

```typescript
@api('/admin')
@guard(JWTAuthGuard, { secret: process.env.JWT_SECRET })
export class AdminAPI {
  @get('/users')
  // This route requires JWT authentication via class-level guard
  async listUsers() { ... }

  @post('/impersonate')
  @guard(APIKeyAuthGuard, { keys: { 'admin-key': { role: 'superadmin' } } })
  // This route requires BOTH JWT and API key
  async impersonate() { ... }
}
```

When multiple guards are present, ALL must succeed (AND logic). If any guard fails, the request is rejected.

---

## Error Handling

APICraft provides a hierarchy of typed error classes:

```typescript
class APIError extends Error {
  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  )
  toJSON(): { message: string; statusCode: number; code?: string; details?: any }
}

class ValidationError extends APIError {
  constructor(message: string, details?: any)
  // statusCode: 400
}

class AuthenticationError extends APIError {
  constructor(message: string)
  // statusCode: 401
}

class NotFoundError extends APIError {
  constructor(message: string)
  // statusCode: 404
}
```

Errors propagate through the error handling pipeline (lifecycle hooks → plugin hooks → error middleware → serialization → response).

---

## Summary

APICraft's architecture prioritizes:

1. **Separation of concerns** — Metadata, runtime, adapters, generators, and plugins are independent packages
2. **Framework agnosticism** — Core logic is independent of any HTTP framework
3. **Type safety** — Full end-to-end typing from decorators through generated clients
4. **Extensibility** — Plugin system, custom adapters, and custom generators
5. **Performance** — Eager pipeline construction, lazy validation, tree-shakeable outputs
6. **Developer experience** — Minimal boilerplate, automatic code generation, watch mode

The monorepo structure ensures that each package has a single, well-defined responsibility, making the codebase maintainable and contributions accessible.
