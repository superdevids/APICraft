import type { Server } from "node:http";
import Koa from "koa";
import Router, { type RouterContext } from "@koa/router";
import koaBody from "koa-body";

// ---------------------------------------------------------------------------
// Shared adapter types (mirrored from the Express adapter)
// ---------------------------------------------------------------------------

export type ParameterKind = "param" | "query" | "body" | "headers" | "context" | "upload";

export interface ParameterDefinition {
  kind: ParameterKind;
  name: string;
  index: number;
  default?: unknown;
}

export interface RequestContext {
  koaCtx: RouterContext;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export interface Pipeline {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
  parameters: ParameterDefinition[];
  middleware: Array<(ctx: RequestContext) => Promise<void> | void>;
  guards: Array<(ctx: RequestContext) => Promise<boolean> | boolean>;
  responseStatus?: number;
}

export interface Adapter {
  name: string;
  createRouter(): Router;
  registerRoute(path: string, pipeline: Pipeline): void;
  registerMiddleware(middleware: Koa.Middleware): void;
  start(port: number): Promise<void>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export interface ErrorDetail {
  field?: string;
  message: string;
  code: string;
}

export class APIError extends Error {
  public readonly statusCode: number;
  public readonly details?: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, APIError.prototype);
  }

  toJSON(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      error: {
        code: this.name,
        message: this.message,
      },
    };
    if (this.details && this.details.length > 0) {
      (body.error as Record<string, unknown>).details = this.details;
    }
    return body;
  }
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function buildContext(koaCtx: RouterContext): RequestContext {
  return {
    koaCtx,
    params: (koaCtx.params ?? {}) as unknown as Record<string, string>,
    query: (koaCtx.query ?? {}) as unknown as Record<string, unknown>,
    body: (koaCtx.request as { body?: unknown }).body,
    headers: koaCtx.headers as Record<string, string | string[] | undefined>,
  };
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

function extractParameters(koaCtx: RouterContext, params: ParameterDefinition[]): unknown[] {
  const args: unknown[] = [];

  for (const param of params) {
    switch (param.kind) {
      case "param":
        args[param.index] = koaCtx.params?.[param.name];
        break;
      case "query": {
        const q = koaCtx.query as unknown as Record<string, unknown>;
        args[param.index] = q?.[param.name] ?? param.default;
        break;
      }
      case "body":
        args[param.index] = (koaCtx.request as { body?: unknown }).body;
        break;
      case "headers":
        args[param.index] = param.name ? koaCtx.headers?.[param.name] : koaCtx.headers;
        break;
      case "context":
        args[param.index] = buildContext(koaCtx);
        break;
      case "upload":
        args[param.index] = (koaCtx.request as { body?: unknown }).body;
        break;
      default:
        args[param.index] = undefined;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// KoaAdapter
// ---------------------------------------------------------------------------

export class KoaAdapter implements Adapter {
  readonly name = "koa";

  readonly #app: Koa;
  readonly #router: Router;
  #server: Server | null = null;

  constructor() {
    this.#app = new Koa();
    this.#router = new Router();

    this.#app.use(koaBody());
    this.#app.use(this.#router.routes());
    this.#app.use(this.#router.allowedMethods());
  }

  get app(): Koa {
    return this.#app;
  }

  createRouter(): Router {
    return new Router();
  }

  registerRoute(path: string, pipeline: Pipeline): void {
    const handler = this.#createHandler(pipeline);

    switch (pipeline.method) {
      case "get":
        this.#router.get(path, handler);
        break;
      case "post":
        this.#router.post(path, handler);
        break;
      case "put":
        this.#router.put(path, handler);
        break;
      case "patch":
        this.#router.patch(path, handler);
        break;
      case "delete":
        this.#router.delete(path, handler);
        break;
    }
  }

  registerMiddleware(middleware: Koa.Middleware): void {
    this.#app.use(middleware);
  }

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server = this.#app.listen(port, () => {
        resolve();
      });
      this.#server.once("error", reject);
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#server) {
        resolve();
        return;
      }
      this.#server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.#server = null;
        resolve();
      });
    });
  }

  #createHandler(pipeline: Pipeline): Router.Middleware {
    return async (koaCtx: RouterContext, next: Koa.Next) => {
      try {
        const ctx = buildContext(koaCtx);

        for (const guard of pipeline.guards) {
          const allowed = await guard(ctx);
          if (!allowed) {
            koaCtx.status = 401;
            koaCtx.body = {
              error: {
                code: "UNAUTHORIZED",
                message: "Unauthorized",
              },
            };
            return;
          }
        }

        for (const mw of pipeline.middleware) {
          await mw(ctx);
        }

        const args = extractParameters(koaCtx, pipeline.parameters);

        const result = await pipeline.handler(...args);

        const statusCode = pipeline.responseStatus ?? 200;
        koaCtx.status = statusCode;
        if (result !== undefined && result !== null) {
          koaCtx.body = result;
        }
      } catch (error: unknown) {
        if (error instanceof APIError) {
          koaCtx.status = error.statusCode;
          koaCtx.body = error.toJSON();
          return;
        }
        throw error;
      }
    };
  }
}

export default KoaAdapter;
