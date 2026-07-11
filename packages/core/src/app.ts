import "reflect-metadata";
import { DefinitionRegistry } from "./metadata/index.js";
import { PluginManager } from "./plugins/index.js";
import { LifecycleManager } from "./hooks/index.js";
import { WebSocketEngine, type WebSocketHandler, WS_METADATA_KEY } from "./websocket/index.js";
import { APIError, AuthenticationError } from "./errors.js";
import type {
  APIDefinition,
  APICraftConfig,
  RouteDefinition,
  RequestContext,
  Adapter,
  MiddlewareDefinition,
  Middleware,
  Guard,
  GuardDefinition,
  ThrottleDefinition,
} from "./types/index.js";

// ─── In-memory throttle store for @throttle enforcement ───
interface ThrottleEntry {
  count: number;
  resetAt: number;
}
const throttleStore = new Map<string, ThrottleEntry>();

// Cleanup expired throttle entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of throttleStore) {
    if (entry.resetAt <= now) throttleStore.delete(key);
  }
}, 60_000).unref?.();

export class APICraftApp {
  private registry: DefinitionRegistry;
  private adapter: Adapter;
  private config: APICraftConfig;
  private handlerMap = new Map<string, (ctx: RequestContext) => Promise<void>>();
  private apiDefinitions: APIDefinition[] = [];
  private globalMiddleware: MiddlewareDefinition[] = [];

  private pluginManager: PluginManager;
  private lifecycleManager: LifecycleManager;
  private webSocketEngine: WebSocketEngine;

  private constructor(config: APICraftConfig) {
    this.config = config;
    this.registry = DefinitionRegistry.getInstance();
    this.adapter = this.resolveAdapter(config.adapter ?? config.server?.adapter ?? "express");
    this.globalMiddleware = this.buildGlobalMiddleware(config.middleware);
    this.pluginManager = new PluginManager();
    this.lifecycleManager = new LifecycleManager();
    this.webSocketEngine = new WebSocketEngine();
  }

  static create(config: APICraftConfig): APICraftApp {
    const app = new APICraftApp(config);
    app.initialize();
    return app;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  getLifecycleManager(): LifecycleManager {
    return this.lifecycleManager;
  }

  getWebSocketEngine(): WebSocketEngine {
    return this.webSocketEngine;
  }

  private initialize(): void {
    if (this.config.plugins) {
      for (const plugin of this.config.plugins) {
        this.pluginManager.register(plugin);
      }
    }

    const classes = this.config.apis ?? [];

    // Register WebSocket handlers
    for (const cls of classes) {
      const wsMeta: { path: string } | undefined = Reflect.getOwnMetadata(WS_METADATA_KEY, cls);
      if (wsMeta) {
        const Ctor = cls as new (...args: unknown[]) => unknown;
        const instance = this.instantiateClass(Ctor) as WebSocketHandler;
        this.webSocketEngine.register(wsMeta.path, instance);
      }
    }

    const scanned = this.registry.scan(classes);
    this.apiDefinitions = scanned;

    this.pluginManager.triggerOnDefinitionScan(this.apiDefinitions);

    // Auto-register lifecycle hooks from API class instances
    for (const cls of classes) {
      const Ctor = cls as new (...args: unknown[]) => unknown;
      try {
        const instance = this.instantiateClass(Ctor);
        this.lifecycleManager.autoRegister(cls.name, instance);
      } catch {
        // Instance creation may fail if constructor requires deps; skip
      }
    }

    for (const apiDef of scanned) {
      for (const route of apiDef.routes) {
        const handlerName = route.handlerName;
        const cls = classes.find((c) => c.name === apiDef.name) as
          | (new (...args: unknown[]) => unknown)
          | undefined;
        if (!cls) continue;

        const prototype = cls.prototype;
        if (typeof prototype[handlerName] !== "function") continue;

        this.pluginManager.triggerOnRouteRegister(route);

        const boundHandler = this.createBoundHandler(cls, handlerName, route, apiDef);
        this.handlerMap.set(route.fullPath + ":" + route.method, boundHandler);
      }
    }

    this.adapter.registerRoutes(scanned, this.handlerMap, this.globalMiddleware);
  }

  private createBoundHandler(
    cls: new (...args: unknown[]) => unknown,
    handlerName: string,
    route: RouteDefinition,
    apiDef: APIDefinition,
  ): (ctx: RequestContext) => Promise<void> {
    return async (ctx: RequestContext) => {
      const instance = this.instantiateClass(cls) as Record<string, unknown>;
      const handler = instance[handlerName] as (...args: unknown[]) => unknown;

      const apiName = apiDef.name;

      // Merge all middleware: global → API-level → route-level
      const allMiddleware: MiddlewareDefinition[] = [
        ...this.globalMiddleware,
        ...(apiDef.middleware ?? []),
        ...(route.middleware ?? []),
      ];

      const beforeMiddleware = allMiddleware.filter((m) => {
        const proto = m.class.prototype as Middleware;
        return typeof proto.before === "function";
      });

      const afterMiddleware = allMiddleware.filter((m) => {
        const proto = m.class.prototype as Middleware;
        return typeof proto.after === "function";
      });

      const errorMiddleware = allMiddleware.filter((m) => {
        const proto = m.class.prototype as Middleware;
        return typeof proto.onError === "function";
      });

      // Merge all guards: API-level → route-level
      const allGuards: GuardDefinition[] = [
        ...(apiDef.guards ?? []),
        ...(route.guards ?? []),
      ];

      try {
        // 1. Plugin onRequest hooks
        await this.pluginManager.triggerOnRequest(ctx);

        // 2. Lifecycle beforeRequest hooks
        await this.lifecycleManager.executeBeforeRequest(apiName, ctx);

        // 3. Before middleware (global → API → route)
        for (const mw of beforeMiddleware) {
          const mwInstance = this.instantiateClass(mw.class) as Middleware;
          await mwInstance.before?.(ctx);
        }

        // 4. Throttle enforcement (per-route rate limiting)
        if (route.throttle) {
          this.enforceThrottle(ctx, route.throttle);
        }

        // 5. Authentication guards
        for (const guardDef of allGuards) {
          const guardInstance = this.instantiateClass(guardDef.class) as Guard;
          const authenticated = await guardInstance.authenticate(ctx);
          if (!authenticated) {
            // Guard rejected the request
            if (typeof guardInstance.onFailure === "function") {
              await guardInstance.onFailure(ctx);
            } else {
              // Default: set 401 response
              ctx.response.statusCode = 401;
              ctx.response.body = {
                error: "Unauthorized",
                message: "Authentication required",
                statusCode: 401,
              };
            }
            return; // Stop pipeline — do not call handler
          }
        }

        // 6. Parameter extraction + handler execution
        const args = this.buildHandlerArgs(ctx, route);
        const result = await handler.apply(instance, args);

        if (result !== undefined) {
          ctx.response.body = result;
        }

        // 7. After middleware (route → API → global)
        for (const mw of afterMiddleware) {
          const mwInstance = this.instantiateClass(mw.class) as Middleware;
          await mwInstance.after?.(ctx);
        }

        // 8. Lifecycle afterRequest hooks
        await this.lifecycleManager.executeAfterRequest(apiName, ctx);

        // 9. Plugin onResponse hooks
        await this.pluginManager.triggerOnResponse(ctx);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Lifecycle onError hooks
        await this.lifecycleManager.executeOnError(apiName, ctx, err);

        // Plugin onError hooks
        await this.pluginManager.triggerOnError(ctx, err);

        // Error middleware
        for (const mw of errorMiddleware) {
          const mwInstance = this.instantiateClass(mw.class) as Middleware;
          await mwInstance.onError?.(ctx, err);
        }

        // If the error is an APIError, set the response status and body
        if (err instanceof APIError) {
          ctx.response.statusCode = err.statusCode;
          ctx.response.body = err.toJSON();
          return; // Error is handled — do not re-throw
        }

        // For AuthenticationError, set 401
        if (err instanceof AuthenticationError) {
          ctx.response.statusCode = 401;
          ctx.response.body = {
            error: "Unauthorized",
            message: err.message,
            statusCode: 401,
          };
          return;
        }

        throw err;
      }
    };
  }

  /**
   * Enforce per-route throttle using an in-memory sliding window.
   * Throws a 429 APIError when the limit is exceeded.
   */
  private enforceThrottle(ctx: RequestContext, throttle: ThrottleDefinition): void {
    const key = `${ctx.request.ip}:${ctx.request.path}`;
    const now = Date.now();
    const entry = throttleStore.get(key);

    if (!entry || entry.resetAt <= now) {
      // New window
      throttleStore.set(key, { count: 1, resetAt: now + throttle.window });
      return;
    }

    entry.count++;
    if (entry.count > throttle.max) {
      // Set rate limit headers
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      ctx.response.headers["X-RateLimit-Limit"] = String(throttle.max);
      ctx.response.headers["X-RateLimit-Remaining"] = "0";
      ctx.response.headers["X-RateLimit-Reset"] = String(entry.resetAt);
      ctx.response.headers["Retry-After"] = String(retryAfter);
      ctx.response.statusCode = 429;
      ctx.response.body = {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
        statusCode: 429,
      };
      throw new APIError(429, `Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }

    // Update headers
    ctx.response.headers["X-RateLimit-Limit"] = String(throttle.max);
    ctx.response.headers["X-RateLimit-Remaining"] = String(throttle.max - entry.count);
    ctx.response.headers["X-RateLimit-Reset"] = String(entry.resetAt);
  }

  private buildHandlerArgs(ctx: RequestContext, route: RouteDefinition): unknown[] {
    const args: unknown[] = [];

    for (const param of route.parameters) {
      switch (param.kind) {
        case "param":
          args.push(ctx.request.params[param.name]);
          break;
        case "query": {
          const queryVal = ctx.request.query[param.name];
          // Apply default value if query param is missing
          if (queryVal === undefined && param.default !== undefined) {
            args.push(param.default);
          } else {
            args.push(queryVal);
          }
          break;
        }
        case "body":
          args.push(ctx.request.body);
          break;
        case "headers":
          args.push(
            param.name === "headers" || param.name === ""
              ? ctx.request.headers
              : ctx.request.headers[param.name],
          );
          break;
        case "context":
          args.push(ctx);
          break;
        case "upload":
          args.push(ctx.request.body);
          break;
        default:
          args.push(undefined);
      }
    }

    return args;
  }

  private instantiateClass(cls: new (...args: unknown[]) => unknown): InstanceType<new (...args: unknown[]) => unknown> {
    const paramTypes: Array<new (...args: unknown[]) => unknown> =
      Reflect.getOwnMetadata("design:paramtypes", cls) ?? [];
    const resolvedDeps = paramTypes.map(() => undefined);
    return new cls(...resolvedDeps);
  }

  private resolveAdapter(adapter: APICraftConfig["adapter"]): Adapter {
    if (typeof adapter === "string") {
      if (!adapter) {
        throw new Error("No adapter specified. Set 'adapter' or 'server.adapter' in your config.");
      }
      const adapterMap: Record<string, string> = {
        express: "@apicraft/adapter-express",
        fastify: "@apicraft/adapter-fastify",
        hono: "@apicraft/adapter-hono",
        next: "@apicraft/adapter-next",
        koa: "@apicraft/adapter-koa",
        nest: "@apicraft/adapter-nest",
      };

      const moduleName = adapterMap[adapter];
      if (!moduleName) {
        throw new Error(
          `Unknown adapter "${adapter}". Supported adapters: ${Object.keys(adapterMap).join(", ")}`,
        );
      }

      try {
        const mod = require(moduleName);
        if (typeof mod.createAdapter === "function") {
          return mod.createAdapter();
        }
        throw new Error(`Adapter module "${moduleName}" does not export createAdapter().`);
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          "code" in e &&
          (e as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND"
        ) {
          throw new Error(
            `Adapter "${adapter}" is not installed. Please run: npm install ${moduleName}`,
          );
        }
        throw e;
      }
    }

    if (!adapter) {
      throw new Error("No adapter specified. Set 'adapter' or 'server.adapter' in your config.");
    }
    return adapter;
  }

  private buildGlobalMiddleware(
    middleware?: APICraftConfig["middleware"],
  ): MiddlewareDefinition[] {
    const result: MiddlewareDefinition[] = [];

    if (!middleware) return result;

    // CORS middleware
    if (middleware.cors) {
      result.push({
        class: class CorsMiddleware implements Middleware {
          async before(ctx: RequestContext): Promise<void> {
            const { origin, methods, allowedHeaders, credentials } = middleware.cors ?? {};
            if (origin)
              ctx.response.headers["Access-Control-Allow-Origin"] = Array.isArray(origin)
                ? origin.join(", ")
                : origin;
            if (methods)
              ctx.response.headers["Access-Control-Allow-Methods"] = methods.join(", ");
            if (allowedHeaders)
              ctx.response.headers["Access-Control-Allow-Headers"] = allowedHeaders.join(", ");
            if (credentials)
              ctx.response.headers["Access-Control-Allow-Credentials"] = "true";
          }
        },
        scope: "global" as const,
      });
    }

    // Logger middleware
    if (middleware.logger) {
      const loggerConfig = middleware.logger;
      result.push({
        class: class LoggerMiddleware implements Middleware {
          private startTime = 0;

          async before(ctx: RequestContext): Promise<void> {
            this.startTime = Date.now();
            const level = loggerConfig.level ?? "info";
            if (level === "debug" || level === "info") {
              ctx.logger.info(`${ctx.request.method} ${ctx.request.path}`);
            }
          }

          async after(ctx: RequestContext): Promise<void> {
            const duration = Date.now() - this.startTime;
            const level = loggerConfig.level ?? "info";
            if (level === "debug" || level === "info") {
              ctx.logger.info(
                `${ctx.request.method} ${ctx.request.path} ${ctx.response.statusCode} ${duration}ms`,
              );
            }
          }
        },
        scope: "global" as const,
      });
    }

    // Rate limiter middleware (global)
    if (middleware.rateLimiter) {
      const rlConfig = middleware.rateLimiter;
      const rlStore = new Map<string, { count: number; resetAt: number }>();

      // Cleanup interval
      setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rlStore) {
          if (entry.resetAt <= now) rlStore.delete(key);
        }
      }, 60_000).unref?.();

      result.push({
        class: class RateLimiterMiddleware implements Middleware {
          async before(ctx: RequestContext): Promise<void> {
            const window = rlConfig.windowMs ?? 60_000;
            const max = rlConfig.max ?? 100;
            const key = ctx.request.ip;
            const now = Date.now();
            const entry = rlStore.get(key);

            if (!entry || entry.resetAt <= now) {
              rlStore.set(key, { count: 1, resetAt: now + window });
              ctx.response.headers["X-RateLimit-Limit"] = String(max);
              ctx.response.headers["X-RateLimit-Remaining"] = String(max - 1);
              return;
            }

            entry.count++;
            if (entry.count > max) {
              const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
              ctx.response.headers["X-RateLimit-Limit"] = String(max);
              ctx.response.headers["X-RateLimit-Remaining"] = "0";
              ctx.response.headers["X-RateLimit-Reset"] = String(entry.resetAt);
              ctx.response.headers["Retry-After"] = String(retryAfter);
              ctx.response.statusCode = 429;
              ctx.response.body = {
                error: "Too Many Requests",
                message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
                statusCode: 429,
              };
              throw new APIError(429, `Rate limit exceeded. Retry after ${retryAfter} seconds.`);
            }

            ctx.response.headers["X-RateLimit-Limit"] = String(max);
            ctx.response.headers["X-RateLimit-Remaining"] = String(max - entry.count);
            ctx.response.headers["X-RateLimit-Reset"] = String(entry.resetAt);
          }
        },
        scope: "global" as const,
      });
    }

    // Compression middleware
    if (middleware.compression) {
      const compConfig = middleware.compression;
      result.push({
        class: class CompressionMiddleware implements Middleware {
          async after(ctx: RequestContext): Promise<void> {
            // Mark response as compressible — actual compression is handled by the adapter
            // or can be done here with zlib if body is a string/buffer
            const threshold = compConfig.threshold ?? 1024;
            const body = ctx.response.body;
            if (body === undefined) return;

            const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
            if (bodyStr.length >= threshold) {
              ctx.response.headers["Vary"] = "Accept-Encoding";
              // The adapter or framework will handle actual compression
              // Here we just set the header to indicate compression is available
              if (!ctx.response.headers["Content-Encoding"]) {
                ctx.response.headers["Content-Encoding"] = "gzip";
              }
            }
          }
        },
        scope: "global" as const,
      });
    }

    // Helmet middleware (security headers)
    if (middleware.helmet) {
      const helmetConfig = middleware.helmet;
      result.push({
        class: class HelmetMiddleware implements Middleware {
          async before(ctx: RequestContext): Promise<void> {
            // Set security headers
            if (helmetConfig.contentSecurityPolicy !== false) {
              ctx.response.headers["Content-Security-Policy"] = "default-src 'self'";
            }
            ctx.response.headers["X-Content-Type-Options"] = "nosniff";
            if (helmetConfig.frameguard !== false) {
              ctx.response.headers["X-Frame-Options"] = "DENY";
            }
            ctx.response.headers["X-XSS-Protection"] = "1; mode=block";
            ctx.response.headers["Strict-Transport-Security"] =
              "max-age=31536000; includeSubDomains";
            ctx.response.headers["X-Permitted-Cross-Domain-Policies"] = "none";
            ctx.response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
          }
        },
        scope: "global" as const,
      });
    }

    return result;
  }

  async listen(port: number): Promise<void> {
    await this.adapter.listen(port);
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }

  getOpenAPISpec(): object {
    const { openapi } = this.config;
    const paths: Record<string, Record<string, object>> = {};

    for (const apiDef of this.apiDefinitions) {
      for (const route of apiDef.routes) {
        const pathKey = route.fullPath;
        const methodKey = route.method;
        const responses: Record<string, object> = {
          [route.responseStatus]: {
            description: route.summary ?? route.description ?? "Success",
          },
        };

        // Build parameters array
        const parameters: object[] = route.parameters
          .filter((p) => p.kind !== "body" && p.kind !== "context" && p.kind !== "upload")
          .map((p) => ({
            name: p.name,
            in: p.kind === "param" ? "path" : p.kind === "query" ? "query" : "header",
            required: p.required,
            schema: { type: p.type.kind === "number" ? "number" : p.type.kind === "boolean" ? "boolean" : "string" },
            description: p.description,
            ...(p.default !== undefined ? { default: p.default } : {}),
          }));

        const operation: Record<string, unknown> = {
          summary: route.summary,
          operationId: `${apiDef.name}_${route.handlerName}`,
          tags: apiDef.tags,
          parameters,
          responses,
        };

        // Add requestBody for body parameters
        const bodyParam = route.parameters.find((p) => p.kind === "body");
        if (bodyParam) {
          operation.requestBody = {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          };
        }

        // Add security if guards are present
        const allGuards = [...(apiDef.guards ?? []), ...(route.guards ?? [])];
        if (allGuards.length > 0) {
          operation.security = allGuards.map((g) => ({
            [g.class.name || "defaultAuth"]: [],
          }));
        }

        const pathItem: Record<string, object> = {};
        pathItem[methodKey] = operation;

        const existing = paths[pathKey] ?? {};
        paths[pathKey] = { ...existing, ...pathItem };
      }
    }

    // Build security schemes
    const securitySchemes: Record<string, object> = {};
    for (const apiDef of this.apiDefinitions) {
      const allGuards = [
        ...(apiDef.guards ?? []),
        ...apiDef.routes.flatMap((r) => r.guards ?? []),
      ];
      for (const guard of allGuards) {
        const name = guard.class.name || "defaultAuth";
        if (!securitySchemes[name]) {
          securitySchemes[name] = {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          };
        }
      }
    }

    const spec: Record<string, unknown> = {
      openapi: "3.1.0",
      info: {
        title: this.config.title ?? openapi?.title ?? "APICraft API",
        version: this.config.version ?? openapi?.version ?? "1.0.0",
        description: this.config.description ?? openapi?.description,
      },
      paths,
    };

    if (Object.keys(securitySchemes).length > 0) {
      spec.components = { securitySchemes };
    }

    this.pluginManager.triggerOnGenerateOpenAPI(spec);

    return spec;
  }
}
