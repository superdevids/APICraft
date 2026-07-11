import type { Middleware, RequestContext } from '@apicraft/core'

export interface CORSConfig {
  origin?: string | string[] | RegExp | ((origin: string) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

const defaultCORSConfig: Required<Pick<CORSConfig, 'origin' | 'methods' | 'allowedHeaders' | 'credentials'>> = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}

function originMatches(
  pattern: CORSConfig['origin'],
  origin: string,
): boolean {
  if (pattern === undefined || pattern === '*') return true
  if (typeof pattern === 'string') return pattern === origin
  if (Array.isArray(pattern)) return pattern.some((p) => originMatches(p, origin))
  if (pattern instanceof RegExp) return pattern.test(origin)
  if (typeof pattern === 'function') return pattern(origin)
  return false
}

export class CORSMiddleware implements Middleware {
  private config: CORSConfig

  constructor(config: CORSConfig = {}) {
    this.config = { ...defaultCORSConfig, ...config }
  }

  async before(ctx: RequestContext): Promise<void> {
    const reqOrigin = ctx.request.headers['origin'] as string | undefined

    if (reqOrigin && !originMatches(this.config.origin, reqOrigin)) {
      return
    }

    const origin = reqOrigin || '*'

    ctx.response.headers['Access-Control-Allow-Origin'] = origin

    if (this.config.credentials) {
      ctx.response.headers['Access-Control-Allow-Credentials'] = 'true'
    }

    if (this.config.exposedHeaders?.length) {
      ctx.response.headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ')
    }

    if (ctx.request.method === 'OPTIONS') {
      ctx.response.headers['Access-Control-Allow-Methods'] = this.config.methods!.join(', ')
      ctx.response.headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders!.join(', ')

      if (this.config.maxAge !== undefined) {
        ctx.response.headers['Access-Control-Max-Age'] = String(this.config.maxAge)
      }

      ctx.response.statusCode = 204
    }
  }

  async after(_ctx: RequestContext): Promise<void> {
    // no post-processing needed
  }

  async onError(_ctx: RequestContext, _error: Error): Promise<void> {
    // passthrough — CORS headers are already set in before()
  }
}

export default CORSMiddleware
