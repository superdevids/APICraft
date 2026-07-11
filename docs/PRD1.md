# PRD: APICraft — Code-First API Framework

**Status:** Draft v1.0  
**Author:** Product Team  
**Last Updated:** 2026-07-10  
**Target Release:** MVP dalam 30 hari  

---

## 1. EXECUTIVE SUMMARY

APICraft adalah framework TypeScript code-first untuk membangun REST API dengan produktivitas maksimal. Konsep intinya: developer mendefinisikan API endpoint menggunakan class dan decorators — dan APICraft secara otomatis menghasilkan OpenAPI 3.1 spec, TypeScript client SDK, React Query hooks, Zod validation schemas, serta dokumentasi API yang selalu sinkron dengan kode.

Pendekatan ini menyelesaikan masalah kronis dalam pengembangan API: duplikasi antara kode route, validasi, dokumentasi, dan client. Selama ini, setiap endpoint mengharuskan developer menulis minimal 4 artefak terpisah (route handler, validation schema, OpenAPI spec, dan client SDK call) yang sering tidak sinkron satu sama lain. APICraft mereduksi ini menjadi 1 definisi — sisanya auto-generated.

APICraft memposisikan diri di antara dua kutub: **tRPC** (end-to-end typesafe RPC, bukan REST) dan **Express/Zod** (REST tapi banyak boilerplate). APICraft adalah tRPC untuk REST — memberikan end-to-end type safety tanpa meninggalkan ekosistem REST yang sudah mapan.

Target pasar: 2.8+ juta developer backend dan fullstack TypeScript. APICraft adalah 100% open source di bawah **MIT License** dengan semua fitur gratis.

---

## 2. PROBLEM STATEMENT

### 2.1 Masalah Inti

Dalam pengembangan API modern menggunakan TypeScript, terdapat **repetisi sistematis** yang membuang waktu dan menimbulkan bug:

**a. Triple-Write Problem**
Setiap endpoint REST membutuhkan tiga artefak yang harus dijaga sinkron:
- **Route handler** (logika bisnis di controller)
- **Validation schema** (Zod, Joi, Yup, atau manual if-else)
- **Dokumentasi** (OpenAPI spec yang ditulis manual atau dengan swagger-jsdoc)

Ketiganya sering tidak sinkron. Update route handler lupa update spec. Tambah parameter query lupa update schema. Hasilnya: dokumentasi basi, client error, debugging memakan waktu.

**b. Client-Frontend Gap**
Backend API yang sudah jadi belum berarti frontend bisa langsung pakai. Developer frontend harus:
- Membaca dokumentasi API (jika ada dan akurat)
- Menulis typed fetch calls manual
- Menangani error responses
- Mengetik ulang interface/model yang sama

Setiap perubahan API berarti update ulang semua call site. Di tim terpisah, ini jadi sumber friction besar.

**c. Boilerplate Fatigue**
Stack seperti Express + Zod sudah umum, tapi masih membutuhkan boilerplate per endpoint:
```typescript
// Tanpa APICraft — 4 file untuk 1 endpoint
// route.ts
router.get('/users', validate(listUsersSchema), async (req, res) => { ... })

// schema.ts
export const listUsersSchema = z.object({ ... })

// spec.ts — manual OpenAPI fragment

// client.ts — manual fetch call
```

Untuk API dengan 50+ endpoint, ini berarti 200+ file. Dengan APICraft: 50 file.

### 2.2 Masalah Turunan

**d. Type Safety yang Bocor**
Meskipun menggunakan TypeScript, tipe tidak pernah sampai ke runtime. Zod membantu, tapi tetap ada gap antara interface TypeScript dan runtime validation. APICraft menutup gap ini dengan menjadikan TypeScript sebagai single source of truth.

**e. Onboarding Lambat**
Anggota tim baru harus membaca dokumentasi (jika ada), memahami struktur route, dan menulis kode dengan gaya yang konsisten. Tanpa standar framework, setiap developer punya gaya sendiri.

**f. Fragmentasi Tooling**
Ekosistem saat ini terpecah:
- Zodios: mirip Tapi terbatas pada Zod
- ts-rest: hanya untuk tRPC-style
- express-zod-api: Express-only, tidak generate client
- Elysia: Bun-only
- Hono: ringan tapi tidak code-first

Tidak ada solusi yang menyatukan REST, code-first, dan client generation secara komprehensif.

### 2.3 Dampak Bisnis

- **30-40% waktu backend** dihabiskan untuk boilerplate, bukan logika bisnis
- **2-5 bug per sprint** akibat spec tidak sinkron dengan code
- **1-3 hari** setup API baru termasuk client dan dokumentasi
- **Developer frustration** tinggi karena pekerjaan repetitif

---

## 3. TARGET USERS

### 3.1 Primary Personas

**Persona A: Backend Engineer — "Rama"**
- Usia: 25-35 tahun
- Stack: TypeScript, Node.js, Express/Fastify
- Pekerjaan: Membangun REST API untuk produk SaaS
- Pain point: Bosan nulis OpenAPI spec manual, capek bolak-balik update dokumentasi
- Motto: "I just want to write business logic"
- APICraft value: Define endpoint sekali → spec, validasi, docs auto. Fokus ke logika bisnis.

**Persona B: Fullstack Engineer — "Dinda"**
- Usia: 22-30 tahun
- Stack: Next.js, TypeScript, Prisma
- Pekerjaan: Build fitur end-to-end sendiri
- Pain point: Bolak-balik copy-paste tipe dari backend ke frontend
- Motto: "Why do I have to type the same interface twice?"
- APICraft value: Satu definisi → backend + client SDK + React hooks auto. No more type duplication.

**Persona C: API Designer / Tech Lead — "Alex"**
- Usia: 30-45 tahun
- Tanggung jawab: API design review, standarisasi tim
- Pain point: Tim tidak konsisten dalam penamaan, error handling, dokumentasi
- Motto: "I need consistency across 50+ endpoints"
- APICraft value: Convention over configuration, generated docs selalu up-to-date, consistent error format.

### 3.2 Secondary Personas

**Persona D: Frontend Engineer — "Sarah"**
- Usia: 22-28 tahun
- Stack: React, TypeScript, TanStack Query
- Pain point: Backend update API tanpa kasih tau, tipe sering mismatch
- APICraft value: Type-safe client SDK + React Query hooks yang regenerate otomatis.

**Persona E: Startup CTO — "Budi"**
- Usia: 28-40 tahun
- Tanggung jawab: Shipping cepat dengan tim kecil
- Pain point: Resource terbatas, perlu tool yang mempercepat development
- APICraft value: 3x lebih cepat deliver API + docs + client dari 1 definisi.

### 3.3 Target Market Sizing

| Segment | Estimasi Developer | Penetration Target |
|---------|-------------------|-------------------|
| Backend TypeScript | 1.2M | 15% |
| Fullstack Next.js | 1.1M | 20% |
| Node.js API Builder | 500K | 10% |
| **Total TAM** | **2.8M** | |

---

## 4. USER STORIES

### 4.1 API Definition (Core)

**US-001: Define Basic Endpoint**
> Sebagai backend engineer, saya ingin mendefinisikan endpoint GET /users dengan class dan decorators agar tidak perlu nulis route handler Express secara manual.

Acceptance Criteria:
- Decorator `@api('/users')` di class
- Decorator `@get('/')` di method
- Method dipanggil ketika request GET /users masuk
- Response method dikembalikan sebagai JSON

**US-002: Path Parameters**
> Sebagai backend engineer, saya ingin mendefinisikan path parameter seperti `@param('id')` agar tidak perlu parsing `req.params`.

Acceptance Criteria:
- Decorator `@param('id')` untuk menangkap path parameter
- Tipe parameter otomatis tervalidasi
- 404 otomatis jika resource tidak ditemukan (opsional)

**US-003: Query Parameters**
> Sebagai backend engineer, saya ingin mendefinisikan query parameters dengan default value dan validasi.

Acceptance Criteria:
- Decorator `@query('page')` dengan type inference
- Default value via `@query('limit', { default: 10 })`
- Validasi tipe otomatis (number, string, boolean, date)
- Custom validation via Zod schema

**US-004: Request Body**
> Sebagai backend engineer, saya ingin mendefinisikan request body dengan DTO class atau Zod schema untuk validasi otomatis.

Acceptance Criteria:
- Decorator `@body` dengan type inference dari DTO
- Validasi body otomatis sebelum handler dipanggil
- 400 Bad Request dengan pesan error detail jika validasi gagal
- Support nested objects dan arrays

**US-005: Response Types & Status Codes**
> Sebagai backend engineer, saya ingin mendefinisikan response type dan status code per endpoint.

Acceptance Criteria:
- Return type method → response type
- Decorator `@response(201)` untuk custom status code
- Support Union types untuk multiple response (200 | 404)
- Response serialization otomatis

### 4.2 Auto-Generation

**US-006: Generate OpenAPI Spec**
> Sebagai tech lead, saya ingin OpenAPI 3.1 spec auto-generated dari definisi API agar dokumentasi selalu sinkron dengan kode.

Acceptance Criteria:
- Generate OpenAPI 3.1 JSON dari semua definisi
- Support OpenAPI 3.1 YAML
- Include: paths, schemas, parameters, requestBodies, responses
- Tags dari `@api` name
- Summary dan description dari JSDoc/komentar

**US-007: Generate TypeScript Client SDK**
> Sebagai fullstack engineer, saya ingin TypeScript client SDK auto-generated agar frontend bisa langsung panggil API dengan type safety.

Acceptance Criteria:
- Generate typed fetch wrapper functions
- Setiap endpoint punya fungsi sendiri dengan parameter typed
- Response type sesuai definisi
- Error handling built-in
- Support base URL configuration
- Axios variant juga tersedia

**US-008: Generate React Query Hooks**
> Sebagai frontend engineer, saya ingin React Query hooks auto-generated untuk data fetching dengan caching, loading states, dan error handling.

Acceptance Criteria:
- useQuery hooks untuk GET endpoints
- useMutation hooks untuk POST/PUT/PATCH/DELETE
- Query keys auto-generated
- Type-safe data dan variables
- Support infinite queries untuk paginated endpoints

**US-009: Generate Zod Schemas**
> Sebagai backend engineer, saya ingin Zod schemas auto-generated dari definisi API untuk validasi form di frontend.

Acceptance Criteria:
- Zod schemas untuk setiap request body
- Zod schemas untuk query parameters
- Human-readable error messages
- Support re-use antar schemas

**US-010: Generate API Doc UI**
> Sebagai API designer, saya ingin API documentation UI auto-generated (Scalar atau Swagger UI) agar tim dan konsumen API bisa explore endpoints.

Acceptance Criteria:
- Scalar UI integration (default)
- Swagger UI sebagai alternatif
- Try-it-out functionality
- Auto-update ketika API berubah

### 4.3 Middleware & Extensibility

**US-011: Authentication Middleware**
> Sebagai backend engineer, saya ingin authentication middleware (JWT, API key) bisa dipasang per endpoint atau global.

Acceptance Criteria:
- `@guard(AuthGuard)` untuk melindungi endpoint
- `@guard` di class level → semua endpoint terproteksi
- Built-in JWT guard dengan configurable secret
- Built-in API key guard
- Custom guard dengan interface `Guard`

**US-012: Rate Limiting**
> Sebagai backend engineer, saya ingin rate limiting middleware dengan konfigurasi per endpoint.

Acceptance Criteria:
- `@throttle({ window: 60000, max: 100 })` decorator
- Global rate limit config
- Per-endpoint override
- Distributed rate limiting (Redis adapter)
- 429 response dengan Retry-After header

**US-013: Custom Middleware**
> Sebagai backend engineer, saya ingin bisa pasang custom middleware (logging, tracing, CORS, compression) secara global atau per-endpoint.

Acceptance Criteria:
- `@use(LoggerMiddleware)` di class atau method
- Global middleware via config
- Support Express-compatible middleware
- Support async middleware
- Middleware order terdefinisi dengan jelas

### 4.4 Advanced

**US-014: API Versioning**
> Sebagai API designer, saya ingin mendukung multiple API versions dengan minimal duplication.

Acceptance Criteria:
- Version prefix: `/v1/users`, `/v2/users`
- Extends class untuk versioning
- Override specific methods di versi baru
- Fallback ke versi lama jika method tidak di-override

**US-015: File Upload**
> Sebagai backend engineer, saya ingin mendukung multipart file upload dengan validasi tipe dan ukuran.

Acceptance Criteria:
- `@upload('file')` decorator
- File type validation (image, pdf, etc)
- Max file size
- Multiple files support
- Stream processing untuk large files

**US-016: WebSocket Endpoints**
> Sebagai backend engineer, saya ingin mendefinisikan WebSocket endpoints dengan decorator yang sama.

Acceptance Criteria:
- `@ws('/chat')` decorator
- `onMessage`, `onConnect`, `onDisconnect` hooks
- Type-safe message handling
- Room/channel support

**US-017: Lifecycle Hooks**
> Sebagai backend engineer, saya ingin hooks sebelum dan sesudah handler dipanggil untuk logging, audit trail, atau transformasi response.

Acceptance Criteria:
- `beforeRequest()` untuk pre-processing
- `afterRequest()` untuk post-processing
- `onError()` untuk centralized error handling
- Access ke request context

---

## 5. FITUR DETAIL

### 5.1 Define API — Core Decorators

APICraft menggunakan 3 kategori decorators:

#### Class-Level Decorators

| Decorator | Deskripsi | Contoh |
|-----------|-----------|--------|
| `@api(prefix, options?)` | Mendefinisikan API resource | `@api('/users', { tags: ['Users'] })` |
| `@guard(GuardClass)` | Middleware auth untuk semua endpoint | `@guard(JWTAuthGuard)` |
| `@use(MiddlewareClass)` | Middleware global untuk class | `@use(LoggerMiddleware)` |
| `@version('v1')` | Versioning prefix | `@version('v1')` |

#### Method-Level Decorators

| Decorator | Deskripsi | Contoh |
|-----------|-----------|--------|
| `@get(path)` | HTTP GET | `@get('/:id')` |
| `@post(path)` | HTTP POST | `@post('/')` |
| `@put(path)` | HTTP PUT | `@put('/:id')` |
| `@patch(path)` | HTTP PATCH | `@patch('/:id')` |
| `@delete(path)` | HTTP DELETE | `@delete('/:id')` |
| `@ws(path)` | WebSocket | `@ws('/chat')` |
| `@response(status)` | Custom response status | `@response(201)` |
| `@throttle(options)` | Rate limiting | `@throttle({ window: 60000, max: 10 })` |

#### Parameter Decorators

| Decorator | Deskripsi | Contoh |
|-----------|-----------|--------|
| `@param(name, options?)` | Path parameter | `@param('id', { zod: z.string().uuid() })` |
| `@query(name, options?)` | Query parameter | `@query('page', { default: 1 })` |
| `@body(schema?)` | Request body | `@body(CreateUserDTO)` |
| `@headers(name?)` | Request header | `@headers('authorization')` |
| `@context()` | Full request context | `@context() ctx: RequestContext` |
| `@upload(name, options?)` | File upload | `@upload('avatar', { maxSize: '5mb' })` |

### 5.2 Decorator Internals & Reflection

APICraft menggunakan **reflect-metadata** untuk menyimpan metadata dekorator:

```typescript
// Internal metadata keys
const API_METADATA_KEY = 'apicraft:api'
const ROUTE_METADATA_KEY = 'apicraft:route'
const PARAM_METADATA_KEY = 'apicraft:param'

// Metadata structure yang disimpan
interface RouteMetadata {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'ws'
  path: string
  handlerName: string
  parameters: ParameterMetadata[]
  responseStatus: number
  guards: GuardClass[]
  middleware: MiddlewareClass[]
  throttle?: ThrottleOptions
}

interface ParameterMetadata {
  kind: 'param' | 'query' | 'body' | 'headers' | 'context' | 'upload'
  name: string
  index: number
  type: Type (dari reflect-metadata atau user-specified)
  options: Record<string, unknown>
}
```

### 5.3 Auto-Generate

APICraft memiliki **Generator Engine** yang membaca metadata dari decorators dan menghasilkan artefak:

#### Generator Pipeline

```
[Decorator Metadata] → [Generator Engine] → [Artefak]
                          ├── OpenAPIGenerator → openapi.json, openapi.yaml
                          ├── ClientGenerator  → client.ts, client-axios.ts
                          ├── ReactGenerator   → hooks.ts
                          ├── ZodGenerator     → schemas.ts
                          └── DocGenerator     → scalar.html, swagger.html
```

#### OpenAPIGenerator

Mengubah metadata menjadi OpenAPI 3.1 spec:

```typescript
class OpenAPIGenerator {
  generate(apis: APIDefinition[]): OpenAPI3_1Document {
    // Iterasi setiap class dengan @api
    // Iterasi setiap method dengan @get/@post/dll
    // Konversi parameter decorators ke OpenAPI parameter objects
    // Konversi return type ke response schema
    // Generate components/schemas dari tipe
    // Output: OpenAPI 3.1 compliant JSON
  }
}
```

Detail konversi:
- `@api('/users')` + `@get('/:id')` → `paths./users/{id}.get`
- `@param('id', { zod: z.string().uuid() })` → `parameters[].schema = { type: 'string', format: 'uuid' }`
- `@body(CreateUserDTO)` → `requestBody.content.application/json.schema = { $ref: '#/components/schemas/CreateUserDTO' }`
- Return type `Promise<User[]>` → `responses.200.content.application/json.schema = { type: 'array', items: { $ref: '#/components/schemas/User' } }`
- JSDoc comments → `description` dan `summary`

#### ClientSDKGenerator

Menghasilkan kode frontend yang siap pakai:

```typescript
// Generated output — fetch-based client
export class APICraftClient {
  constructor(private baseUrl: string) {}

  async listUsers(params?: { page?: number; limit?: number }): Promise<User[]> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.limit) searchParams.set('limit', String(params.limit))

    const res = await fetch(`${this.baseUrl}/users?${searchParams}`)
    if (!res.ok) throw new APIError(res.status, await res.json())
    return res.json()
  }

  async createUser(body: CreateUserDTO): Promise<User> {
    const res = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new APIError(res.status, await res.json())
    return res.json()
  }
}
```

#### ReactQueryHookGenerator

```typescript
// Generated output — React Query hooks
export function useUsersList(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['users', 'list', params],
    queryFn: () => client.listUsers(params),
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserDTO) => client.createUser(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

#### ZodSchemaGenerator

```typescript
// Generated output — reusable Zod schemas
export const listUsersParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

export const createUserBodySchema: z.ZodType<CreateUserDTO> = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
})
```

### 5.4 Validation System

APICraft memiliki validation layer berlapis:

**Layer 1: TypeScript Compile-Time**
- TypeScript compiler memastikan tipe benar saat kompilasi
- Tidak ada runtime cost

**Layer 2: Decorator-Level Validation**
- Validasi built-in: `@param('id', { zod: z.string().uuid() })`
- Konversi tipe otomatis: string query → number, boolean, date

**Layer 3: Zod Runtime Validation**
- Body dan complex parameters divalidasi dengan Zod
- Error message auto-generated dari Zod
- Custom error messages override

**Layer 4: Business Logic Validation**
- Developer bisa throw `APIError` dengan status code dan message
- Centralized error handler menangkap dan memformat

#### Error Response Format

```typescript
// Standard error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

### 5.5 Middleware System

Middleware di APICraft mengikuti pipeline pattern:

```
Request → Global Middleware → API Middleware → Guard → Handler → Response
               ↓                    ↓           ↓
            [CORS]              [Logging]   [JWT Auth]
            [Compression]       [Throttle]
```

#### Built-in Middleware

| Middleware | Deskripsi | Config |
|-----------|-----------|--------|
| `CORS` | Cross-Origin Resource Sharing | origins, methods, headers |
| `Logger` | Request/response logging | format, level, destination |
| `RateLimiter` | Rate limiting | window, max, keyGenerator |
| `Compression` | Response compression | algorithm, level |
| `JWTAuth` | JWT authentication | secret, algorithms, extractor |
| `APIKeyAuth` | API key authentication | keys, header name |
| `SessionAuth` | Session-based auth | store, cookie name |
| `Helmet` | Security headers | helmet options |

#### Custom Middleware

```typescript
import { Middleware, RequestContext } from 'apicraft'

@api('/orders')
@use(AuditMiddleware)
class OrdersAPI {
  @post('/')
  async create(@body dto: CreateOrderDTO) {
    // ...
  }
}

// Custom middleware definition
class AuditMiddleware implements Middleware {
  async before(ctx: RequestContext): Promise<void> {
    ctx.set('startTime', Date.now())
    ctx.logger.info(`Request: ${ctx.method} ${ctx.path}`)
  }

  async after(ctx: RequestContext): Promise<void> {
    const duration = Date.now() - ctx.get('startTime')
    ctx.logger.info(`Response: ${ctx.statusCode} (${duration}ms)`)
  }

  async onError(ctx: RequestContext, error: Error): Promise<void> {
    ctx.logger.error(`Error: ${error.message}`, error.stack)
  }
}
```

---

## 6. TECHNICAL ARCHITECTURE

### 6.1 Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x (strict mode) |
| Decorators | TC39 Stage 3 decorators (legacy fallback) |
| Reflection | reflect-metadata + native Reflect |
| Validation | Zod 4.x (core), Ajv (JSON Schema validation) |
| OpenAPI | OpenAPI 3.1 (JSON Schema Draft 2020-12) |
| Runtime | Node.js 20+ (LTS) |
| Build | tsup (bundling), TypeScript compiler |
| Test | Vitest + Supertest |
| Lint | Biome (ESLint replacement) |
| Package | npm/pnpm workspaces (monorepo) |

### 6.2 Package Architecture (Monorepo)

```
apicraft/
├── packages/
│   ├── core/                    # Core decorators, metadata, reflection
│   │   ├── src/
│   │   │   ├── decorators/      # @api, @get, @post, @param, @body, dll
│   │   │   ├── metadata/        # Metadata storage & retrieval
│   │   │   ├── types/           # Core TypeScript types & interfaces
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── generators/              # Artifact generators
│   │   ├── openapi/             # OpenAPI 3.1 generator
│   │   ├── client/              # TypeScript client generator
│   │   ├── react/               # React Query hooks generator
│   │   ├── zod/                 # Zod schema generator
│   │   └── docs/                # Documentation UI generator
│   │
│   ├── adapters/                # Framework adapters
│   │   ├── express/             # Express.js adapter
│   │   ├── fastify/             # Fastify adapter
│   │   ├── hono/                # Hono adapter
│   │   ├── next/                # Next.js App Router adapter
│   │   ├── koa/                 # Koa adapter
│   │   └── nest/                # NestJS adapter
│   │
│   ├── middleware/              # Built-in middleware
│   │   ├── auth/                # JWT, API key, session auth
│   │   ├── rate-limiter/        # Rate limiting (memory + Redis)
│   │   ├── logger/              # Request/response logging
│   │   ├── cors/                # CORS middleware
│   │   ├── compression/         # Response compression
│   │   └── helmet/              # Security headers
│   │
│   ├── cli/                     # CLI tools
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── init.ts      # apicraft init (scaffold project)
│   │   │   │   ├── generate.ts  # apicraft generate (run generators)
│   │   │   │   ├── serve.ts     # apicraft serve (run dev server)
│   │   │   │   └── build.ts     # apicraft build (production build)
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── create-apicraft/         # Scaffolding CLI (npm create apicraft)
│
├── examples/                    # Example projects
│   ├── todo-app/                # Simple CRUD
│   ├── ecommerce-api/           # Complex API with auth
│   └── next-integration/        # Next.js App Router example
│
├── docs/                        # Documentation site source
├── tests/                       # Integration tests
├── package.json                 # Root workspace config
└── tsconfig.json
```

### 6.3 Core Engine — Runtime Flow

```
                       APICraft Runtime
                     ┌─────────────────────────────────┐
                     │         APICraftApp              │
                     │  ┌───────────────────────────┐  │
                     │  │     DefinitionRegistry     │  │
                     │  │  - scan decorated classes   │  │
                     │  │  - extract metadata         │  │
                     │  │  - validate definitions     │  │
                     │  └──────────┬────────────────┘  │
                     │             │                    │
                     │  ┌──────────▼────────────────┐  │
                     │  │      PipelineBuilder       │  │
                     │  │  - global middleware       │  │
                     │  │  - api middleware          │  │
                     │  │  - guards                  │  │
                     │  │  - handlers                │  │
                     │  └──────────┬────────────────┘  │
                     │             │                    │
                     │  ┌──────────▼────────────────┐  │
                     │  │       Adapter Layer        │  │
                     │  │  Express │ Fastify │ Hono  │  │
                     │  └─────────────────────────┘  │
                     └─────────────────────────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │     HTTP Server          │
                     │  (Express / Fastify / etc)│
                     └─────────────────────────┘
```

### 6.4 Start-up Sequence

```typescript
// 1. User defines API
@api('/users')
class UsersAPI { ... }

// 2. User creates app
const app = APICraft.create({
  apis: [UsersAPI],
  adapter: 'express',            // atau 'fastify', 'hono'
  middleware: {                   // global middleware
    cors: { origin: '*' },
    logger: { level: 'info' },
    rateLimiter: { window: 60000, max: 100 },
  },
  openapi: {                     // OpenAPI config
    title: 'My API',
    version: '1.0.0',
  },
})

// 3. APICraft internal flow:
//    a. DefinitionRegistry.scan([UsersAPI])
//       - Iterate class methods
//       - Read decorator metadata via reflect-metadata
//       - Build RouteDefinition[]
//    b. PipelineBuilder.build(routeDefinitions)
//       - Apply global middleware
//       - Apply guards
//       - Create handler chain
//    c. Adapter.register(pipelines)
//       - Convert to Express Router
//       - Register routes
//    d. GeneratorEngine.run()
//       - Generate OpenAPI spec
//       - Generate client SDK
//       - etc.

// 4. Start server
await app.listen(3000)

// 5. CLI generate (optional)
// $ apicraft generate --openapi --client --react-hooks
```

### 6.5 Adapter Architecture

Setiap adapter mengimplementasikan interface `Adapter`:

```typescript
interface Adapter {
  name: string
  createRouter(): Router
  registerRoute(path: string, pipeline: Pipeline): void
  registerMiddleware(middleware: MiddlewareFunction): void
  start(port: number): Promise<void>
  close(): Promise<void>
}
```

**Express Adapter** — target utama, ekosistem middleware terbesar:

```typescript
class ExpressAdapter implements Adapter {
  private app: express.Application

  constructor() {
    this.app = express()
  }

  registerRoute(path: string, pipeline: Pipeline): void {
    // Pipeline → Express request handler
    // Decorator metadata → Express route registration
    this.app[pipeline.method](path, this.createHandler(pipeline))
  }
}
```

**Next.js App Router Adapter** — untuk proyek full-stack Next.js:

```typescript
class NextAdapter implements Adapter {
  registerRoute(path: string, pipeline: Pipeline): APICraftRoute {
    // Return route config untuk App Router
    return {
      method: pipeline.method,
      handler: this.createNextHandler(pipeline),
    }
  }
}
```

### 6.6 Generator Engine — Deep Dive

Generator Engine adalah pipeline transformasi dari metadata ke artefak:

```typescript
class GeneratorEngine {
  private generators: Generator[]

  constructor(definitions: APIDefinition[]) {
    this.generators = [
      new OpenAPIGenerator(definitions),
      new ClientSDKGenerator(definitions),
      new ReactQueryGenerator(definitions),
      new ZodSchemaGenerator(definitions),
      new DocUIGenerator(definitions),
    ]
  }

  async generateAll(outputDir: string): Promise<GeneratedFile[]> {
    const results: GeneratedFile[] = []

    for (const generator of this.generators) {
      const files = await generator.generate()
      for (const file of files) {
        const fullPath = join(outputDir, file.path)
        await writeFile(fullPath, file.content)
        results.push({ path: fullPath, type: file.type })
      }
    }

    return results
  }

  async watch(outputDir: string): Promise<void> {
    // Watch mode: regenerate on file changes
    const watcher = chokidar.watch('src/**/*.ts', {
      ignoreInitial: true,
    })

    watcher.on('change', async (path) => {
      // Re-scan definitions
      // Re-generate affected artifacts
      // Hot-reload dev server
    })
  }
}
```

### 6.7 Type System

APICraft memiliki type system canggih untuk inference:

```typescript
// Type inference dari handler → OpenAPI schema
type InferResponseType<T> =
  T extends Promise<infer R> ? R : T

// Query parameter inference
type InferQueryParams<T> = {
  [K in keyof T]: T[K] extends QueryParam<infer Opt>
    ? Opt['required'] extends false
      ? T[K] | undefined
      : T[K]
    : never
}

// Route registration type safety
type Routes = {
  [Path in keyof APIDefinitions]: {
    [Method in HTTPMethod]: APIDefinitions[Path][Method] extends Handler<infer P, infer B, infer R>
      ? {
          params: P
          body: B
          response: R
        }
      : never
  }
}
```

---

## 7. DATA MODEL

### 7.1 Core Data Structures

```typescript
// === Definition Registry ===

interface APIDefinition {
  /** Class name dari @api decorator */
  name: string
  /** URL prefix (@api('/users') → '/users') */
  prefix: string
  /** Version (@version('v1') → 'v1') */
  version?: string
  /** Tags untuk OpenAPI grouping */
  tags: string[]
  /** Routes di dalam API ini */
  routes: RouteDefinition[]
  /** Guards di level class */
  guards: GuardDefinition[]
  /** Middleware di level class */
  middleware: MiddlewareDefinition[]
}

interface RouteDefinition {
  /** HTTP method (get, post, put, patch, delete, ws) */
  method: HTTPMethod
  /** Path relatif terhadap prefix (@get('/:id') → '/:id') */
  path: string
  /** Full path (prefix + path) */
  fullPath: string
  /** Nama method handler */
  handlerName: string
  /** Parameter definitions */
  parameters: ParameterDefinition[]
  /** Response status code default */
  responseStatus: number
  /** Response content type */
  responseContentType: string
  /** Guards spesifik untuk route ini */
  guards: GuardDefinition[]
  /** Middleware spesifik untuk route ini */
  middleware: MiddlewareDefinition[]
  /** Rate limiting */
  throttle?: ThrottleDefinition
  /** Dokumentasi */
  summary?: string
  description?: string
}

interface ParameterDefinition {
  kind: 'param' | 'query' | 'body' | 'headers' | 'context' | 'upload'
  name: string
  index: number
  /** Type dari reflect-metadata atau user-specified */
  type: TypeSchema
  /** Zod schema (jika ada) */
  zodSchema?: z.ZodTypeAny
  /** Options */
  required: boolean
  default?: unknown
  description?: string
}

// === Types & Schemas ===

interface TypeSchema {
  kind: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'union' | 'reference'
  /** Nama tipe (untuk reference) */
  name?: string
  /** Tipe detail */
  type?: string
  /** Format (untuk OpenAPI) */
  format?: string
  /** Enum values */
  enum?: string[]
  /** Array item type */
  items?: TypeSchema
  /** Object properties */
  properties?: Record<string, TypeSchema>
  /** Required properties */
  required?: string[]
  /** Union/intersection members */
  members?: TypeSchema[]
  /** Zod info */
  zodInfo?: {
    min?: number
    max?: number
    email?: boolean
    uuid?: boolean
    pattern?: string
  }
}

// === Middleware & Guards ===

interface MiddlewareDefinition {
  class: new (...args: any[]) => Middleware
  options?: Record<string, unknown>
  scope: 'global' | 'api' | 'route'
}

interface GuardDefinition {
  class: new (...args: any[]) => Guard
  options?: Record<string, unknown>
  scope: 'api' | 'route'
}

interface Middleware {
  before?(ctx: RequestContext): Promise<void>
  after?(ctx: RequestContext): Promise<void>
  onError?(ctx: RequestContext, error: Error): Promise<void>
}

interface Guard {
  authenticate(ctx: RequestContext): Promise<boolean>
  onFailure?(ctx: RequestContext): Promise<void>
}

// === Generated Artifacts ===

interface GeneratedFile {
  path: string
  content: string
  type: 'openapi' | 'client' | 'react-hooks' | 'zod-schemas' | 'docs'
  hash: string // untuk change detection
}

// === Render-time Context ===

interface RequestContext {
  request: {
    method: string
    path: string
    params: Record<string, string>
    query: Record<string, string | string[]>
    headers: IncomingHttpHeaders
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

### 7.2 OpenAPI Spec Structure

```typescript
interface OpenAPI3_1Document {
  openapi: '3.1.0'
  info: {
    title: string
    version: string
    description?: string
  }
  servers: Array<{ url: string; description?: string }>
  paths: Record<string, PathItem>
  components: {
    schemas: Record<string, SchemaObject>
    securitySchemes?: Record<string, SecuritySchemeObject>
  }
  tags: Array<{ name: string; description?: string }>
  security?: Array<Record<string, string[]>>
}

interface PathItem {
  get?: Operation
  post?: Operation
  put?: Operation
  patch?: Operation
  delete?: Operation
  parameters?: ParameterObject[]
}

interface Operation {
  operationId: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: ParameterObject[]
  requestBody?: RequestBodyObject
  responses: Record<string, ResponseObject>
  security?: Array<Record<string, string[]>>
}
```

### 7.3 Plugin System (Fase 3)

```typescript
interface APICraftPlugin {
  name: string
  version: string
  /** Hook ke dalam lifecycle */
  hooks: {
    onDefinitionScan?: (definitions: APIDefinition[]) => void
    onRouteRegister?: (route: RouteDefinition) => void
    onGenerateOpenAPI?: (spec: OpenAPI3_1Document) => void
    onRequest?: (ctx: RequestContext) => void
    onResponse?: (ctx: RequestContext) => void
    onError?: (ctx: RequestContext, error: Error) => void
  }
  /** Middleware tambahan */
  middleware?: MiddlewareClass[]
  /** Decorators tambahan */
  decorators?: Record<string, DecoratorFactory>
  /** Generator output tambahan */
  generators?: GeneratorClass[]
}
```

---

## 8. USER FLOW

### 8.1 Day 1: Setup & First Endpoint

```
User: npm create apicraft@latest my-api
   ↓
CLI: 1. Buat project structure
     2. Install dependencies (core, adapter, zod, etc.)
     3. Buat starter file (src/index.ts)
     4. Init apicraft.config.ts
   ↓
User: Buka src/index.ts → define UsersAPI
   ↓
User: npm run dev
   ↓
APICraft: 1. Scan definitions
          2. Generate OpenAPI spec
          3. Start dev server on :3000
          4. Watch mode aktif
   ↓
User: curl http://localhost:3000/users → ✅ Response JSON
User: Buka http://localhost:3000/docs → ✅ Documentation UI
```

### 8.2 Development Loop

```
User: Edit API definition (add new endpoint)
   ↓
APICraft: 1. Detect file change (watch mode)
          2. Re-scan definitions
          3. Regenerate artifacts
          4. Hot-reload server
          5. Notify browser (HMR via WebSocket)
   ↓
User: Frontend → import generated client
User: client.listUsers() → ✅ Type-safe, always up-to-date
```

### 8.3 Full Workflow (Tim)

```
1. Backend define API
   └── @api('/orders') class OrdersAPI { ... }

2. APICraft auto-generate:
   ├── openapi.json  → Tim API review the spec
   ├── client.ts     → Frontend import langsung
   ├── hooks.ts      → React components pakai hooks
   └── schemas.ts    → Form validation di frontend

3. Frontend pakai generated code:
   └── const { data } = useOrdersList({ status: 'active' })

4. Backend update endpoint:
   └── Tambah field baru → regenerate → frontend auto dapat type baru

5. CI/CD Pipeline:
   └── apicraft generate → commit openapi.json
   └── Apakah ada breaking change? → Auto-detect via APICraft
```

### 8.4 Code-First vs Design-First

APICraft mendukung pendekatan hybrid:

| Approach | Flow | Kapan Pakai |
|----------|------|-------------|
| **Code-First** | Define code → Generate spec | Startup, prototyping, solo dev |
| **Design-First** | Import spec → Generate skeleton | Enterprise, API-first, tim besar |
| **Hybrid** | Define code → Generate spec → Edit spec → Sync back | Established product |

---

## 9. COMPETITOR ANALYSIS

### 9.1 Competitive Landscape Matrix

| Fitur | **APICraft** | tRPC | Elysia | Hono | Zodios | ts-rest | express-zod-api |
|-------|-------------|------|--------|------|--------|---------|----------------|
| **REST API** | ✅ Native | ❌ RPC | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Code-First** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **OpenAPI Gen** | ✅ Auto | ❌ | ✅ Plugin | ❌ | ✅ | ❌ | ✅ |
| **Client SDK Gen** | ✅ TS + Axios | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **React Hooks Gen** | ✅ Query + Mutation | ✅ (@tanstack) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Zod Integration** | ✅ Native | ✅ | ✅ Zod | ✅ Valibot | ✅ Zod | ✅ Zod | ✅ Zod |
| **Decorators** | ✅ TC39 Stage 3 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Multi-Adapter** | ✅ Express, Fastify, Hono, Next, Koa, Nest | ❌ (own server) | ❌ (Bun only) | ✅ Multi | ❌ | ❌ | ❌ (Express only) |
| **Error Format** | ✅ Standard | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Auth Middleware** | ✅ Built-in (JWT, API Key, Session) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Rate Limiting** | ✅ Built-in | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **File Upload** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **WebSocket** | ✅ (Fase 3) | ✅ Subscription | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CLI** | ✅ Scaffold + Gen | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Plugin System** | ✅ (Fase 3) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **MIT License** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GitHub Stars** | **New** | 35K+ | 11K+ | 15K+ | 4K+ | 5K+ | 3K+ |

### 9.2 Detailed Competitor Analysis

#### tRPC (35K+ Stars)
- **Kelebihan:** End-to-end type safety paling mature, DX luar biasa, React Query integration seamless
- **Kelemahan:** **Bukan REST** — menggunakan HTTP RPC protocol, tidak kompatibel dengan tooling REST standar (Postman, Swagger, API Gateway), frontend harus pakai tRPC client
- **Target APICraft:** "tRPC untuk REST" — memberikan e2e type safety dengan kompatibilitas REST penuh

#### Elysia (11K+ Stars)
- **Kelebihan:** Performance tinggi (Bun-native), plugin ecosystem, TypeScript-first
- **Kelemahan:** **Bun-only** — tidak bisa jalan di Node.js, ekosistem masih kecil, community masih terbatas
- **Target APICraft:** Multi-runtime (Node.js, Bun, Deno via adapters)

#### Hono (15K+ Stars)
- **Kelebihan:** Ultralight, multi-runtime (Node, Bun, Deno, Cloudflare Workers), performa tinggi
- **Kelemahan:** Minimalis — tidak ada code-first approach, tidak generate client/docs, boilerplate masih manual
- **Target APICraft:** Bisa pakai Hono sebagai adapter — best of both worlds

#### Zodios (4K+ Stars)
- **Kelebihan:** Zod + OpenAPI integration, client generation
- **Kelemahan:** Tidak ada decorators, syntax kurang ekspresif, ecosystem kecil, kurang aktif development
- **Target APICraft:** Syntax lebih clean dengan decorators, DX lebih baik

#### ts-rest (5K+ Stars)
- **Kelebihan:** End-to-end contract, multiple framework support
- **Kelemahan:** Contract-first (bukan code-first), verbose, React Query integration terbatas
- **Target APICraft:** Code-first lebih natural, decorators lebih clean

#### express-zod-api (3K+ Stars)
- **Kelebihan:** Zod + Express integration, auto-generate OpenAPI
- **Kelemahan:** Express-only, tidak ada client generation, tidak ada React hooks, syntax kurang clean
- **Target APICraft:** Multi-adapter + client generation + React hooks

### 9.3 APICraft Differentiators

1. **Code-First REST dengan Decorators** — syntax paling clean dan ekspresif
2. **Multi-Adapter Architecture** — tidak terikat framework tertentu
3. **Full Artifact Generation** — OpenAPI + Client SDK + React Hooks + Zod Schemas + Docs
4. **Type Safety End-to-End** — dari definisi sampai runtime validation
5. **Built-in Middleware** — auth, rate limiting, logging siap pakai
6. **Plugin Ecosystem** — extensible untuk kebutuhan spesifik

### 9.4 SWOT Analysis

| **Strengths** | **Weaknesses** |
|---------------|----------------|
| Syntax decorator paling clean | Baru, belum ada community |
| Multi-adapter (tidak vendor lock-in) | Decorators masih controversial di TS |
| Full artifact generation | Dependencies: reflect-metadata |
| Type safety end-to-end | Building trust butuh waktu |
| Built-in auth + rate limiting | |
| **MIT License** — no vendor lock-in | |

| **Opportunities** | **Threats** |
|-------------------|-------------|
| Trend TypeScript adoption terus naik | tRPC sudah mapan dengan 35K+ stars |
| Developer fatigue dengan boilerplate | Hono bisa add code-first layer |
| Ekosistem REST masih dominan | Elysia growing fast dengan Bun |
| Gap pasar untuk REST code-first framework | NestJS sudah punya decorators |
| Fully open source (MIT) builds trust | |

---

## 10. TIMELINE & ROADMAP

### 10.1 Fase 1: MVP (Hari 1–30)

**Tujuan:** Core decorators bisa define API + generate OpenAPI + validate + running di Express

| Minggu | Sprint | Deliverables |
|--------|--------|-------------|
| **M1** | Sprint 1 | Core decorators: `@api`, `@get`/`@post`/`@put`/`@patch`/`@delete`, `@param`, `@query`, `@body` |
| | | Metadata system dengan reflect-metadata |
| | | Basic type inference |
| **M2** | Sprint 2 | Express adapter functional |
| | | Validation layer (Zod integration) |
| | | Error handling system (APIError, centralized handler) |
| | | `APICraft.create()` + `app.listen()` |
| **M3** | Sprint 3 | OpenAPI 3.1 Generator (JSON) |
| | | `@response()` decorator |
| | | Response serialization |
| | | CLI: `apicraft init` (scaffold) |
| **M4** | Sprint 4 | API Documentation UI (Scalar) |
| | | CORS middleware |
| | | Logger middleware |
| | | Basic tests (Vitest) |
| | | npm publish alpha |

**MVP Launch Check:**
- ✅ Define API dengan decorators
- ✅ Running di Express, response JSON
- ✅ Validasi body dan parameter
- ✅ Generate OpenAPI 3.1 spec
- ✅ Generate API docs UI
- ✅ CLI scaffolding

### 10.2 Fase 2: Client Generation (Hari 31–60)

| Minggu | Sprint | Deliverables |
|--------|--------|-------------|
| **M5** | Sprint 5 | TypeScript Client SDK Generator (fetch) |
| | | TypeScript Client SDK Generator (axios) |
| | | `@guard` decorator + JWT auth guard |
| **M6** | Sprint 6 | React Query Hooks Generator |
| | | Zod Schema Generator |
| | | Zod error message customization |
| **M7** | Sprint 7 | Fastify adapter |
| | | Hono adapter |
| | | Koa adapter |
| **M8** | Sprint 8 | `@throttle` decorator + rate limiter middleware |
| | | API key auth guard |
| | | Compression middleware |
| | | Helmet middleware |
| | | OpenAPI YAML output |

### 10.3 Fase 3: Ecosystem & Production (Hari 61–90)

| Minggu | Sprint | Deliverables |
|--------|--------|-------------|
| **M9** | Sprint 9 | Next.js App Router adapter |
| | | NestJS adapter |
| | | Custom middleware support |
| | | Lifecycle hooks (`beforeRequest`, `afterRequest`, `onError`) |
| **M10** | Sprint 10 | Plugin system |
| | | `@version('v1')` — API versioning |
| | | `@upload('file')` — file upload |
| **M11** | Sprint 11 | CLI: `apicraft generate` (individual generators) |
| | | CLI: `apicraft serve` (dev server) |
| | | CLI: `apicraft build` (production build) |
| | | Watch mode + hot reload |
| **M12** | Sprint 12 | WebSocket support (`@ws`) |
| | | Performance benchmarking |
| | | Production hardening |
| | | Documentation site launch |

### 10.4 Pasca Launch

| Quarter | Focus |
|---------|-------|
| **Q2** | Deno adapter, Bun adapter, Cloudflare Workers adapter |
| **Q3** | API versioning, migration tools, plugin system |
| **Q4** | Performance optimization, production hardening |

---

## 11. OPEN SOURCE COMMITMENT

### 11.1 License
APICraft is 100% open source under the **MIT License**.

All features — including decorators, generators, adapters, middleware, and CLI — are completely free and open source. There is no premium/enterprise tier.

### 11.2 Community Edition
All current and future features will remain MIT licensed. The project is sustained through:
- GitHub Sponsors
- Community contributions
- Enterprise support contracts (optional, for large organizations)

### 11.3 Revenue Model (Future)
If monetization is introduced in the future, it will be through:
- Optional commercial support and consulting
- Premium plugins from third-party developers
- Never core framework features

The core framework will ALWAYS remain free and open source under MIT.

---

## APPENDIX

### A. Glossary

| Term | Definition |
|------|-----------|
| **Code-First** | Pendekatan di mana kode adalah source of truth, dokumentasi dan client di-generate dari kode |
| **Design-First** | Pendekatan di mana API spec ditulis dulu, kode di-generate dari spec |
| **Decorator** | Fungsi yang memodifikasi class/method/property — `@api`, `@get`, `@param` |
| **Adapter** | Layer yang menghubungkan APICraft core dengan HTTP framework (Express, Fastify, dll) |
| **Generator** | Modul yang menghasilkan artefak dari metadata definisi API |
| **Guard** | Middleware spesifik untuk authentication/authorization |
| **Pipeline** | Rangkaian middleware yang diproses secara berurutan untuk setiap request |

### B. API Design Conventions (Default)

APICraft menerapkan convention over configuration:

| Convention | Default | Bisa Diubah? |
|-----------|---------|-------------|
| Route casing | kebab-case: `/user-profiles` | ✅ |
| Parameter casing | camelCase: `page, limit` | ❌ (align with JS) |
| Response format | `{ data, meta }` untuk list, langsung untuk single | ✅ |
| Error format | `{ error: { code, message, details } }` | ✅ |
| Pagination | `?page=1&limit=10` → `{ data: [], meta: { total, page, limit } }` | ✅ |
| Status codes | 200 success, 201 created, 400 validation, 401 auth, 403 forbidden, 404 not found, 500 server | ✅ |

### C. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|------------|
| Decorators TC39 belum final | Medium | High | Support legacy decorators + Stage 3 |
| tRPC adds REST support | Low | High | Differentiate with multi-adapter + DX |
| Low adoption | Medium | High | Focus on killer features (client gen) |
| reflect-metadata performance | Low | Medium | Optimize metadata access, cache |
| Breaking changes Zod 4→5 | Medium | Medium | Pin version, migration guide |

### D. Success Metrics

| Metric | Target (3 months) | Target (12 months) |
|--------|-------------------|-------------------|
| GitHub Stars | 2,000 | 15,000 |
| Weekly npm Downloads | 5,000 | 50,000 |
| Active Projects | 500 | 10,000 |
| Enterprise Support Contracts | 10 | 500 |
| Community Contributors | 20 | 150 |
| Time to First API | < 5 menit | < 2 menit |
| NPS (Developer Survey) | 40 | 60 |

### E. Example: Complete Todo API

```typescript
import { api, get, post, patch, del, param, body, query, response, guard } from 'apicraft'
import { JWTAuthGuard } from 'apicraft/middleware'
import { z } from 'zod'

// DTOs
const CreateTodoSchema = z.object({
  title: z.string().min(1).max(255),
  completed: z.boolean().default(false),
})

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  completed: z.boolean().optional(),
})

type Todo = {
  id: string
  title: string
  completed: boolean
  userId: string
  createdAt: Date
}

// API Definition
@api('/todos', { tags: ['Todos'] })
@guard(JWTAuthGuard)
class TodosAPI {
  private todos: Todo[] = []

  @get('/')
  @response(200)
  async list(
    @query('completed') completed?: boolean,
    @query('page', { default: 1 }) page?: number,
    @query('limit', { default: 10 }) limit?: number,
  ): Promise<{ data: Todo[]; meta: { total: number; page: number; limit: number } }> {
    let filtered = this.todos
    if (completed !== undefined) {
      filtered = filtered.filter(t => t.completed === completed)
    }
    const total = filtered.length
    const data = filtered.slice((page! - 1) * limit!, page! * limit!)
    return { data, meta: { total, page: page!, limit: limit! } }
  }

  @get('/:id')
  @response(200)
  async getById(
    @param('id', { zod: z.string().uuid() }) id: string,
  ): Promise<Todo> {
    const todo = this.todos.find(t => t.id === id)
    if (!todo) throw new APIError(404, 'Todo not found')
    return todo
  }

  @post('/')
  @response(201)
  async create(
    @body({ schema: CreateTodoSchema }) data: z.infer<typeof CreateTodoSchema>,
    @context() ctx: RequestContext,
  ): Promise<Todo> {
    const todo: Todo = {
      id: crypto.randomUUID(),
      ...data,
      userId: ctx.user!.id,
      createdAt: new Date(),
    }
    this.todos.push(todo)
    return todo
  }

  @patch('/:id')
  @response(200)
  async update(
    @param('id', { zod: z.string().uuid() }) id: string,
    @body({ schema: UpdateTodoSchema }) data: z.infer<typeof UpdateTodoSchema>,
  ): Promise<Todo> {
    const index = this.todos.findIndex(t => t.id === id)
    if (index === -1) throw new APIError(404, 'Todo not found')
    this.todos[index] = { ...this.todos[index], ...data }
    return this.todos[index]
  }

  @del('/:id')
  @response(204)
  async delete(
    @param('id', { zod: z.string().uuid() }) id: string,
  ): Promise<void> {
    const index = this.todos.findIndex(t => t.id === id)
    if (index === -1) throw new APIError(404, 'Todo not found')
    this.todos.splice(index, 1)
  }
}

// App
const app = APICraft.create({
  apis: [TodosAPI],
  adapter: 'express',
  middleware: {
    cors: { origin: process.env.CORS_ORIGIN },
    logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' },
  },
  openapi: {
    title: 'Todo API',
    version: '1.0.0',
    description: 'A complete Todo API powered by APICraft',
  },
})

app.listen(3000)
```

---

## 12. TECHNICAL SPECIFICATION

### 12.1 API Reference (User-facing Framework)

```typescript
// Framework API
import { Api, Get, Post, Put, Delete, Param, Query, Body } from 'apicraft'

@Api('/users')
class UsersController {
  @Get('/')
  async list(@Query('page') page: number, @Query('limit') limit: number = 10) {
    return await db.user.findMany({ skip: (page-1)*limit, take: limit })
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    return await db.user.findUnique({ where: { id } })
  }

  @Post('/')
  async create(@Body body: CreateUserDto) {
    return await db.user.create({ data: body })
  }

  @Put('/:id')
  async update(@Param('id') id: string, @Body body: UpdateUserDto) {
    return await db.user.update({ where: { id }, data: body })
  }

  @Delete('/:id')
  async delete(@Param('id') id: string) {
    await db.user.delete({ where: { id } })
    return { success: true }
  }
}
```

### 12.2 Generated OpenAPI Output

```yaml
openapi: 3.1.0
info:
  title: Users API
  version: 1.0.0
paths:
  /users:
    get:
      parameters:
        - name: page
          in: query
          schema: { type: integer }
        - name: limit
          in: query
          schema: { type: integer, default: 10 }
      responses:
        '200':
          description: List of users
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/User' }
    post:
      requestBody:
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateUserDto' }
      responses:
        '201':
          description: Created
```

### 12.3 Sprint Plan

| Sprint | Minggu | Fokus |
|--------|--------|-------|
| S1-2 | 1-2 | Core: decorators, reflect-metadata, route registration |
| S3 | 3 | Validation: Zod integration, type inference, error messages |
| S4 | 4 | OpenAPI: spec generation, schema extraction from TS types |
| S5 | 5 | Client SDK: TypeScript fetch/axios generator, React hooks |
| S6 | 6 | Adapters: Express, Fastify, Hono, Next.js support |

### 12.4 Budget

| Item | Biaya (Rp) |
|------|-----------|
| TypeScript developer (6 minggu) | 45.000.000 |
| Documentation & examples | 8.000.000 |
| Testing with multiple frameworks | 5.000.000 |
| **Total** | **Rp 58.000.000** |
