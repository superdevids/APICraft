# Security Policy

## Supported Versions

APICraft is currently in active development (v0.x). Security updates are provided for the latest minor release within the current major version.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active development — security fixes provided |
| < 0.1   | ❌ Not supported |

Once a stable 1.0.0 release is published, security updates will be provided for all versions within the 1.x line for at least 12 months after the release of the subsequent major version.

---

## Reporting a Vulnerability

We take security issues seriously. If you discover a security vulnerability in APICraft, please follow these steps:

### Do NOT Open a Public Issue

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests. Instead, report them privately.

### Private Disclosure Process

1. **Email** — Send details to **security@apicraft.dev**
2. **Encryption** — If possible, encrypt your report using our PGP key (available on request)
3. **Response time** — We acknowledge receipt within **48 hours** and provide an initial assessment within **5 business days**
4. **Updates** — We keep you informed of progress toward resolution
5. **Publication** — After a fix is released, we coordinate public disclosure with you

### What to Include

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Affected components (packages, versions)
- Steps to reproduce (proof of concept is ideal)
- Potential impact
- Any suggested mitigations

### What to Expect

- **Confirmed vulnerability** — We release a fix in the next patch release and credit the reporter (if desired)
- **Declined vulnerability** — We explain our reasoning and may request additional information
- **Non-vulnerability** — We explain why the reported behavior is not considered a security issue

---

## Security Best Practices

### For API Developers Using APICraft

#### Authentication

```typescript
import { JWTAuthGuard, APIKeyAuthGuard } from '@apicraft/middleware-auth'

// Use strong secrets for JWT
@guard(JWTAuthGuard, {
  secret: process.env.JWT_SECRET,  // Always use environment variables
  algorithms: ['HS256'],           // Specify algorithms explicitly
})

// Rotate API keys regularly
@guard(APIKeyAuthGuard, {
  keys: process.env.API_KEYS,      // Store in environment, not in code
  headerName: 'x-api-key',
})
```

#### Input Validation

```typescript
import { z } from 'zod'

@post('/')
async create(@body(z.object({
  email: z.string().email(),        // Validate format
  age: z.number().min(0).max(150),  // Constrain ranges
  role: z.enum(['user', 'admin']),  // Restrict enum values
})) body: CreateUserInput) {
  // Business logic here
}
```

#### Rate Limiting

```typescript
// Protect sensitive endpoints with stricter limits
@throttle({ window: 60000, max: 10 })  // 10 requests per minute
@post('/auth/login')
async login(@body body: LoginInput) { ... }

// Apply globally to all routes
APICraftApp.create({
  middleware: {
    rateLimiter: {
      window: 60000,
      max: 100,            // 100 requests per minute per IP
    },
  },
})
```

#### Security Headers

```typescript
APICraftApp.create({
  middleware: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'cdn.example.com'],
          // ... custom CSP directives
        },
      },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    },
  },
})
```

### General Security Guidelines

- **Use HTTPS in production** — Never serve production APIs over plain HTTP
- **Validate all input** — Use Zod schemas with `@body`, `@query`, and `@param` decorators
- **Apply least privilege** — Use API-key-level permissions, not a single global key
- **Rotate secrets** — Regularly rotate JWT secrets, API keys, and session secrets
- **Set appropriate CORS policies** — Restrict origins to specific domains, not wildcards
- **Use environment variables** — Never hard-code secrets, keys, or configuration
- **Keep dependencies updated** — Regularly run `npm audit` or `pnpm audit`
- **Enable helmet middleware** — Always enable Helmet in production for security headers
- **Rate limit globally** — Always apply rate limiting to prevent abuse

---

## Authentication & Authorization

### JWT Authentication

```typescript
@guard(JWTAuthGuard, {
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  headerName: 'authorization',
  scheme: 'Bearer',
})
```

The `JWTAuthGuard` validates the `Authorization: Bearer <token>` header using `jsonwebtoken`. On successful authentication, the decoded payload is available at `ctx.user`.

### API Key Authentication

```typescript
@guard(APIKeyAuthGuard, {
  keys: {
    'sk-prod-abc123': { role: 'admin', name: 'Production Key' },
    'sk-dev-def456': { role: 'readonly', name: 'Development Key' },
  },
  headerName: 'x-api-key',    // Default
  queryParam: 'api_key',       // Alternative
})
```

API keys can be sent via the `x-api-key` header or as a query parameter. Each key maps to user data that is set on `ctx.user`.

### Session Authentication

```typescript
@guard(SessionAuthGuard, {
  store: sessionStore,          // Your session store (Map or custom)
  cookieName: 'session_id',
  secret: process.env.SESSION_SECRET,
})
```

Session IDs are extracted from cookies and looked up in the configured store.

---

## Rate Limiting

The rate limiter uses a sliding window algorithm:

```typescript
APICraftApp.create({
  middleware: {
    rateLimiter: {
      window: 60000,           // 1 minute window
      max: 60,                 // 60 requests per window
      keyGenerator: (ctx) => ctx.request.ip,  // Default: IP-based
      message: 'Too many requests',           // Custom error message
      statusCode: 429,        // Custom status code
    },
  },
})
```

### Default Limits by Environment

| Environment | Window | Max Requests |
|-------------|--------|--------------|
| Development | 1 min  | 1000         |
| Production  | 1 min  | 60           |

---

## Data Validation

APICraft enforces validation at multiple levels:

1. **TypeScript types** — Static analysis at compile time
2. **Decorator options** — Constraints specified in decorator configuration
3. **Zod schemas** — Runtime validation using Zod
4. **Business logic** — Application-specific validation in handler code

```typescript
@post('/users')
async create(
  @body(z.object({
    email: z.string().email('Invalid email format'),
    age: z.number().int().min(18, 'Must be at least 18').max(120),
    role: z.enum(['user', 'admin']).default('user'),
  })) body: CreateUserInput
) {
  // Business validation
  if (await this.emailExists(body.email)) {
    throw new ValidationError('Email already registered')
  }
  // ...
}
```

---

## Dependency Security

We use automated tools to monitor and update dependencies:

- **Dependabot** — Automated dependency update PRs
- **npm audit / pnpm audit** — Regular vulnerability scanning in CI
- **Socket.dev** — Supply chain security monitoring

All dependencies are pinned to specific versions in `pnpm-lock.yaml`.

---

## Vulnerability Disclosure Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Report received | Day 0 | Security team acknowledges receipt |
| Triage | Days 0–2 | Assess severity and affected versions |
| Patch development | Days 2–10 | Develop and test fix |
| Patch release | Day 10 | Release patched version |
| Public disclosure | Day 10+ | Publish advisory and credit reporter |
