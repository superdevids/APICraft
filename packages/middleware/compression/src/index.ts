import zlib from 'zlib'
import type { Middleware, RequestContext } from '@apicraft/core'

export interface CompressionConfig {
  algorithm?: 'gzip' | 'deflate' | 'brotli'
  level?: number
  threshold?: number
  filter?: (ctx: RequestContext) => boolean
}

const ALGORITHM_PRIORITY: Array<{ name: string; header: string }> = [
  { name: 'br', header: 'br' },
  { name: 'gzip', header: 'gzip' },
  { name: 'deflate', header: 'deflate' },
]

function acceptsEncoding(ctx: RequestContext): string | null {
  const accept = ctx.request.headers['accept-encoding']
  if (!accept) return null

  const raw = Array.isArray(accept) ? accept.join(', ') : accept
  for (const alg of ALGORITHM_PRIORITY) {
    if (raw.includes(alg.header)) return alg.header
  }
  return null
}

function compressBuffer(
  buffer: Buffer,
  algorithm: string,
  level: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, result: Buffer) => {
      if (err) reject(err)
      else resolve(result)
    }

    switch (algorithm) {
      case 'gzip':
        zlib.gzip(buffer, { level }, cb)
        break
      case 'deflate':
        zlib.deflate(buffer, { level }, cb)
        break
      case 'br':
        zlib.brotliCompress(buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: level } }, cb)
        break
      default:
        reject(new Error(`Unsupported compression algorithm: ${algorithm}`))
    }
  })
}

export class CompressionMiddleware implements Middleware {
  private config: CompressionConfig

  constructor(config: CompressionConfig = {}) {
    this.config = {
      algorithm: 'gzip',
      level: 6,
      threshold: 1024,
      ...config,
    }
  }

  async before(_ctx: RequestContext): Promise<void> {
    // no pre-processing needed
  }

  async after(ctx: RequestContext): Promise<void> {
    const body = ctx.response.body

    // skip if already encoded, no body, or not a buffer/string
    if (ctx.response.headers['Content-Encoding']) return
    if (body === null || body === undefined) return

    // apply optional filter
    if (this.config.filter && !this.config.filter(ctx)) return

    const encoding = acceptsEncoding(ctx)
    if (!encoding) return

    const raw = typeof body === 'string' ? Buffer.from(body)
      : body instanceof Buffer ? body
      : Buffer.from(JSON.stringify(body))

    if (raw.length < (this.config.threshold ?? 1024)) return

    const selectedAlg = this.config.algorithm ?? 'gzip'
    const algorithm: string = encoding === 'br' ? 'br'
      : encoding === 'gzip' ? (selectedAlg === 'brotli' ? 'gzip' : selectedAlg)
      : encoding

    try {
      const compressed = await compressBuffer(raw, algorithm, this.config.level ?? 6)

      ctx.response.headers['Content-Encoding'] = algorithm
      ctx.response.headers['Content-Length'] = String(compressed.length)
      ctx.response.body = compressed
    } catch {
      // compression failed — send uncompressed
    }
  }

  async onError(_ctx: RequestContext, _error: Error): Promise<void> {
    // passthrough
  }
}

export default CompressionMiddleware
