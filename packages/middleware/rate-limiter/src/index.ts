import type { Middleware, RequestContext } from '@apicraft/core'

export class RateLimitError extends Error {
  statusCode = 429
  code = 'RATE_LIMIT_EXCEEDED'

  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
    Object.setPrototypeOf(this, RateLimitError.prototype)
  }
}

export interface RateLimiterConfig {
  window?: number
  max?: number
  keyGenerator?: (ctx: RequestContext) => string
  message?: string
  statusCode?: number
}

export interface RateLimitEntry {
  count: number
  resetTime: number
}

export interface RateLimitStore {
  increment(key: string, window: number): Promise<{ count: number; resetTime: number }>
  reset(key: string): Promise<void>
}

class InMemoryStore implements RateLimitStore {
  private hits = new Map<string, RateLimitEntry>()

  async increment(key: string, window: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now()
    let entry = this.hits.get(key)

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + window }
      this.hits.set(key, entry)
    }

    entry.count++
    return { count: entry.count, resetTime: entry.resetTime }
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.hits) {
      if (now > entry.resetTime) {
        this.hits.delete(key)
      }
    }
  }
}

export class RateLimiterMiddleware implements Middleware {
  private config: RateLimiterConfig
  private store: RateLimitStore
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: RateLimiterConfig = {}, store?: RateLimitStore) {
    this.config = {
      window: 60000,
      max: 100,
      message: 'Too many requests, please try again later',
      statusCode: 429,
      ...config,
    }
    this.store = store ?? new InMemoryStore()

    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => {
        if (this.store instanceof InMemoryStore) {
          this.store.cleanup()
        }
      }, 60000)
      if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
        this.cleanupTimer.unref()
      }
    }
  }

  async before(ctx: RequestContext): Promise<void> {
    const key = this.config.keyGenerator?.(ctx) ?? ctx.request.ip
    const windowMs = this.config.window!
    const max = this.config.max!

    const { count, resetTime } = await this.store.increment(key, windowMs)

    const remaining = Math.max(0, max - count)
    ctx.response.headers['X-RateLimit-Limit'] = String(max)
    ctx.response.headers['X-RateLimit-Remaining'] = String(remaining)
    ctx.response.headers['X-RateLimit-Reset'] = String(Math.ceil(resetTime / 1000))

    if (count > max) {
      ctx.response.headers['Retry-After'] = String(Math.ceil((resetTime - Date.now()) / 1000))
      const error = new RateLimitError(this.config.message!)
      error.statusCode = this.config.statusCode!
      throw error
    }
  }

  async after(_ctx: RequestContext): Promise<void> {
    // no post-processing
  }

  async onError(_ctx: RequestContext, _error: Error): Promise<void> {
    // passthrough — rate limit errors are thrown from before()
  }

  dispose(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export default RateLimiterMiddleware
