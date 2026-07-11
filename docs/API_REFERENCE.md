# APICraft API Reference

This document is the complete reference for every public API exported from `@apicraft/core` and related packages. It covers decorators, classes, functions, interfaces, types, constants, configuration, error handling, and CLI commands.

> **For architectural context**, see [ARCHITECTURE.md](../ARCHITECTURE.md). **For usage examples**, see [README.md](../README.md). **For development workflows**, see [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## Table of Contents

1. [Decorators](#1-decorators)
   - [Class-Level](#class-level-decorators)
   - [Method-Level](#method-level-decorators)
   - [Parameter-Level](#parameter-level-decorators)
2. [Classes](#2-classes)
3. [Functions](#3-functions)
4. [Interfaces](#4-interfaces)
5. [Types](#5-types)
6. [Constants](#6-constants)
7. [Configuration Reference](#7-configuration-reference)
8. [Error Handling Reference](#8-error-handling-reference)
9. [CLI Commands Reference](#9-cli-commands-reference)

---

## 1. Decorators

Decorators are the primary way to define APIs in APICraft. They store metadata at definition time using `reflect-metadata`, which is then read by `DefinitionRegistry.scan()` at startup.

### Class-Level Decorators

#### `@api(prefix, options?)`

Defines an API resource with a URL prefix and optional metadata.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `prefix` | `string` | Yes | URL prefix for all routes in this class (e.g. `'/users'`) |
| `options.tags` | `string[]` | No | OpenAPI tags for grouping routes |
| `options.description` | `string` | No | Human-readable description of the API |

**Returns:** `ClassDecorator`

```typescript
import { api, get } from '@apicraft/core'

@api('/users', { tags: ['Users'], description: 'User management API' })
export class UsersAPI {
  @get('/')
  async list() { return [] }
}
```

#### `@guard(GuardClass, options?)`

Applies an authentication guard to all routes in the class (when used as class decorator) or to a single route (when used as method decorator).

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `GuardClass` | `new (...args) => Guard` | Yes | Guard class implementing `Guard` interface |
| `options` | `Record<string, unknown>` | No | Configuration passed to the guard |

**Returns:** `ClassDecorator & MethodDecorator`

```typescript
import { api, get, guard } from '@apicraft/core'
import { JWTAuthGuard } from '@apicraft/middleware-auth'

@api('/admin')
@guard(JWTAuthGuard, { secret: process.env.JWT_SECRET })
export class AdminAPI {
  @get('/users')
  async listUsers() { return [] }
}
```

#### `@use(MiddlewareClass, options?)`

Attaches middleware to all routes in the class (class-level) or a single route (method-level).

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `MiddlewareClass` | `new (...args) => Middleware` | Yes | Middleware class implementing `Middleware` interface |
| `options` | `Record<string, unknown>` | No | Configuration passed to the middleware |

**Returns:** `ClassDecorator & MethodDecorator`

```typescript
import { api, get, use } from '@apicraft/core'
import { RateLimiterMiddleware } from '@apicraft/middleware-rate-limiter'

@api('/search')
@use(RateLimiterMiddleware, { max: 10, windowMs: 60000 })
export class SearchAPI {
  @get('/')
  async search() { return [] }
}
```

#### `@version(ver)`

Sets the API version prefix for versioned namespacing.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `ver` | `string` | Yes | Version string (e.g. `'v2'`) |

**Returns:** `ClassDecorator`

```typescript
@api('/users')
@version('v2')
export class UsersAPIV2 {
  @get('/')
  async list() { return [] }
}
```

#### `@ws(path)`

Marks a class as a WebSocket endpoint handler. The class should implement the `WebSocketHandler` interface.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | Yes | WebSocket URL path (e.g. `'/chat'`, `'/ws/:roomId'`) |

**Returns:** `ClassDecorator`

```typescript
import { ws } from '@apicraft/core'
import type { WebSocketHandler, WebSocketContext } from '@apicraft/core'

@ws('/chat')
export class ChatHandler implements WebSocketHandler {
  async onConnect(ctx: WebSocketContext) {
    ctx.join('general')
  }
  async onMessage(ctx: WebSocketContext, message: any) {
    ctx.broadcast(message)
  }
  async onDisconnect(ctx: WebSocketContext) {
    // cleanup
  }
}
```

---

### Method-Level Decorators

#### `@get(path)`

Registers an HTTP GET endpoint.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | Yes | Route path relative to the API prefix (e.g. `'/'`, `'/:id'`) |

**Returns:** `MethodDecorator`

```typescript
@get('/')
async list() { return [] }

@get('/:id')
async getById(@param('id') id: string) { return { id } }
```

#### `@post(path)`

Registers an HTTP POST endpoint.

```typescript
@post('/')
@response(201)
async create(@body body: { name: string }) {
  return { id: '1', ...body }
}
```

#### `@put(path)`

Registers an HTTP PUT endpoint.

```typescript
@put('/:id')
async update(@param('id') id: string, @body body: { name: string }) {
  return { id, ...body }
}
```

#### `@patch(path)`

Registers an HTTP PATCH endpoint.

```typescript
@patch('/:id')
async partialUpdate(@param('id') id: string, @body body: Partial<{ name: string }>) {
  return { id, ...body }
}
```

#### `@del(path)`

Registers an HTTP DELETE endpoint. (Named `del` because `delete` is a reserved word.)

```typescript
@del('/:id')
async remove(@param('id') id: string) {
  return { success: true }
}
```

#### `@response(statusCode, contentType?)`

Sets a custom response status code and content type for a route.

| Parameter | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `statusCode` | `number` | Yes | — | HTTP status code |
| `contentType` | `string` | No | `'application/json'` | Response content type |

**Returns:** `MethodDecorator`

```typescript
@post('/')
@response(201, 'application/json')
async create(@body body: any) { return body }
```

#### `@throttle(options)`

Applies per-route rate limiting using an in-memory sliding window.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `options.window` | `number` | Yes | Time window in milliseconds |
| `options.max` | `number` | Yes | Maximum requests per window |

**Returns:** `MethodDecorator`

```typescript
@get('/search')
@throttle({ window: 60000, max: 10 })
async search() { return [] }
```

When the limit is exceeded, the response is `429 Too Many Requests` with these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds until the limit resets |

---

### Parameter-Level Decorators

#### `@param(name, options?)`

Extracts a path parameter.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Path parameter name (must match `:name` in route path) |
| `options.zod` | `z.ZodTypeAny` | No | Zod schema for validation |
| `options.required` | `boolean` | No | Whether the parameter is required (default: `true`) |
| `options.description` | `string` | No | OpenAPI description |

**Returns:** `ParameterDecorator`

```typescript
@get('/:id')
async getById(@param('id', { description: 'User ID' }) id: string) {
  return { id }
}
```

#### `@query(name, options?)`

Extracts a query string parameter.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Query parameter name |
| `options.default` | `unknown` | No | Default value if parameter is missing |
| `options.zod` | `z.ZodTypeAny` | No | Zod schema for validation |
| `options.required` | `boolean` | No | Whether required (default: `true`) |
| `options.description` | `string` | No | OpenAPI description |

**Returns:** `ParameterDecorator`

```typescript
@get('/')
async list(@query('page', { default: 1 }) page: number) {
  return { page }
}
```

#### `@body(schema?)`

Extracts the request body. Optionally accepts a Zod schema for validation.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `schema` | `z.ZodTypeAny` | No | Zod schema for body validation |

**Returns:** `ParameterDecorator`

```typescript
@post('/')
async create(@body(z.object({ name: z.string(), email: z.string().email() })) body: { name: string; email: string }) {
  return body
}
```

When a Zod schema is provided, it is stored as `paramDef.zodSchema` and used by the validation engine to validate the incoming body.

#### `@headers(name?)`

Extracts request headers. If `name` is provided, extracts a single header; otherwise, extracts all headers as an object.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Specific header name (default: all headers) |

**Returns:** `ParameterDecorator`

```typescript
@get('/')
async list(@headers('authorization') auth: string) {
  return { auth }
}

@get('/all')
async allHeaders(@headers() headers: Record<string, string>) {
  return { headers }
}
```

#### `@context()`

Injects the full `RequestContext` object into the handler. Use this for access to request, response, state, logger, and user.

**Returns:** `ParameterDecorator`

```typescript
@get('/me')
async me(@context() ctx: RequestContext) {
  return { user: ctx.user, ip: ctx.request.ip }
}
```

#### `@upload(name, config?)`

Marks a parameter as a file upload with validation constraints.

| Parameter | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Form field name |
| `config.maxSize` | `string` | No | Maximum size (e.g. `'5mb'`, `'10kb'`, `'1gb'`) |
| `config.types` | `string[]` | No | Allowed MIME types (e.g. `['image/jpeg', 'image/png']`) |
| `config.destination` | `string` | No | Directory to save uploaded files |
| `config.multiple` | `boolean` | No | Whether multiple files are accepted |

**Returns:** `ParameterDecorator`

```typescript
@post('/upload')
async uploadFile(@upload('avatar', { maxSize: '5mb', types: ['image/jpeg', 'image/png'] }) file: UploadedFile) {
  return { filename: file.originalname, size: file.size }
}
```

---

## 2. Classes

### `APICraftApp`

The main application class. Created via the static `create()` factory method.

```typescript
class APICraftApp {
  private constructor(config: APICraftConfig)

  static create(config: APICraftConfig): APICraftApp

  getPluginManager(): PluginManager
  getLifecycleManager(): LifecycleManager
  getWebSocketEngine(): WebSocketEngine

  getOpenAPISpec(): object
  listen(port: number): Promise<void>
  close(): Promise<void>
}
```

**Usage:**

```typescript
import { APICraftApp } from '@apicraft/core'

const app = APICraftApp.create({
  apis: [UsersAPI],
  adapter: 'express',
  title: 'My API',
  version: '1.0.0',
})

await app.listen(3000)
```

**`getOpenAPISpec()`** returns an OpenAPI 3.1 document built from the registered API definitions. It includes:
- `paths` with parameters, `requestBody` (for body params), and `security` (for guarded routes)
- `components.securitySchemes` for routes with guards (bearer JWT format)

---

### `DefinitionRegistry`

A singleton that stores and retrieves decorator metadata.

```typescript
class DefinitionRegistry {
  static getInstance(): DefinitionRegistry

  registerAPI(target: Function, metadata: APIDefinition): void
  registerRoute(target: Object, metadata: RouteDefinition): void
  registerParam(target: Object, metadata: ParameterDefinition): void

  getAPIDefinition(target: Function): APIDefinition | undefined
  getRouteDefinitions(target: Function): RouteDefinition[]
  getParamDefinitions(target: Function): ParameterDefinition[]
  getAllDefinitions(): APIDefinition[]

  scan(classes: Function[]): APIDefinition[]
}
```

**`scan()`** is the main entry point — it iterates over provided classes, reads all metadata, merges class-level and route-level guards/middleware, and returns a complete `APIDefinition[]` array.

```typescript
const registry = DefinitionRegistry.getInstance()
const definitions = registry.scan([UsersAPI, ProductsAPI])
```

---

### `APIError`

Base error class for all API errors. Carries an HTTP status code and optional error code and details.

```typescript
class APIError extends Error {
  readonly statusCode: number
  readonly code?: string
  readonly details?: unknown[]

  constructor(statusCode: number, message: string, code?: string, details?: unknown[])

  toJSON(): { error: { statusCode: number; message: string; code?: string; details?: unknown[] } }
}
```

**Usage:**

```typescript
throw new APIError(500, 'Database connection failed', 'DB_ERROR')
```

---

### `ValidationError`

Thrown when input validation fails. Extends `APIError` with status code `400`.

```typescript
class ValidationError extends APIError {
  constructor(message?: string, code?: string, details?: unknown[])
  // statusCode: 400
  // default code: 'VALIDATION_ERROR'
}
```

---

### `AuthenticationError`

Thrown when authentication fails. Extends `APIError` with status code `401`.

```typescript
class AuthenticationError extends APIError {
  constructor(message?: string, code?: string, details?: unknown[])
  // statusCode: 401
  // default code: 'AUTHENTICATION_ERROR'
}
```

---

### `NotFoundError`

Thrown when a resource is not found. Extends `APIError` with status code `404`.

```typescript
class NotFoundError extends APIError {
  constructor(message?: string, code?: string, details?: unknown[])
  // statusCode: 404
  // default code: 'NOT_FOUND'
}
```

---

### `ValidationEngine`

Static utility class for runtime validation against Zod schemas.

```typescript
class ValidationEngine {
  static validate<T>(schema: z.ZodType<T>, value: unknown, fieldName: string): T
  static validateQueryParams(
    schemas: Record<string, { schema?: z.ZodTypeAny; default?: unknown }>,
    query: Record<string, string | string[]>,
  ): Record<string, unknown>
  static validatePathParam(name: string, value: string, schema?: z.ZodTypeAny): unknown
  static validateBody<T>(schema: z.ZodType<T>, body: unknown): T
  static coerceType(value: string, targetType: CoercionTargetType): unknown
  static buildSchemaFromType(typeSchema: TypeSchema): z.ZodTypeAny
}
```

**Usage:**

```typescript
const user = ValidationEngine.validateBody(z.object({ name: z.string() }), requestBody)
const page = ValidationEngine.coerceType('3', 'number') // 3
```

---

### `PluginManager`

Manages plugin registration and triggers lifecycle hooks.

```typescript
class PluginManager {
  register(plugin: APICraftPlugin): void
  unregister(name: string): void
  getPlugin(name: string): APICraftPlugin | undefined
  getAllPlugins(): APICraftPlugin[]

  triggerOnDefinitionScan(definitions: APIDefinition[]): void
  triggerOnRouteRegister(route: RouteDefinition): void
  triggerOnGenerateOpenAPI(spec: object): void
  triggerOnRequest(ctx: RequestContext): Promise<void>
  triggerOnResponse(ctx: RequestContext): Promise<void>
  triggerOnError(ctx: RequestContext, error: Error): Promise<void>
}
```

**Throws:** `Error` if a plugin lacks `name` or `version`, or if a plugin name is already registered.

---

### `LifecycleManager`

Manages per-API lifecycle hooks (`beforeRequest`, `afterRequest`, `onError`).

```typescript
class LifecycleManager {
  register(apiName: string, hooks: LifecycleHooks): void
  getHooks(apiName: string): LifecycleHooks | undefined
  unregister(apiName: string): void

  autoRegister(apiName: string, instance: unknown): boolean

  executeBeforeRequest(apiName: string, ctx: RequestContext): Promise<void>
  executeAfterRequest(apiName: string, ctx: RequestContext): Promise<void>
  executeOnError(apiName: string, ctx: RequestContext, error: Error): Promise<void>
}
```

**`autoRegister()`** detects whether an instance implements `LifecycleHooks` (by checking for `beforeRequest`, `afterRequest`, or `onError` methods) and registers it automatically. Returns `true` if hooks were registered.

---

### `WebSocketEngine`

Core WebSocket engine managing handler registration and connection lifecycle.

```typescript
class WebSocketEngine {
  getRoomManager(): WebSocketRoomManager

  register(pattern: string, handler: WebSocketHandler): void
  hasHandler(pattern: string): boolean
  getPatterns(): string[]

  handleConnection(
    ws: any,
    req: any,
    pattern: string,
    params: Record<string, string>,
  ): void
}
```

**Throws:** `Error` if a handler is already registered for a pattern.

---

### `WebSocketRoomManager`

Manages named rooms and their member connections for broadcasting.

```typescript
class WebSocketRoomManager {
  join(connectionId: string, connection: any, room: string): void
  leave(connectionId: string, room: string): void
  broadcast(room: string, data: any, excludeConnectionId?: string): void
  getConnections(room: string): any[]
  removeConnection(connectionId: string): void
  getConnectionRooms(connectionId: string): Set<string>
}
```

---

### `FileValidator`

Validates uploaded files against size and type constraints.

```typescript
class FileValidator {
  static validateSize(file: UploadedFile, maxSize: string): boolean
  static validateType(file: UploadedFile, allowedTypes: string[]): boolean
  static parseMaxSize(size: string): number
}
```

**`parseMaxSize()`** accepts formats like `'5mb'`, `'10kb'`, `'1gb'`, `'500b'` and returns bytes.

---

### `SchemaRegistry`

Registry for named schemas, enabling reference resolution in `buildZodSchema()`. Schemas registered here are resolved when a `TypeSchema` with `kind: 'reference'` is encountered.

```typescript
class SchemaRegistry {
  static register(name: string, schema: z.ZodTypeAny): void
  static get(name: string): z.ZodTypeAny | undefined
  static has(name: string): boolean
  static clear(): void
}
```

**Usage:**

```typescript
import { SchemaRegistry } from '@apicraft/core'
import { z } from 'zod'

SchemaRegistry.register('User', z.object({ id: z.string(), name: z.string() }))

// Now buildZodSchema({ kind: 'reference', name: 'User' }) resolves to the registered schema
```

---

## 3. Functions

### `defineConfig(config)`

Type-safe configuration helper. Returns the config object unchanged — it exists purely for IDE autocomplete and type checking.

```typescript
function defineConfig(config: APICraftConfig): APICraftConfig
```

```typescript
import { defineConfig } from '@apicraft/core'

export default defineConfig({
  title: 'My API',
  version: '1.0.0',
  adapter: 'express',
  apis: [],
})
```

---

### `createDTO(shape)`

Creates a Zod object schema from a shape. A thin wrapper around `z.object()`.

```typescript
function createDTO<T extends z.ZodRawShape>(shape: T): z.ZodObject<T>
```

```typescript
import { createDTO } from '@apicraft/core'
import { z } from 'zod'

const UserDTO = createDTO({
  name: z.string(),
  email: z.string().email(),
})
```

---

### `coerceType(value, targetType)`

Coerces a string value to the target type. Throws on invalid input.

```typescript
function coerceType(value: string, targetType: CoercionTargetType): unknown
```

| Target Type | Coercion Rule |
|-------------|---------------|
| `'string'` | Identity (returns `value` unchanged) |
| `'number'` | `Number(value)` — throws if `NaN` |
| `'boolean'` | `'true'`/`'1'` → `true`, `'false'`/`'0'` → `false` |
| `'date'` | `new Date(value)` — throws if invalid date |

```typescript
coerceType('42', 'number')    // 42
coerceType('true', 'boolean') // true
coerceType('abc', 'number')   // throws Error
```

---

### `buildZodSchema(typeSchema)`

Builds a Zod schema from a `TypeSchema` descriptor. Handles all schema kinds including nested objects, arrays, unions, and references.

```typescript
function buildZodSchema(typeSchema: TypeSchema): z.ZodTypeAny
```

**Supported kinds:**

| Kind | Zod Output |
|------|------------|
| `string` | `z.string()` with optional `.min()`, `.max()`, `.email()`, `.uuid()`, `.regex()`, `.datetime()` |
| `number` | `z.number()` with optional `.min()`, `.max()` |
| `boolean` | `z.boolean()` |
| `enum` | `z.enum([...])` |
| `array` | `z.array(buildZodSchema(items))` |
| `object` | `z.object({...})` (`.partial()` if no `required` array) |
| `union` | `z.union([...])` |
| `reference` | Resolved from `SchemaRegistry`; falls back to `z.any()` if not found |

```typescript
const schema = buildZodSchema({
  kind: 'object',
  properties: { name: { kind: 'string', zodInfo: { min: 1 } } },
  required: ['name'],
})
schema.safeParse({ name: 'Alice' }) // success
```

---

### `formatZodError(error)`

Converts a Zod error into a standardized array of validation error details.

```typescript
function formatZodError(error: z.ZodError): ValidationErrorDetail[]
```

Each detail has the shape:

```typescript
interface ValidationErrorDetail {
  field: string    // dot-joined path, or '_root' for top-level errors
  message: string  // Zod issue message
  code: string     // Zod issue code (e.g. 'invalid_type', 'too_small')
}
```

---

### `createValidationError(zodError)`

Creates a `ValidationError` from a `ZodError`, formatting the issues as details.

```typescript
function createValidationError(zodError: z.ZodError): ValidationError
```

```typescript
const result = schema.safeParse(badInput)
if (!result.success) {
  throw createValidationError(result.error)
}
```

---

### `validateUploadedFile(file, config)`

Validates an uploaded file against size and type constraints. Throws on the first validation failure.

```typescript
function validateUploadedFile(file: UploadedFile, config: UploadConfig): void
```

```typescript
validateUploadedFile(file, { maxSize: '5mb', types: ['image/jpeg'] })
// throws Error if file is too large or wrong type
```

---

## 4. Interfaces

### `Adapter`

The interface that all framework adapters implement.

```typescript
interface Adapter {
  readonly name: string
  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    globalMiddleware: MiddlewareDefinition[],
  ): void
  createRequestContext(originalReq: unknown, originalRes: unknown): RequestContext
  sendResponse(ctx: RequestContext): Promise<void>
  listen(port: number): Promise<void>
  close(): Promise<void>
}
```

---

### `Middleware`

Interface for request/response middleware.

```typescript
interface Middleware {
  before?(ctx: RequestContext): Promise<void>
  after?(ctx: RequestContext): Promise<void>
  onError?(ctx: RequestContext, error: Error): Promise<void>
}
```

---

### `Guard`

Interface for authentication/authorization guards.

```typescript
interface Guard {
  authenticate(ctx: RequestContext): Promise<boolean>
  onFailure?(ctx: RequestContext): Promise<void>
}
```

`authenticate()` returns `true` to allow the request, `false` to reject. When rejected, `onFailure()` is called (or a default 401 response is sent).

---

### `APICraftPlugin`

Interface for plugins that hook into the framework lifecycle.

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
  middleware?: any[]
  decorators?: Record<string, Function>
  generators?: any[]
}
```

---

### `LifecycleHooks`

Per-API lifecycle hooks. API classes can implement this interface directly and hooks are auto-detected by `LifecycleManager.autoRegister()`.

```typescript
interface LifecycleHooks {
  beforeRequest?(ctx: RequestContext): Promise<void>
  afterRequest?(ctx: RequestContext): Promise<void>
  onError?(ctx: RequestContext, error: Error): Promise<void>
}
```

```typescript
@api('/users')
class UsersAPI implements LifecycleHooks {
  async beforeRequest(ctx: RequestContext) {
    ctx.logger.info(`[UsersAPI] ${ctx.request.method} ${ctx.request.path}`)
  }
  async onError(ctx: RequestContext, error: Error) {
    ctx.logger.error(`[UsersAPI] ${error.message}`)
  }
}
```

---

### `WebSocketHandler`

Interface for WebSocket handler classes. All hooks are optional.

```typescript
interface WebSocketHandler {
  onConnect?(ctx: WebSocketContext): void | Promise<void>
  onDisconnect?(ctx: WebSocketContext): void | Promise<void>
  onMessage?(ctx: WebSocketContext, message: any): void | Promise<void>
}
```

---

### `WebSocketContext`

Context object provided to every WebSocket lifecycle hook.

```typescript
interface WebSocketContext {
  readonly id: string
  readonly connection: any
  readonly url: URL
  readonly params: Record<string, string>
  readonly query: Record<string, string>
  readonly headers: Record<string, string>
  user?: any
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

### `RequestContext`

The central context object passed through the request pipeline.

```typescript
interface RequestContext {
  request: {
    method: string
    path: string
    params: Record<string, string>
    query: Record<string, string | string[]>
    headers: Record<string, string | string[] | undefined>
    body: unknown
    ip: string
  }
  response: {
    statusCode: number
    headers: Record<string, string>
    body: unknown
  }
  state: Map<string, unknown>
  logger: Logger
  user?: AuthenticatedUser
}
```

---

### `APICraftConfig`

The configuration object passed to `APICraftApp.create()` and `defineConfig()`. See [Configuration Reference](#7-configuration-reference) for the full breakdown.

---

## 5. Types

### `HTTPMethod`

```typescript
type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'ws'
```

---

### `TypeSchema`

Represents a runtime type descriptor used by generators and validators.

```typescript
interface TypeSchema {
  kind: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'union' | 'reference'
  name?: string
  type?: string
  format?: string
  enum?: string[]
  items?: TypeSchema
  properties?: Record<string, TypeSchema>
  required?: string[]
  members?: TypeSchema[]
  zodInfo?: {
    min?: number
    max?: number
    email?: boolean
    uuid?: boolean
    pattern?: string
  }
}
```

---

### `ParameterDefinition`

```typescript
interface ParameterDefinition {
  kind: 'param' | 'query' | 'body' | 'headers' | 'context' | 'upload'
  name: string
  index: number
  type: TypeSchema
  zodSchema?: z.ZodTypeAny
  required: boolean
  default?: unknown
  description?: string
}
```

---

### `RouteDefinition`

```typescript
interface RouteDefinition {
  method: HTTPMethod
  path: string
  fullPath: string
  handlerName: string
  parameters: ParameterDefinition[]
  responseStatus: number
  responseContentType: string
  guards: GuardDefinition[]
  middleware: MiddlewareDefinition[]
  throttle?: ThrottleDefinition
  summary?: string
  description?: string
}
```

---

### `APIDefinition`

```typescript
interface APIDefinition {
  name: string
  prefix: string
  version?: string
  tags: string[]
  routes: RouteDefinition[]
  guards: GuardDefinition[]
  middleware: MiddlewareDefinition[]
}
```

---

### `ThrottleDefinition`

```typescript
interface ThrottleDefinition {
  window: number  // milliseconds
  max: number    // max requests per window
}
```

---

### `GuardDefinition`

```typescript
interface GuardDefinition {
  class: new (...args: unknown[]) => Guard
  options?: Record<string, unknown>
  scope: 'api' | 'route'
}
```

---

### `MiddlewareDefinition`

```typescript
interface MiddlewareDefinition {
  class: new (...args: unknown[]) => Middleware
  options?: Record<string, unknown>
  scope: 'global' | 'api' | 'route'
}
```

---

### `GeneratedFile`

```typescript
interface GeneratedFile {
  path: string
  content: string
  language: string
}
```

---

### `AuthenticatedUser`

```typescript
interface AuthenticatedUser {
  id: string
  roles: string[]
  [key: string]: unknown
}
```

---

### `Logger`

```typescript
interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
  debug(msg: string, meta?: Record<string, unknown>): void
}
```

---

### `UploadConfig`

```typescript
interface UploadConfig {
  maxSize?: string
  types?: string[]
  destination?: string
  multiple?: boolean
}
```

---

### `UploadedFile`

```typescript
interface UploadedFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  buffer?: Buffer
  path?: string
}
```

---

### `CoercionTargetType`

```typescript
type CoercionTargetType = 'string' | 'number' | 'boolean' | 'date'
```

---

## 6. Constants

### Metadata Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `API_METADATA_KEY` | `'apicraft:api'` | Metadata key for class-level API definitions |
| `ROUTE_METADATA_KEY` | `'apicraft:route'` | Metadata key for route definitions (on prototype) |
| `PARAM_METADATA_KEY` | `'apicraft:param'` | Metadata key for parameter definitions (on prototype, per method) |
| `WS_METADATA_KEY` | `'apicraft:ws'` | Metadata key for WebSocket handler paths |
| `UPLOAD_METADATA_KEY` | `'apicraft:upload'` | Metadata key for upload configurations |

---

### `CommonSchemas`

A collection of reusable Zod schemas for common validation patterns.

```typescript
const CommonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/),
  password: z.string().min(8).max(128),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/),
  pagination: {
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  },
} as const
```

**Usage:**

```typescript
import { CommonSchemas } from '@apicraft/core'

const { page, limit } = CommonSchemas.pagination
// page.safeParse(undefined) → { success: true, data: 1 }
// limit.safeParse(50) → { success: true, data: 50 }
```

---

### `typeCoercers`

A record of coercion functions keyed by target type.

```typescript
const typeCoercers: Record<string, (value: string) => unknown> = {
  string: (v) => v,
  number: (v) => { const n = Number(v); if (isNaN(n)) throw new Error(...); return n },
  boolean: (v) => { if (v === 'true' || v === '1') return true; ... },
  date: (v) => { const d = new Date(v); if (isNaN(d.getTime())) throw ...; return d },
}
```

---

## 7. Configuration Reference

The `APICraftConfig` interface defines all configuration options:

```typescript
interface APICraftConfig {
  // ─── Top-level metadata ───
  title?: string                    // API title (used in OpenAPI info)
  version?: string                  // API version (e.g. '1.0.0')
  description?: string              // API description
  apis?: Function[]                  // Array of API class constructors

  // ─── Adapter ───
  adapter?: 'express' | 'fastify' | 'hono' | 'next' | 'koa' | 'nest' | Adapter
  server?: {
    port?: number                   // Port (default: 3000)
    adapter?: /* same as above */    // Alternative adapter location
  }

  // ─── OpenAPI generator config ───
  openapi?: {
    output?: string                 // Output directory (default: './generated')
    format?: string                 // Output format ('json' | 'yaml')
    title?: string                  // Override OpenAPI info.title
    version?: string               // Override OpenAPI info.version
    description?: string           // Override OpenAPI info.description
  }

  // ─── Client SDK generator config ───
  client?: {
    output?: string                 // Output directory for client SDK
  }

  // ─── Middleware configuration ───
  middleware?: {
    cors?: {
      origin?: string | string[]    // Allowed origins (default: '*')
      methods?: string[]            // Allowed HTTP methods
      allowedHeaders?: string[]     // Allowed request headers
      credentials?: boolean          // Allow credentials
    }
    logger?: {
      level?: string                // Log level: 'debug' | 'info' | 'warn' | 'error'
      format?: string               // Format: 'json' | 'dev' | 'combined'
    }
    rateLimiter?: {
      windowMs?: number             // Time window in ms (default: 60000)
      max?: number                  // Max requests per window (default: 100)
    }
    compression?: {
      level?: number                // Compression level (1-9)
      threshold?: number            // Min body size to compress (default: 1024 bytes)
    }
    helmet?: {
      contentSecurityPolicy?: boolean // Enable CSP (default: true)
      frameguard?: boolean            // Enable X-Frame-Options (default: true)
    }
  }

  // ─── Plugins ───
  plugins?: APICraftPlugin[]

  // ─── Auth configuration ───
  auth?: {
    jwt?: {
      secret: string                // JWT signing secret (required for JWT guard)
      algorithms?: string[]         // Allowed algorithms (default: ['HS256'])
    }
    apiKey?: {
      header?: string              // Header name for API key (default: 'x-api-key')
    }
  }
}
```

### Example Configuration

```typescript
import { defineConfig } from '@apicraft/core'

export default defineConfig({
  title: 'My API',
  version: '1.0.0',
  description: 'A production API',
  apis: [],
  adapter: 'express',
  server: { port: 3000, host: '0.0.0.0' },
  openapi: {
    output: './generated',
    servers: [{ url: 'https://api.example.com' }],
  },
  client: { output: './generated', name: 'APICraftClient' },
  middleware: {
    cors: { origin: 'https://example.com' },
    logger: { level: 'info', format: 'json' },
    rateLimiter: { windowMs: 60000, max: 100 },
    compression: { threshold: 1024 },
    helmet: { contentSecurityPolicy: false },
  },
  auth: {
    jwt: { secret: process.env.JWT_SECRET!, algorithms: ['HS256'] },
  },
})
```

---

## 8. Error Handling Reference

### Error Class Hierarchy

```
Error
  └── APIError (statusCode, code, details)
        ├── ValidationError    (statusCode: 400)
        ├── AuthenticationError (statusCode: 401)
        └── NotFoundError      (statusCode: 404)
```

### Error Response Format

All `APIError` instances serialize to this JSON structure via `toJSON()`:

```json
{
  "error": {
    "statusCode": 400,
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Invalid email", "code": "invalid_string" }
    ]
  }
}
```

### Default Error Status Codes

| Error Class | Status Code | Default Code |
|-------------|-------------|--------------|
| `APIError` | 500 (configurable) | — |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| Throttle exceeded | 429 | — |
| Rate limit exceeded | 429 | — |

### Error Pipeline Flow

When an error is thrown during request processing:

1. **Lifecycle `onError` hooks** execute for the API
2. **Plugin `onError` hooks** execute
3. **Middleware `onError` handlers** execute
4. **Error serialization** — if the error is an `APIError`, its `statusCode` and `toJSON()` are set on the response; `AuthenticationError` sets 401; unknown errors are re-thrown

---

## 9. CLI Commands Reference

The `@apicraft/cli` package provides four commands. Install it globally or run via `npx`:

```bash
npx apicraft <command> [options]
```

### `apicraft init [project-name]`

Scaffolds a new APICraft project with package.json, tsconfig.json, configuration file, and a sample API.

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --template <template>` | Project template | `rest-api` |
| `--adapter <adapter>` | HTTP adapter (`express`, `fastify`, `hono`) | `express` |
| `--pkg-manager <manager>` | Package manager (`npm`, `pnpm`, `yarn`) | `npm` |

```bash
npx apicraft init my-api --adapter fastify --pkg-manager pnpm
cd my-api
npm run dev
```

---

### `apicraft generate`

Generates API artifacts (OpenAPI spec, client SDK, React hooks, Zod schemas, documentation UI) from your decorated API classes.

| Flag | Description |
|------|-------------|
| `-o, --openapi` | Generate OpenAPI 3.1 spec (`openapi.json`, `openapi.yaml`) |
| `-c, --client` | Generate TypeScript client SDK (`client.ts`, `client-axios.ts`) |
| `-r, --react` | Generate React Query hooks (`hooks.ts`) |
| `-z, --zod` | Generate Zod schemas (`schemas.ts`) |
| `-d, --docs` | Generate API documentation UI (`scalar.html`, `swagger.html`) |
| `--all` | Generate all artifacts |
| `--output <dir>` | Output directory (default: `./generated`) |
| `--watch` | Watch mode — regenerate on file changes |

```bash
# Generate all artifacts
npx apicraft generate --all

# Generate only OpenAPI and client
npx apicraft generate --openapi --client --output ./dist

# Watch mode for development
npx apicraft generate --all --watch
```

---

### `apicraft serve`

Starts the development server.

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port <port>` | Port number | `3000` |
| `-h, --host <host>` | Host address | `localhost` |
| `--hot` | Enable hot reload | disabled |
| `--config <path>` | Config file path | `./apicraft.config.ts` |

```bash
npx apicraft serve --port 8080 --host 0.0.0.0 --hot
```

---

### `apicraft build`

Builds the project for production.

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --out-dir <dir>` | Output directory | `./dist` |
| `--clean` | Clean output directory before build | disabled |
| `--sourcemap` | Generate source maps | disabled |
| `--minify` | Minify output | disabled |

```bash
npx apicraft build --clean --sourcemap --minify --out-dir ./build
```

---

### Package Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start dev server with `tsx watch` |
| `pnpm build` | Build with `tsc -b` (project references) |
| `pnpm start` | Run compiled `node dist/index.js` |
| `pnpm test` | Run all tests with Vitest |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with V8 coverage |
| `pnpm lint` | Lint with Biome |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format with Biome |
