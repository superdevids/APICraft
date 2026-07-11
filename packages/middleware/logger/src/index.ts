import { appendFileSync } from 'fs'
import type { Middleware, RequestContext } from '@apicraft/core'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFormat = 'json' | 'dev' | 'combined'

export interface LoggerConfig {
  level?: LogLevel
  format?: LogFormat
  destination?: 'console' | 'file'
  filePath?: string
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function shouldLog(configured: LogLevel, messageLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[configured]
}

export class LoggerMiddleware implements Middleware {
  private config: LoggerConfig


  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: 'info',
      format: 'dev',
      destination: 'console',
      ...config,
    }
  }

  async before(ctx: RequestContext): Promise<void> {
    ctx.state.set('startTime', Date.now())
    if (shouldLog(this.config.level!, 'info')) {
      this.log(`${ctx.request.method} ${ctx.request.path} →`, 'info')
    }
  }

  async after(ctx: RequestContext): Promise<void> {
    const startTime = ctx.state.get('startTime') as number | undefined
    const duration = startTime !== undefined ? Date.now() - startTime : 0
    const status = ctx.response.statusCode
    const level: LogLevel = status >= 400 ? 'warn' : 'info'
    if (shouldLog(this.config.level!, level)) {
      this.log(`${ctx.request.method} ${ctx.request.path} ${status} ${duration}ms`, level)
    }
  }

  async onError(ctx: RequestContext, error: Error): Promise<void> {
    if (shouldLog(this.config.level!, 'error')) {
      this.log(`ERROR ${ctx.request.method} ${ctx.request.path}: ${error.message}`, 'error')
    }
  }

  private log(message: string, level: LogLevel): void {
    const timestamp = new Date().toISOString()

    let formatted: string
    switch (this.config.format) {
      case 'json':
        formatted = JSON.stringify({ timestamp, level, message })
        break
      case 'combined':
        formatted = `${timestamp} ${level.toUpperCase()} [${process.pid}] ${message}`
        break
      case 'dev':
      default:
        formatted = `[${timestamp}] ${level.toUpperCase()}: ${message}`
        break
    }

    if (this.config.destination === 'file' && this.config.filePath) {
      this.writeToFile(formatted)
    } else {
      this.writeToConsole(formatted, level)
    }
  }

  private writeToConsole(formatted: string, level: LogLevel): void {
    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      default:
        console.log(formatted)
        break
    }
  }

  private writeToFile(formatted: string): void {
    try {
      appendFileSync(this.config.filePath!, formatted + '\n', 'utf-8')
    } catch {
      this.writeToConsole(formatted, 'warn')
    }
  }
}

export default LoggerMiddleware
