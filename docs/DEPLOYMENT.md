# APICraft Deployment Guide

This guide covers building, configuring, and deploying APICraft applications to production environments.

> **Prerequisite reading:** [README.md](../README.md) for project setup and [DEVELOPMENT.md](./DEVELOPMENT.md) for build tooling.

---

## Table of Contents

1. [Production Build Process](#1-production-build-process)
2. [Environment Variables](#2-environment-variables)
3. [Deployment Platforms](#3-deployment-platforms)
4. [Production Configuration Best Practices](#4-production-configuration-best-practices)
5. [Health Checks and Monitoring](#5-health-checks-and-monitoring)
6. [Scaling Considerations](#6-scaling-considerations)
7. [CI/CD Pipeline Examples](#7-cicd-pipeline-examples)
8. [Database Integration Patterns](#8-database-integration-patterns)
9. [Static File Serving](#9-static-file-serving)
10. [WebSocket Deployment Considerations](#10-websocket-deployment-considerations)

---

## 1. Production Build Process

APICraft compiles TypeScript to JavaScript using the TypeScript compiler with project references (`tsc -b`).

### Building with the CLI

```bash
# Clean build with source maps
npx apicraft build --clean --sourcemap --out-dir ./dist

# Or use the package script directly
pnpm build
```

### Building with `tsc` directly

```bash
# Build all packages using project references
tsc -b

# Build only the root project
tsc -p tsconfig.json
```

The build outputs to `dist/` by default. The compiled output uses ES modules (`"type": "module"` in `package.json`).

### Running the Production Build

```bash
# Start the compiled server
node dist/index.js

# Or with the package script
pnpm start
```

### Build Output Structure

```
dist/
├── index.js              # Entry point
├── index.js.map           # Source map (if --sourcemap)
└── ...                    # Compiled source tree
```

---

## 2. Environment Variables

APICraft applications read configuration from environment variables. Define them in a `.env` file for local development and inject them via your deployment platform in production.

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (`production`, `development`, `test`) | `development` |
| `PORT` | Server port | `3000` |
| `HOST` | Server bind address | `0.0.0.0` |
| `JWT_SECRET` | Secret for JWT signing/verification | **required in production** |
| `CORS_ORIGIN` | Allowed CORS origin(s) | `*` (dev only) |

### Example `.env` File

```bash
# .env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Security — use a long random string in production
JWT_SECRET=your-super-secret-key-at-least-32-chars-long

# CORS — comma-separated for multiple origins
CORS_ORIGIN=https://app.example.com,https://admin.example.com

# Optional
LOG_LEVEL=info
```

### Loading Environment Variables

```typescript
// src/index.ts
import 'reflect-metadata'
import { APICraftApp } from '@apicraft/core'

const app = APICraftApp.create({
  apis: [],
  adapter: 'express',
  title: 'My API',
  version: '1.0.0',
  server: {
    port: Number(process.env.PORT) || 3000,
  },
  middleware: {
    cors: { origin: process.env.CORS_ORIGIN ?? '*' },
    helmet: { contentSecurityPolicy: true },
  },
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET!,
      algorithms: ['HS256'],
    },
  },
})

await app.listen(Number(process.env.PORT) || 3000)
```

---

## 3. Deployment Platforms

### Docker Containerization

#### Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@8 --activate

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm build

# Production stage
FROM node:18-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8 --activate

COPY --from=builder /app/package.json pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/dist/ ./dist/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### `.dockerignore`

```
node_modules
dist
generated
.git
*.md
tests
examples
docs
```

#### Build and Run

```bash
docker build -t my-apicraft-api .
docker run -p 3000:3000 --env-file .env my-apicraft-api
```

#### `docker-compose.yml`

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://app.example.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

### Vercel Deployment (Next.js Adapter)

For Next.js projects using the `@apicraft/adapter-next` adapter:

```bash
# Install the adapter
npm install @apicraft/adapter-next

# Deploy
vercel --prod
```

**`vercel.json`:**

```json
{
  "version": 2,
  "builds": [
    { "src": "package.json", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" }
  ],
  "env": {
    "JWT_SECRET": "@jwt-secret",
    "CORS_ORIGIN": "https://app.example.com"
  }
}
```

---

### Railway / Render Deployment

Both Railway and Render support Node.js applications out of the box.

**Build command:**
```bash
pnpm install && pnpm build
```

**Start command:**
```bash
node dist/index.js
```

**Environment variables** to set in the platform dashboard:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | (provided by platform) |
| `JWT_SECRET` | your secret |
| `CORS_ORIGIN` | your frontend URL |

---

### AWS Lambda Deployment

For serverless deployment, use the Hono adapter which has excellent edge/Lambda support.

#### Handler (`src/lambda.ts`)

```typescript
import 'reflect-metadata'
import { APICraftApp } from '@apicraft/core'

const app = APICraftApp.create({
  apis: [],
  adapter: 'hono',
  title: 'My API',
  version: '1.0.0',
})

export const handler = async (event: any, context: any) => {
  const { httpMethod, path, headers, body, queryStringParameters } = event
  // Convert Lambda event to Hono request and back
  // (Use @hono/aws-lambda adapter for seamless integration)
  return app.getWebSocketEngine() // placeholder — use Hono's AWS Lambda handler
}
```

#### `serverless.yml` (with Serverless Framework)

```yaml
service: apicraft-api

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    JWT_SECRET: ${env:JWT_SECRET}
    NODE_ENV: production

functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
```

---

### Traditional VPS Deployment with PM2

For dedicated servers or VMs:

```bash
# Install PM2 globally
npm install -g pm2

# Build the project
pnpm build

# Start with PM2
pm2 start dist/index.js --name "apicraft-api" -i max

# Save PM2 process list and set up startup script
pm2 save
pm2 startup
```

#### `ecosystem.config.js` (PM2 config)

```javascript
module.exports = {
  apps: [{
    name: 'apicraft-api',
    script: 'dist/index.js',
    instances: 'max',          // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
    },
  }],
}
```

```bash
pm2 start ecosystem.config.js --env production
```

---

## 4. Production Configuration Best Practices

### CORS

Never use `origin: '*'` in production. Specify exact origins:

```typescript
middleware: {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['https://app.example.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
}
```

### Helmet (Security Headers)

Enable all security headers in production:

```typescript
middleware: {
  helmet: {
    contentSecurityPolicy: true,
    frameguard: true,
  },
}
```

This sets headers including:
- `Content-Security-Policy: default-src 'self'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Rate Limiting

Configure global rate limiting to protect against abuse:

```typescript
middleware: {
  rateLimiter: {
    windowMs: 60_000,  // 1 minute
    max: 100,          // 100 requests per minute per IP
  },
}
```

For route-specific limits, use the `@throttle` decorator:

```typescript
@post('/login')
@throttle({ window: 60_000, max: 5 })  // 5 login attempts per minute
async login(@body() body: LoginDTO) { ... }
```

### Compression

Enable response compression to reduce bandwidth:

```typescript
middleware: {
  compression: {
    threshold: 1024,  // Only compress responses > 1KB
  },
}
```

### JWT Secrets

Always load the JWT secret from an environment variable — never hardcode it:

```typescript
auth: {
  jwt: {
    secret: process.env.JWT_SECRET!,  // Use non-null assertion only after validation
    algorithms: ['HS256'],
  },
}
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Health Checks and Monitoring

### Health Check Endpoint

Add a health check route to your API:

```typescript
import { api, get } from '@apicraft/core'

@api('/health')
export class HealthAPI {
  @get('/')
  async check() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
    }
  }

  @get('/ready')
  async ready() {
    // Check database, external services, etc.
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
    }
    const allHealthy = Object.values(checks).every(Boolean)
    return {
      status: allHealthy ? 'ready' : 'degraded',
      checks,
    }
  }
}
```

### Monitoring with PM2

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs apicraft-api

# Restart on crash
pm2 restart apicraft-api
```

### Structured Logging

Use JSON format for production logs (easier to parse and aggregate):

```typescript
middleware: {
  logger: {
    level: 'info',
    format: 'json',
  },
}
```

---

## 6. Scaling Considerations

### Clustering

Use PM2 cluster mode or Node's `cluster` module to utilize all CPU cores:

```bash
pm2 start dist/index.js -i max
```

### Load Balancing

For multiple instances, use a load balancer (nginx, HAProxy, AWS ALB):

```nginx
# nginx.conf
upstream apicraft {
    server 10.0.0.1:3000;
    server 10.0.0.2:3000;
    server 10.0.0.3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://apicraft;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Rate Limit Store

The default rate limiter uses an in-memory store. For multi-instance deployments, use a shared store (Redis):

```typescript
// TODO: Implement a Redis-backed RateLimitStore
// import { RedisRateLimitStore } from '@apicraft/middleware-rate-limiter/redis'
// middleware: { rateLimiter: { store: new RedisRateLimitStore(redisClient) } }
```

---

## 7. CI/CD Pipeline Examples

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

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
      - run: pnpm test -- --coverage
      - run: pnpm build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install -g pnpm@8
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Build Docker image
        run: docker build -t apicraft-api:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push apicraft-api:${{ github.sha }}

      - name: Deploy
        run: |
          # SSH to server and pull the new image
          ssh deploy@server "docker pull apicraft-api:${{ github.sha }} && docker-compose up -d"
```

---

## 8. Database Integration Patterns

APICraft is database-agnostic. Use any ORM or query builder in your handlers:

### Using Prisma

```typescript
import { PrismaClient } from '@prisma/client'
import { api, get, post, body, NotFoundError } from '@apicraft/core'
import { z } from 'zod'

const prisma = new PrismaClient()

@api('/users')
export class UsersAPI {
  @get('/')
  async list() {
    return prisma.user.findMany()
  }

  @get('/:id')
  async getById(@param('id') id: string) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundError('User not found')
    return user
  }

  @post('/')
  @response(201)
  async create(@body(z.object({
    name: z.string(),
    email: z.string().email(),
  })) body: { name: string; email: string }) {
    return prisma.user.create({ data: body })
  }
}
```

### Connection Pooling

Initialize the database connection once at startup, not per request:

```typescript
// src/index.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
})

// Pass to API classes via a simple dependency injection
// or use a module-level singleton
```

---

## 9. Static File Serving

For serving static files (uploads, assets), configure your adapter:

### Express

```typescript
import express from 'express'
import { ExpressAdapter } from '@apicraft/adapter-express'

const adapter = new ExpressAdapter()
adapter.app.use('/uploads', express.static('uploads'))
adapter.app.use('/public', express.static('public', { maxAge: '1d' }))
```

### General Pattern

Handle static files outside the APICraft pipeline via the underlying framework, then register APICraft routes as usual.

---

## 10. WebSocket Deployment Considerations

WebSocket connections require special deployment configuration:

### Sticky Sessions

Load balancers must use sticky sessions (also called "session affinity") so that a client's WebSocket upgrade request and subsequent messages go to the same server instance.

**nginx configuration:**

```nginx
upstream apicraft_ws {
    ip_hash;  # Sticky sessions based on client IP
    server 10.0.0.1:3000;
    server 10.0.0.2:3000;
}

server {
    location /ws {
        proxy_pass http://apicraft_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;  # 24 hours
    }
}
```

### Redis Adapter for Multi-Instance WebSocket

When running multiple instances, WebSocket room broadcasts need to propagate across instances. Use a Redis pub/sub adapter:

```typescript
// TODO: Redis-backed WebSocket room manager
// import { createRedisRoomManager } from '@apicraft/core/redis-adapter'
// const wsEngine = app.getWebSocketEngine()
// wsEngine.setRoomManager(createRedisRoomManager(redisClient))
```

### Connection Timeouts

Configure appropriate timeouts for long-lived WebSocket connections:

| Setting | Recommended Value | Purpose |
|---------|-------------------|---------|
| `proxy_read_timeout` | 86400 (24h) | nginx idle timeout |
| `proxy_send_timeout` | 86400 (24h) | nginx send timeout |
| Heartbeat interval | 30s | Application-level keepalive |

---

## Quick Deployment Checklist

- [ ] `NODE_ENV=production` set
- [ ] `JWT_SECRET` set to a strong random value (32+ characters)
- [ ] CORS origin restricted to specific domains
- [ ] Helmet security headers enabled
- [ ] Rate limiting configured
- [ ] Compression enabled
- [ ] Health check endpoint added
- [ ] Structured JSON logging enabled
- [ ] Source maps generated (for error tracking)
- [ ] Docker image built and tested
- [ ] Load balancer configured (if multi-instance)
- [ ] WebSocket sticky sessions configured (if using `@ws`)
- [ ] Environment variables injected via secrets manager
- [ ] CI/CD pipeline runs tests before deploy
