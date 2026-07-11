import type { Middleware, RequestContext } from '@apicraft/core'

export interface HelmetConfig {
  contentSecurityPolicy?: boolean | Record<string, string[] | string>
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | string
  xContentTypeOptions?: boolean
  xXSSProtection?: boolean
  strictTransportSecurity?: string
  xPermittedCrossDomainPolicies?: string
  referrerPolicy?: string
}

const DEFAULT_DIRECTIVES: Record<string, string> = {
  "default-src": "'self'",
  "base-uri": "'self'",
  "font-src": "'self' https: data:",
  "form-action": "'self'",
  "frame-ancestors": "'self'",
  "img-src": "'self' data:",
  "object-src": "'none'",
  "script-src": "'self'",
  "script-src-attr": "'none'",
  "style-src": "'self' https: 'unsafe-inline'",
  "upgrade-insecure-requests": "",
}

function buildCSPHeader(csp: boolean | Record<string, string[] | string>): string {
  if (csp === false) return ''

  const directives: Record<string, string> = csp === true
    ? { ...DEFAULT_DIRECTIVES }
    : { ...DEFAULT_DIRECTIVES, ...normalizeCSP(csp) }

  return Object.entries(directives)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k} ${v}`)
    .join('; ')
}

function normalizeCSP(csp: Record<string, string[] | string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(csp)) {
    result[key] = Array.isArray(value) ? value.join(' ') : value
  }
  return result
}

export class HelmetMiddleware implements Middleware {
  private config: HelmetConfig

  constructor(config: HelmetConfig = {}) {
    this.config = config
  }

  async before(ctx: RequestContext): Promise<void> {
    const cspHeader = buildCSPHeader(
      this.config.contentSecurityPolicy ?? true,
    )
    if (cspHeader) {
      ctx.response.headers['Content-Security-Policy'] = cspHeader
    }

    ctx.response.headers['X-Frame-Options'] = this.config.xFrameOptions ?? 'DENY'
    ctx.response.headers['X-Content-Type-Options'] = 'nosniff'

    ctx.response.headers['X-XSS-Protection'] = this.config.xXSSProtection === true ? '1; mode=block' : '0'

    ctx.response.headers['Strict-Transport-Security'] = this.config.strictTransportSecurity ?? 'max-age=31536000; includeSubDomains'
    ctx.response.headers['X-Permitted-Cross-Domain-Policies'] = this.config.xPermittedCrossDomainPolicies ?? 'none'
    ctx.response.headers['Referrer-Policy'] = this.config.referrerPolicy ?? 'no-referrer'
  }

  async after(_ctx: RequestContext): Promise<void> {
    // no post-processing needed
  }

  async onError(_ctx: RequestContext, _error: Error): Promise<void> {
    // passthrough — security headers are already set in before()
  }
}

export default HelmetMiddleware
