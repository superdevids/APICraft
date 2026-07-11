import jwt from 'jsonwebtoken'
import type { Guard, RequestContext } from '@apicraft/core'

// ────────────────────────────────────────
// JWT Auth Guard
// ────────────────────────────────────────

export interface JWTConfig {
  secret: string
  algorithms?: string[]
  headerName?: string
  scheme?: string
}

export class JWTAuthGuard implements Guard {
  private config: JWTConfig

  constructor(config: JWTConfig) {
    this.config = {
      headerName: 'authorization',
      scheme: 'Bearer',
      algorithms: ['HS256'],
      ...config,
    }
  }

  async authenticate(ctx: RequestContext): Promise<boolean> {
    const headerValue = ctx.request.headers[this.config.headerName!.toLowerCase()]
    if (!headerValue) return false

    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue
    const scheme = this.config.scheme!
    if (!value.startsWith(scheme + ' ')) return false

    const token = value.slice(scheme.length + 1).trim()
    if (!token) return false

    try {
      const decoded = jwt.verify(token, this.config.secret, {
        algorithms: this.config.algorithms as jwt.Algorithm[],
      })
      ctx.user = {
        id: (decoded as jwt.JwtPayload).sub ?? 'unknown',
        roles: ((decoded as jwt.JwtPayload).roles as string[]) ?? [],
        ...(typeof decoded === 'object' ? decoded : {}),
      }
      return true
    } catch {
      return false
    }
  }

  async onFailure(ctx: RequestContext): Promise<void> {
    ctx.response.statusCode = 401
    ctx.response.body = {
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    }
  }
}

// ────────────────────────────────────────
// API Key Auth Guard
// ────────────────────────────────────────

export interface APIKeyConfig {
  keys: string[] | Record<string, unknown>
  headerName?: string
  queryParam?: string
}

export class APIKeyAuthGuard implements Guard {
  private config: APIKeyConfig
  private keyMap: Map<string, unknown>

  constructor(config: APIKeyConfig) {
    this.config = {
      headerName: 'x-api-key',
      queryParam: 'api_key',
      ...config,
    }
    this.keyMap = Array.isArray(config.keys)
      ? new Map(config.keys.map((k) => [k, k]))
      : new Map(Object.entries(config.keys))
  }

  async authenticate(ctx: RequestContext): Promise<boolean> {
    const headerValue = ctx.request.headers[this.config.headerName!.toLowerCase()]
    const queryValue = ctx.request.query[this.config.queryParam!]

    const key = Array.isArray(headerValue) ? headerValue[0]
      : headerValue ?? (Array.isArray(queryValue) ? queryValue[0] : queryValue)

    if (!key || typeof key !== 'string') return false

    const userData = this.keyMap.get(key)
    if (!userData) return false

    if (typeof userData === 'object' && userData !== null) {
      ctx.user = {
        id: String((userData as Record<string, unknown>).id ?? key),
        roles: ((userData as Record<string, unknown>).roles as string[]) ?? [],
        ...(userData as Record<string, unknown>),
      }
    } else {
      ctx.user = {
        id: key,
        roles: [],
      }
    }
    return true
  }

  async onFailure(ctx: RequestContext): Promise<void> {
    ctx.response.statusCode = 401
    ctx.response.body = {
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
    }
  }
}

// ────────────────────────────────────────
// Session Auth Guard
// ────────────────────────────────────────

export interface SessionConfig {
  store: Map<string, unknown>
  cookieName?: string
  secret: string
}

export class SessionAuthGuard implements Guard {
  private config: SessionConfig

  constructor(config: SessionConfig) {
    this.config = {
      cookieName: 'session',
      ...config,
    }
  }

  async authenticate(ctx: RequestContext): Promise<boolean> {
    const cookieHeader = ctx.request.headers['cookie']
    if (!cookieHeader) return false

    const raw = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const cookies = this.parseCookies(raw)
    const sessionId = cookies[this.config.cookieName!]
    if (!sessionId) return false

    const sessionData = this.config.store.get(sessionId)
    if (!sessionData) return false

    ctx.user = {
      id: String((sessionData as Record<string, unknown>).id ?? 'session-user'),
      roles: ((sessionData as Record<string, unknown>).roles as string[]) ?? [],
      ...(sessionData as Record<string, unknown>),
    }
    return true
  }

  async onFailure(ctx: RequestContext): Promise<void> {
    ctx.response.statusCode = 401
    ctx.response.body = {
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' },
    }
  }

  private parseCookies(raw: string): Record<string, string> {
    const result: Record<string, string> = {}
    for (const pair of raw.split(';')) {
      const idx = pair.indexOf('=')
      if (idx === -1) continue
      const key = pair.slice(0, idx).trim()
      const value = pair.slice(idx + 1).trim()
      if (key) result[key] = decodeURIComponent(value)
    }
    return result
  }
}

export { JWTAuthGuard as default }
