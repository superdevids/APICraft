# Changelog

All notable changes to APICraft are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-07-11

### Added

#### Core Framework
- Decorator-based API definition system with `@api`, `@get`, `@post`, `@put`, `@patch`, `@del` decorators
- WebSocket support via `@ws` decorator with room management and broadcasting
- Parameter decorators: `@param`, `@query`, `@body`, `@headers`, `@context`, `@upload`
- Metadata system using `reflect-metadata` with `DefinitionRegistry` singleton
- Type inference from TypeScript parameter types at runtime
- 4-layer validation pipeline: TypeScript types → decorator constraints → Zod validation → business logic
- `Guard` interface with `@guard` decorator for authentication (class and method level)
- `Middleware` interface with `@use` decorator (class and method level)
- `@version` decorator for API versioning
- `@response` decorator for custom status codes and content types
- `@throttle` decorator for per-route rate limiting
- Error class hierarchy: `APIError`, `ValidationError`, `AuthenticationError`, `NotFoundError`
- `APICraftApp.create()` singleton with full configuration support

#### Adapters
- **Express adapter** (`@apicraft/adapter-express`) — Full integration with Express.js
- **Fastify adapter** (`@apicraft/adapter-fastify`) — Full integration with Fastify
- **Hono adapter** (`@apicraft/adapter-hono`) — Integration with Hono framework
- **Koa adapter** (`@apicraft/adapter-koa`) — Integration with Koa framework
- **Next.js adapter** (`@apicraft/adapter-next`) — App Router route file generation and direct embedding
- **NestJS adapter** (`@apicraft/adapter-nest`) — Dynamic controller module generation

#### Code Generators
- **OpenAPI 3.1 generator** (`@apicraft/generator-openapi`) — JSON and YAML output
- **TypeScript Client SDK generator** (`@apicraft/generator-client`) — Fetch and axios clients
- **React Query hooks generator** (`@apicraft/generator-react`) — `useQuery`, `useMutation`, `useInfiniteQuery`
- **Zod schema generator** (`@apicraft/generator-zod`) — Reusable validation schemas
- **Documentation UI generator** (`@apicraft/generator-docs`) — Scalar UI and Swagger UI

#### Middleware
- **CORS middleware** (`@apicraft/middleware-cors`) — Configurable origin, methods, and headers
- **Logger middleware** (`@apicraft/middleware-logger`) — JSON, dev, and combined formats with file output
- **JWT authentication guard** (`@apicraft/middleware-auth`) — Token verification with configurable algorithms
- **API Key authentication guard** (`@apicraft/middleware-auth`) — Multi-key support with user mapping
- **Session authentication guard** (`@apicraft/middleware-auth`) — Cookie-based session lookup
- **Rate limiter middleware** (`@apicraft/middleware-rate-limiter`) — Sliding window with in-memory store
- **Compression middleware** (`@apicraft/middleware-compression`) — Gzip, deflate, and brotli
- **Helmet middleware** (`@apicraft/middleware-helmet`) — Security headers (CSP, HSTS, X-Frame-Options)

#### CLI Tools
- `apicraft init` — Interactive project scaffolding with template and adapter selection
- `apicraft generate` — Artifact generation with `--openapi`, `--client`, `--react`, `--zod`, `--docs`, `--all`, and `--watch` modes
- `apicraft serve` — Development server with port, host, and hot reload options
- `apicraft build` — Production build with clean, sourcemap, and minification options

#### Runtime
- Plugin system with lifecycle hooks (`onDefinitionScan`, `onRouteRegister`, `onGenerateOpenAPI`, `onRequest`, `onResponse`, `onError`)
- Lifecycle hooks manager with per-API registration
- File upload handling with `@upload` decorator, size/type validation
- WebSocket engine with room manager and `WebSocketHandler` interface
- Validation engine with type coercion (string, number, boolean, date)
- Runtime Zod schema builder from `TypeSchema` descriptors

#### Examples
- `examples/todo-app` — Full CRUD Todo API with Express adapter, Zod validation, CORS and Logger middleware

#### Documentation
- Comprehensive README with overview, features, quick start, and architecture
- ARCHITECTURE.md with deep architecture, data flow diagrams, and component descriptions
- CONTRIBUTING.md with development workflow, PR process, and coding standards
- CODE_OF_CONDUCT.md (Contributor Covenant 2.1)
- SECURITY.md with vulnerability reporting policy
- CHANGELOG.md with version history
- Issue templates (bug report, feature request) and PR template

#### Infrastructure
- pnpm monorepo with workspace configuration
- TypeScript strict mode across all packages
- Path aliases for cross-package development
- MIT License

---

## [Unreleased]

### Added

- Added `SchemaRegistry` class for named schema registration and reference resolution in Zod schema builder
- Added `LifecycleManager.autoRegister()` method for automatic lifecycle hook detection from API class instances
- Added comprehensive deployment guide (`docs/DEPLOYMENT.md`)
- Added comprehensive development guide (`docs/DEVELOPMENT.md`)
- Added comprehensive API reference (`docs/API_REFERENCE.md`)
- Added comprehensive testing guide (`docs/TESTING.md`)
- Added `packages/create-apicraft` scaffolding CLI package

### Fixed

- Fixed `DefinitionRegistry.getParamDefinitions()` returning empty object `{}` instead of empty array `[]` causing type mismatch
- Fixed `@body` decorator losing type schema information when a Zod schema was provided
- Fixed OpenAPI generator `inferReturnType()` dead loop that always returned `null` for response schemas
- Fixed `APICraftApp` not invoking authentication guards during request processing — guards are now properly executed in the pipeline
- Fixed `APICraftApp` not enforcing `@throttle` decorator — per-route rate limiting is now enforced with in-memory sliding window
- Fixed `APICraftApp` only wiring CORS and Helmet global middleware — Logger, RateLimiter, and Compression middleware are now properly wired
- Fixed lifecycle hooks auto-registration — API classes implementing `LifecycleHooks` are now auto-detected and registered
- Fixed `buildZodSchema()` returning `z.any()` for `reference` kind — added `SchemaRegistry` for reference resolution
- Fixed `APICraftApp.getOpenAPISpec()` not including `requestBody` schemas for body parameters
- Fixed `APICraftApp.getOpenAPISpec()` not including security schemes for guarded routes
- Fixed `pnpm-workspace.yaml` containing broken placeholder text in `allowBuilds` section
- Fixed `apicraft.config.ts` not matching documented configuration schema
- Fixed `CONTRIBUTING.md` incorrectly documenting ESLint/Prettier instead of Biome, and misrepresenting decorator configuration

### Planned

- Streaming response support
- GraphQL integration
- Cron job / scheduled task support
- Database integration (TypeORM, Prisma, Drizzle)
- gRPC adapter
- OpenTelemetry integration
- Enhanced watch mode with hot module replacement
- Performance benchmarking suite
- API versioning strategies (URI, header, query)
- Request validation middleware
- Response caching middleware
- CSRF protection middleware
- Request ID middleware
- WebSocket adapter for all frameworks
- Plugin marketplace and registry
- Migration guides from Express/Fastify/NestJS
- Official website and documentation site

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2026-07-11 | Initial release — all core features, 6 adapters, 5 generators, 8 middleware packages, CLI tools |
