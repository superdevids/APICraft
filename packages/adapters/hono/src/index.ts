import { Hono, type Context as HonoContext } from "hono";
import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import type {
  Adapter,
  APIDefinition,
  RequestContext,
  MiddlewareDefinition,
  Logger,
} from "@apicraft/core";
import { APIError } from "@apicraft/core";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

function createLogger(): Logger {
  return {
    info(msg: string, meta?: Record<string, unknown>): void {
      console.log(JSON.stringify({ level: "info", msg, ...meta }));
    },
    warn(msg: string, meta?: Record<string, unknown>): void {
      console.warn(JSON.stringify({ level: "warn", msg, ...meta }));
    },
    error(msg: string, meta?: Record<string, unknown>): void {
      console.error(JSON.stringify({ level: "error", msg, ...meta }));
    },
    debug(msg: string, meta?: Record<string, unknown>): void {
      console.debug(JSON.stringify({ level: "debug", msg, ...meta }));
    },
  };
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function buildContextFromHono(c: HonoContext, body: unknown): RequestContext {
  const queryRecord: Record<string, string | string[]> = {};
  const queryUrl = new URL(c.req.url);
  queryUrl.searchParams.forEach((val, key) => {
    const existing = queryRecord[key];
    if (existing === undefined) {
      queryRecord[key] = val;
    } else if (Array.isArray(existing)) {
      existing.push(val);
    } else {
      queryRecord[key] = [existing as string, val];
    }
  });

  const params: Record<string, string> = {};
  const rawParams = c.req.param();
  for (const [key, val] of Object.entries(rawParams)) {
    params[key] = String(val);
  }

  const headerRecord: Record<string, string | string[] | undefined> = {};
  c.req.raw.headers.forEach((val, key) => {
    headerRecord[key] = val;
  });

  return {
    request: {
      method: c.req.method,
      path: c.req.path,
      params,
      query: queryRecord,
      headers: headerRecord,
      body,
      ip:
        c.req.header("x-forwarded-for") ??
        c.req.header("x-real-ip") ??
        "unknown",
    },
    response: {
      statusCode: 200,
      headers: {},
      body: undefined,
    },
    state: new Map<string, unknown>(),
    logger: createLogger(),
  };
}

// ---------------------------------------------------------------------------
// Body parser
// ---------------------------------------------------------------------------

async function parseBody(c: HonoContext): Promise<unknown> {
  const contentType = c.req.header("content-type") ?? "";
  const method = c.req.method.toUpperCase();

  if (method === "GET" || method === "HEAD" || method === "DELETE") {
    return undefined;
  }

  if (contentType.includes("application/json")) {
    try {
      return await c.req.json();
    } catch {
      return undefined;
    }
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await c.req.parseBody();
      return formData as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  if (contentType.includes("text/")) {
    try {
      return await c.req.text();
    } catch {
      return undefined;
    }
  }

  try {
    const buf = await c.req.arrayBuffer();
    return Buffer.from(buf);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function serializeError(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof APIError) {
    return {
      status: error.statusCode,
      body: error.toJSON() as Record<string, unknown>,
    };
  }

  if (error instanceof SyntaxError) {
    return {
      status: 400,
      body: {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request body",
        },
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// HonoAdapter
// ---------------------------------------------------------------------------

export class HonoAdapter implements Adapter {
  readonly name = "hono";

  readonly #app: Hono;
  #server: Server | null = null;
  #handlers = new Map<string, (ctx: RequestContext) => Promise<void>>();

  constructor() {
    this.#app = new Hono();

    this.#app.use("*", async (c, next) => {
      c.res.headers.set("x-powered-by", "APICraft/Hono");
      await next();
    });
  }

  get app(): Hono {
    return this.#app;
  }

  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    _globalMiddleware: MiddlewareDefinition[],
  ): void {
    this.#handlers = handlers;

    for (const apiDef of apis) {
      for (const route of apiDef.routes) {
        this.#registerRoute(route, apiDef);
      }
    }
  }

  #registerRoute(
    route: import("@apicraft/core").RouteDefinition,
    _apiDef: APIDefinition,
  ): void {
    if (route.method === "ws") {
      return;
    }

    const method = route.method as "get" | "post" | "put" | "patch" | "delete";
    const path = route.fullPath;

    this.#app.on(method, path, async (c: HonoContext) => {
      try {
        const body = await parseBody(c);
        const ctx = buildContextFromHono(c, body);

        const handlerKey = `${route.fullPath}:${route.method}`;
        const pipelineHandler = this.#handlers.get(handlerKey);

        if (!pipelineHandler) {
          return c.json(
            {
              error: {
                code: "NOT_FOUND",
                message: `Handler not found for ${route.method.toUpperCase()} ${route.fullPath}`,
              },
            },
            404,
          );
        }

        await pipelineHandler(ctx);

        return this.#sendResponse(c, ctx);
      } catch (error: unknown) {
        const { status, body } = serializeError(error);
        return c.json(body, status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500);
      }
    });
  }

  #sendResponse(c: HonoContext, ctx: RequestContext): Response {
    const statusCode = ctx.response.statusCode;
    const headers = ctx.response.headers;

    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        c.res.headers.set(key, String(value));
      }
    }

    if (ctx.response.body === undefined || ctx.response.body === null) {
      c.status(statusCode as Parameters<HonoContext["status"]>[0]);
      return c.body(null);
    }

    return c.json(ctx.response.body, statusCode as Parameters<typeof c.json>[1]);
  }

  createRequestContext(originalReq: unknown, _originalRes: unknown): RequestContext {
    return buildContextFromHono(originalReq as HonoContext, undefined);
  }

  async sendResponse(ctx: RequestContext): Promise<void> {
    const callback = ctx.state.get("__hono_send") as
      | ((body: unknown, status: number, headers: Record<string, string>) => void)
      | undefined;
    if (callback) {
      callback(
        ctx.response.body,
        ctx.response.statusCode,
        ctx.response.headers,
      );
    }
  }

  async listen(port: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const serverInstance = serve({
        fetch: this.#app.fetch,
        port,
      });
      this.#server = serverInstance as unknown as Server;

      serverInstance.once("listening", () => {
        resolve();
      });
      serverInstance.once("error", (err: Error) => {
        reject(err);
      });
    });
  }

  async close(): Promise<void> {
    if (!this.#server) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.#server!.close((err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        this.#server = null;
        resolve();
      });
    });
  }
}

export default HonoAdapter;
