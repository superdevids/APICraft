import type {
  Adapter,
  APIDefinition,
  RequestContext,
  RouteDefinition,
  MiddlewareDefinition,
  GuardDefinition,
  Middleware,
  Guard,
  Logger,
  ParameterDefinition,
  GeneratedFile,
} from "@apicraft/core";
import { APIError, AuthenticationError } from "@apicraft/core";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NextAdapterOptions {
  apiPrefix?: string;
  logger?: Logger;
}

/**
 * A Next.js App Router route handler function signature.
 * The first argument is the NextRequest-like object, the second is the
 * route segment context containing dynamic params.
 */
export type NextHandlerFn = (
  req: unknown,
  context: { params: Record<string, string> },
) => Promise<{
  status: number;
  body: unknown;
  headers: Record<string, string>;
}>;

interface RouteEntry {
  api: APIDefinition;
  route: RouteDefinition;
  handler: (ctx: RequestContext) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METHOD_MAP: Record<string, string> = {
  get: "GET",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

// ---------------------------------------------------------------------------
// Module-level handler registry
//
// The adapter stores composed NextHandlerFn closures in this map so that
// generated route.ts files can look them up at runtime without needing
// direct access to the adapter instance.
// ---------------------------------------------------------------------------

const handlerRegistry = new Map<string, NextHandlerFn>();

/**
 * Register a composed handler in the global registry so generated route
 * files can resolve it by key at runtime.
 */
export function registerHandler(key: string, handler: NextHandlerFn): void {
  handlerRegistry.set(key, handler);
}

/**
 * Retrieve a handler previously registered via {@link registerHandler}.
 * Returns `undefined` if no handler exists for the given key.
 */
export function getHandler(key: string): NextHandlerFn | undefined {
  return handlerRegistry.get(key);
}

/**
 * Look up a handler and execute it, wrapping the result into a standardised
 * shape expected by generated route files.
 *
 * This is the primary entry-point used by generated route.ts files.
 *
 * @example Generated route.ts body:
 * ```ts
 * import { executeRequest } from "@apicraft/adapter-next"
 * export async function GET(req, { params }) {
 *   return executeRequest("GET", "/api/v1/users", req, params)
 * }
 * ```
 */
export async function executeRequest(
  method: string,
  path: string,
  req: unknown,
  params: Record<string, string>,
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const key = `${method}:${path}`;
  const handler = handlerRegistry.get(key);
  if (!handler) {
    return {
      status: 404,
      body: { error: { message: `No handler registered for ${key}` } },
      headers: {},
    };
  }
  return handler(req, { params });
}

/**
 * Create a NextRequest-like adapter that wraps a raw NextRequest (`next/server`)
 * into the shape the adapter expects.  This is used internally by generated
 * route files to bridge the native NextRequest with the adapter's handler.
 */
export function adaptNextRequest(
  method: string,
  path: string,
): (req: unknown, params: Record<string, string>) => Promise<unknown> {
  return async (req: unknown, params: Record<string, string>) => {
    return executeRequest(method, path, req, params);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultLogger(): Logger {
  return {
    info: (msg: string, meta?: Record<string, unknown>) =>
      console.log(`[APICraft:Next] ${msg}`, meta ?? ""),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      console.warn(`[APICraft:Next] ${msg}`, meta ?? ""),
    error: (msg: string, meta?: Record<string, unknown>) =>
      console.error(`[APICraft:Next] ${msg}`, meta ?? ""),
    debug: (msg: string, meta?: Record<string, unknown>) =>
      console.debug(`[APICraft:Next] ${msg}`, meta ?? ""),
  };
}

function convertPathForNextJs(apicraftPath: string): string {
  return apicraftPath.replace(/\{(\w+)\}/g, "[$1]");
}

function routeKey(method: string, fullPath: string): string {
  return `${fullPath}:${method}`;
}

/** Strip the API prefix from a path to get the relative route path. */
function stripPrefix(fullPath: string, prefix: string): string {
  if (prefix && fullPath.startsWith(prefix)) {
    return fullPath.slice(prefix.length) || "/";
  }
  return fullPath;
}

function convertToAppRouterFile(
  fullPath: string,
  outputDir: string,
): string {
  const normalized = convertPathForNextJs(fullPath).replace(/\/$/, "");
  const segments = normalized.split("/").filter(Boolean);
  const routeDir = path.join(outputDir, ...segments);
  return path.join(routeDir, "route.ts");
}

function hasGuardAuthenticate(proto: Guard): boolean {
  return typeof proto.authenticate === "function";
}

function hasMiddlewareBefore(proto: Middleware): boolean {
  return typeof proto.before === "function";
}

function hasMiddlewareAfter(proto: Middleware): boolean {
  return typeof proto.after === "function";
}

function hasMiddlewareError(proto: Middleware): boolean {
  return typeof proto.onError === "function";
}

// ---------------------------------------------------------------------------
// RequestContext builder
// ---------------------------------------------------------------------------

/**
 * Convert a framework-agnostic request object (NextRequest-like) into an
 * APICraft {@link RequestContext} that guards, middleware, and the handler
 * consume.
 */
function buildRequestContext(
  req: unknown,
  params: Record<string, string>,
  routeFullPath: string,
  defaultStatus: number,
  logger: Logger,
): RequestContext {
  const request = req as Record<string, unknown>;
  const urlStr =
    typeof request.url === "string" ? request.url : "http://localhost";

  let url: URL;
  try {
    url = new URL(urlStr, "http://localhost");
  } catch {
    url = new URL("http://localhost");
  }

  const rawHeaders = request.headers as
    | Record<string, string | string[] | undefined>
    | { forEach(cb: (v: string, k: string) => void): void; get?(name: string): string | null }
    | undefined;

  const headers: Record<string, string | string[] | undefined> = {};
  if (rawHeaders) {
    if (typeof (rawHeaders as { forEach: unknown }).forEach === "function") {
      (rawHeaders as { forEach: (cb: (v: string, k: string) => void) => void }).forEach(
        (value: string, key: string) => {
          headers[key.toLowerCase()] = value;
        },
      );
    } else {
      for (const [k, v] of Object.entries(
        rawHeaders as Record<string, string | string[] | undefined>,
      )) {
        headers[k.toLowerCase()] = v;
      }
    }
  }

  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing !== undefined) {
      query[key] = Array.isArray(existing)
        ? ([...existing, value] as string[])
        : ([existing as string, value] as string[]);
    } else {
      query[key] = value;
    }
  });

  const h = headers as Record<string, string | undefined>;
  const ip =
    h["x-forwarded-for"]?.split(",")[0]?.trim() ??
    h["x-real-ip"] ??
    h["cf-connecting-ip"] ??
    "127.0.0.1";

  const body: unknown =
    (request as Record<string, unknown>).parsedBody ??
    (request as Record<string, unknown>).body ??
    null;

  return {
    request: {
      method: (request.method as string)?.toUpperCase() ?? "GET",
      path: url.pathname,
      params,
      query,
      headers,
      body,
      ip,
    },
    response: {
      statusCode: defaultStatus,
      headers: {},
      body: undefined,
    },
    state: new Map<string, unknown>(),
    logger,
  };
}

// ---------------------------------------------------------------------------
// Composed handler runner (guards + middleware + handler + error handling)
// ---------------------------------------------------------------------------

/**
 * Run the full APICraft pipeline for a single route: guards, before
 * middleware, handler, after middleware, and error middleware on failure.
 *
 * Mutates `ctx.response` in place with the handler result or error payload.
 */
async function runPipeline(
  ctx: RequestContext,
  entry: RouteEntry,
  globalMiddleware: MiddlewareDefinition[],
): Promise<void> {
  const allMiddleware: MiddlewareDefinition[] = [
    ...globalMiddleware,
    ...(entry.api.middleware ?? []),
    ...(entry.route.middleware ?? []),
  ];

  // Guards
  const allGuards: GuardDefinition[] = [
    ...(entry.api.guards ?? []),
    ...(entry.route.guards ?? []),
  ];

  for (const guardDef of allGuards) {
    if (!hasGuardAuthenticate(guardDef.class.prototype as Guard)) continue;
    const instance = new guardDef.class() as Guard;
    const allowed = await instance.authenticate(ctx);
    if (!allowed) {
      if (typeof instance.onFailure === "function") {
        await instance.onFailure(ctx);
      }
      if (ctx.response.body === undefined) {
        throw new AuthenticationError("Access denied by guard");
      }
      throw new APIError(
        ctx.response.statusCode || 401,
        "Access denied",
        "GUARD_REJECTED",
      );
    }
  }

  // Before middleware
  for (const mwDef of allMiddleware.filter((m) =>
    hasMiddlewareBefore(m.class.prototype as Middleware),
  )) {
    const instance = new mwDef.class() as Middleware;
    await instance.before!(ctx);
  }

  // Handler
  await entry.handler(ctx);

  // After middleware
  for (const mwDef of allMiddleware.filter((m) =>
    hasMiddlewareAfter(m.class.prototype as Middleware),
  )) {
    const instance = new mwDef.class() as Middleware;
    await instance.after!(ctx);
  }
}

/**
 * Build a serialisable error object from a caught exception.
 */
function formatError(error: unknown, ctx: RequestContext): {
  status: number;
  body: unknown;
  headers: Record<string, string>;
} {
  if (error instanceof APIError) {
    return {
      status: error.statusCode,
      body: error.toJSON(),
      headers: Object.fromEntries(
        Object.entries(ctx.response.headers).filter(
          ([, v]) => v !== undefined,
        ) as [string, string][],
      ),
    };
  }

  const errMsg =
    error instanceof Error ? error.message : "Internal Server Error";
  return {
    status: 500,
    body: { error: { message: errMsg } },
    headers: Object.fromEntries(
      Object.entries(ctx.response.headers).filter(
        ([, v]) => v !== undefined,
      ) as [string, string][],
    ),
  };
}

// ---------------------------------------------------------------------------
// NextAdapter
// ---------------------------------------------------------------------------

/**
 * APICraft adapter for the **Next.js App Router**.
 *
 * Can operate in two modes:
 *
 * 1. **Code-generation mode** — call {@link generateRouteFiles} to produce
 *    `route.ts` files that Next.js App Router consumes directly.
 *
 * 2. **Direct-embed mode** — call {@link getRouteHandlers} to obtain
 *    route-handler objects that you can export from hand-written `route.ts`
 *    files.
 */
export class NextAdapter implements Adapter {
  readonly name = "next";

  private routeEntries: RouteEntry[] = [];
  private globalMiddleware: MiddlewareDefinition[] = [];
  private logger: Logger;
  private apiPrefix: string;

  constructor(options: NextAdapterOptions = {}) {
    this.logger = options.logger ?? createDefaultLogger();
    this.apiPrefix = options.apiPrefix ?? "";
  }

  // -----------------------------------------------------------------------
  // Adapter interface  (consumed by APICraftApp)
  // -----------------------------------------------------------------------

  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    globalMiddleware: MiddlewareDefinition[],
  ): void {
    this.routeEntries = [];
    this.globalMiddleware = globalMiddleware;

    for (const api of apis) {
      for (const route of api.routes) {
        const key = routeKey(route.method, route.fullPath);
        const handler = handlers.get(key);
        if (!handler) {
          this.logger.warn(
            `No handler found for ${route.method.toUpperCase()} ${route.fullPath}`,
          );
          continue;
        }
        this.routeEntries.push({ api, route, handler });
      }
    }

    // Register composed handlers in the global registry so generated route
    // files can resolve them without direct access to this adapter instance.
    for (const entry of this.routeEntries) {
      const httpMethod = METHOD_MAP[entry.route.method] ?? entry.route.method.toUpperCase();
      const registryKey = `${httpMethod}:${entry.route.fullPath}`;
      const composedHandler = this.composeHandler(entry);
      registerHandler(registryKey, composedHandler);
    }

    this.logger.info(
      `Registered ${this.routeEntries.length} route(s) for Next.js App Router`,
    );
  }

  createRequestContext(
    originalReq: unknown,
    _originalRes: unknown,
  ): RequestContext {
    return buildRequestContext(originalReq, {}, "/", 200, this.logger);
  }

  async sendResponse(_ctx: RequestContext): Promise<void> {
    // Next.js route handlers return NextResponse values — there is no
    // imperative "send".  This method is a no-op in code-generation mode;
    // in direct-embed mode the caller uses the ctx.response after invoking
    // the handler.
  }

  async listen(_port: number): Promise<void> {
    this.logger.warn(
      "Next.js adapter does not manage HTTP servers directly. " +
        "Use generateRouteFiles() to output route files, then run `next dev` / `next start`. " +
        "Alternatively, embed the adapter directly via getRouteHandlers().",
    );
  }

  async close(): Promise<void> {
    // Next.js manages its own lifecycle.
  }

  // -----------------------------------------------------------------------
  // Code-generation mode  (App Router route.ts output)
  // -----------------------------------------------------------------------

  /**
   * Generate route.ts files for every registered route into `outputDir`.
   *
   * The output directory structure mirrors the Next.js App Router convention,
   * for example:
   *
   * ```
   * {outputDir}/api/users/route.ts           (GET /api/users, POST /api/users)
   * {outputDir}/api/users/[id]/route.ts      (GET /api/users/:id)
   * ```
   *
   * Each generated file imports {@link executeRequest} from this package to
   * look up and run the correct handler at runtime.
   *
   * @returns A list of {@link GeneratedFile} descriptors.
   */
  async generateRouteFiles(outputDir: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const grouped = this.groupRoutesByPath();

    for (const [, group] of grouped) {
      const filePath = convertToAppRouterFile(
        group[0].route.fullPath,
        outputDir,
      );
      const content = this.generateRouteFileContent(group);
      files.push({ path: filePath, content, language: "typescript" });
    }

    for (const file of files) {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, file.content, "utf-8");
      this.logger.info(`Generated ${file.path}`);
    }

    this.logger.info(
      `Generated ${files.length} route file(s) in ${outputDir}`,
    );
    return files;
  }

  /**
   * Obtain a flat map of `"METHOD:/path"` → Next.js route handler that you
   * can export from hand-written route.ts files.
   *
   * @example
   * ```ts
   * // src/app/api/users/route.ts
   * import { adapter } from "@/lib/apicraft"
   * const handlers = adapter.getRouteHandlers()
   * export const GET = handlers["GET:/api/v1/users"]
   * export const POST = handlers["POST:/api/v1/users"]
   * ```
   */
  getRouteHandlers(): Record<string, NextHandlerFn> {
    const result: Record<string, NextHandlerFn> = {};
    for (const entry of this.routeEntries) {
      const httpMethod =
        METHOD_MAP[entry.route.method] ?? entry.route.method.toUpperCase();
      const key = `${httpMethod}:${entry.route.fullPath}`;
      result[key] = this.composeHandler(entry);
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Group RouteEntry objects by their fullPath so routes sharing a path
   * (e.g. GET /users + POST /users) end up in the same route.ts file.
   */
  private groupRoutesByPath(): Map<string, RouteEntry[]> {
    const grouped = new Map<string, RouteEntry[]>();
    for (const entry of this.routeEntries) {
      const key = entry.route.fullPath;
      const group = grouped.get(key);
      if (group) {
        group.push(entry);
      } else {
        grouped.set(key, [entry]);
      }
    }
    return grouped;
  }

  /**
   * Generate the TypeScript source for a single route.ts file that handles
   * one or more HTTP methods on the same path.
   */
  private generateRouteFileContent(entries: RouteEntry[]): string {
    const sorted = [...entries].sort(
      (a, b) =>
        HTTP_METHODS.indexOf(
          METHOD_MAP[a.route.method] as (typeof HTTP_METHODS)[number],
        ) -
        HTTP_METHODS.indexOf(
          METHOD_MAP[b.route.method] as (typeof HTTP_METHODS)[number],
        ),
    );

    const lines: string[] = [];

    lines.push("// Auto-generated by APICraft — do not edit.");
    lines.push("");
    lines.push('import { NextRequest, NextResponse } from "next/server";');
    lines.push('import { executeRequest } from "@apicraft/adapter-next";');
    lines.push("");

    for (const entry of sorted) {
      const httpMethod =
        METHOD_MAP[entry.route.method] ?? entry.route.method.toUpperCase();
      const key = `${httpMethod}:${entry.route.fullPath}`;
      const hasParams = entry.route.fullPath.includes("{");
      const desc = entry.route.summary ?? entry.route.description ?? "";

      lines.push(
        hasParams
          ? `// ${httpMethod} ${entry.route.fullPath} — ${desc}`
          : `// ${httpMethod} ${entry.route.fullPath}${desc ? ` — ${desc}` : ""}`,
      );
      lines.push(
        `export async function ${httpMethod}(`,
      );
      lines.push(`  request: NextRequest,`);
      lines.push(
        hasParams
          ? `  { params }: { params: Record<string, string> },`
          : `  _context: { params: Record<string, string> },`,
      );
      lines.push(`): Promise<NextResponse> {`);
      lines.push(`  const result = await executeRequest(`);
      lines.push(`    "${httpMethod}",`);
      lines.push(`    "${entry.route.fullPath}",`);
      lines.push(`    request,`);
      lines.push(
        hasParams ? `    params,` : `    {} as Record<string, string>,`,
      );
      lines.push(`  );`);
      lines.push("");
      lines.push(`  if (result.status >= 400 && typeof result.body === "object" && result.body !== null) {`);
      lines.push(`    return NextResponse.json(result.body, {`);
      lines.push(`      status: result.status,`);
      lines.push(`      headers: result.headers as Record<string, string>,`);
      lines.push(`    });`);
      lines.push(`  }`);
      lines.push("");
      lines.push(`  if (result.body !== null && result.body !== undefined) {`);
      lines.push(`    return NextResponse.json(result.body, {`);
      lines.push(`      status: result.status,`);
      lines.push(`      headers: result.headers as Record<string, string>,`);
      lines.push(`    });`);
      lines.push(`  }`);
      lines.push("");
      lines.push(`  return new NextResponse(null, { status: result.status });`);
      lines.push(`}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Compose a single route entry into a {@link NextHandlerFn} that handles
   * the full lifecycle: guards → before middleware → handler → after
   * middleware → error middleware.
   *
   * The returned handler returns a plain `{ status, body, headers }` object
   * so it can be used by both the global handler registry (for generated
   * files) and by direct-embed consumers.
   */
  private composeHandler(entry: RouteEntry): NextHandlerFn {
    return async (
      req: unknown,
      { params }: { params: Record<string, string> },
    ) => {
      const ctx = buildRequestContext(
        req,
        params,
        entry.route.fullPath,
        entry.route.responseStatus ?? 200,
        this.logger,
      );

      try {
        await runPipeline(ctx, entry, this.globalMiddleware);

        return {
          status: ctx.response.statusCode || entry.route.responseStatus || 200,
          body: ctx.response.body ?? null,
          headers: Object.fromEntries(
            Object.entries(ctx.response.headers).filter(
              ([, v]) => v !== undefined,
            ) as [string, string][],
          ),
        };
      } catch (error: unknown) {
        // Error middleware
        const allMiddleware: MiddlewareDefinition[] = [
          ...this.globalMiddleware,
          ...(entry.api.middleware ?? []),
          ...(entry.route.middleware ?? []),
        ];
        for (const mwDef of allMiddleware.filter((m) =>
          hasMiddlewareError(m.class.prototype as Middleware),
        )) {
          const instance = new mwDef.class() as Middleware;
          await instance.onError!(
            ctx,
            error instanceof Error ? error : new Error(String(error)),
          );
        }

        // If error middleware set a response body, use that.
        if (ctx.response.body !== undefined) {
          return {
            status: ctx.response.statusCode || 500,
            body: ctx.response.body,
            headers: Object.fromEntries(
              Object.entries(ctx.response.headers).filter(
                ([, v]) => v !== undefined,
              ) as [string, string][],
            ),
          };
        }

        return formatError(error, ctx);
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Factory function that the core `APICraftApp.resolveAdapter()` method calls
 * when the adapter string `"next"` is configured.
 *
 * @param options - Optional configuration for the adapter.
 * @returns A configured {@link NextAdapter} instance.
 */
export function createAdapter(options: NextAdapterOptions = {}): NextAdapter {
  return new NextAdapter(options);
}

// ---------------------------------------------------------------------------
// Utility exports  (consumed by generated route files at runtime)
// ---------------------------------------------------------------------------

/**
 * Convert an APICraft-style path segment with `{param}` placeholders to the
 * Next.js App Router `[param]` convention.
 *
 * @example
 * ```ts
 * toNextPath("/api/users/{id}") // "/api/users/[id]"
 * ```
 */
export function toNextPath(apicraftPath: string): string {
  return convertPathForNextJs(apicraftPath);
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default NextAdapter;
