import "reflect-metadata";
import { DefinitionRegistry } from "./metadata/index.js";
import { PluginManager } from "./plugins/index.js";
import { LifecycleManager } from "./hooks/index.js";
import { WebSocketEngine, type WebSocketHandler, WS_METADATA_KEY } from "./websocket/index.js";
import type {
  APIDefinition,
  APICraftConfig,
  RouteDefinition,
  RequestContext,
  Adapter,
  MiddlewareDefinition,
  Middleware,
} from "./types/index.js";

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

    for (const apiDef of scanned) {
      for (const route of apiDef.routes) {
        const handlerName = route.handlerName;
        const cls = classes.find((c) => c.name === apiDef.name) as new (...args: unknown[]) => unknown | undefined;
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

      const allMiddleware: MiddlewareDefinition[] = [...this.globalMiddleware, ...(apiDef.middleware ?? []), ...(route.middleware ?? [])];

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

      try {
        await this.pluginManager.triggerOnRequest(ctx);
        await this.lifecycleManager.executeBeforeRequest(apiName, ctx);

        for (const mw of beforeMiddleware) {
          const mwInstance = this.instantiateClass(mw.class) as Middleware;
          await mwInstance.before?.(ctx);
        }

        const args = this.buildHandlerArgs(ctx, route);
        const result = await handler.apply(instance, args);

        if (result !== undefined) {
          ctx.response.body = result;
        }

        for (const mw of afterMiddleware) {
          const mwInstance = this.instantiateClass(mw.class) as Middleware;
          await mwInstance.after?.(ctx);
        }

        await this.lifecycleManager.executeAfterRequest(apiName, ctx);
        await this.pluginManager.triggerOnResponse(ctx);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));

        await this.lifecycleManager.executeOnError(apiName, ctx, err);
        await this.pluginManager.triggerOnError(ctx, err);

        for (const mw of errorMiddleware) {
          const mwInstance = this.instantiateClass(mw.class) as Middleware;
          await mwInstance.onError?.(ctx, err);
        }
        throw err;
      }
    };
  }

  private buildHandlerArgs(ctx: RequestContext, route: RouteDefinition): unknown[] {
    const args: unknown[] = [];

    for (const param of route.parameters) {
      switch (param.kind) {
        case "param":
          args.push(ctx.request.params[param.name]);
          break;
        case "query":
          args.push(ctx.request.query[param.name]);
          break;
        case "body":
          args.push(ctx.request.body);
          break;
        case "headers":
          args.push(param.name === "headers" || param.name === "" ? ctx.request.headers : ctx.request.headers[param.name]);
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
    const paramTypes: Array<new (...args: unknown[]) => unknown> = Reflect.getOwnMetadata("design:paramtypes", cls) ?? [];
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
        throw new Error(`Unknown adapter "${adapter}". Supported adapters: ${Object.keys(adapterMap).join(", ")}`);
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(moduleName);
        if (typeof mod.createAdapter === "function") {
          return mod.createAdapter();
        }
        throw new Error(`Adapter module "${moduleName}" does not export createAdapter().`);
      } catch (e: unknown) {
        if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") {
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

    if (middleware.cors) {
      result.push({
        class: class CorsMiddleware implements Middleware {
          async before(ctx: RequestContext): Promise<void> {
            const { origin, methods, allowedHeaders, credentials } = middleware.cors ?? {};
            if (origin) ctx.response.headers["Access-Control-Allow-Origin"] = Array.isArray(origin) ? origin.join(", ") : origin;
            if (methods) ctx.response.headers["Access-Control-Allow-Methods"] = methods.join(", ");
            if (allowedHeaders) ctx.response.headers["Access-Control-Allow-Headers"] = allowedHeaders.join(", ");
            if (credentials) ctx.response.headers["Access-Control-Allow-Credentials"] = "true";
          }
        },
        scope: "global" as const,
      });
    }

    if (middleware.helmet) {
      result.push({
        class: class HelmetMiddleware implements Middleware {
          async before(ctx: RequestContext): Promise<void> {
            ctx.response.headers["X-Content-Type-Options"] = "nosniff";
            ctx.response.headers["X-Frame-Options"] = "DENY";
            ctx.response.headers["X-XSS-Protection"] = "1; mode=block";
            ctx.response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
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

        const parameters: object[] = route.parameters
          .filter((p) => p.kind !== "body" && p.kind !== "context")
          .map((p) => ({
            name: p.name,
            in: p.kind === "param" ? "path" : p.kind === "query" ? "query" : "header",
            required: p.required,
            schema: { type: p.type.kind },
            description: p.description,
          }));

        const pathItem: Record<string, object> = {};
        pathItem[methodKey] = {
          summary: route.summary,
          operationId: `${apiDef.name}_${route.handlerName}`,
          tags: apiDef.tags,
          parameters,
          responses,
        };

        const existing = paths[pathKey] ?? {};
        paths[pathKey] = { ...existing, ...pathItem };
      }
    }

    const spec = {
      openapi: "3.1.0",
      info: {
        title: this.config.title ?? openapi?.title ?? "APICraft API",
        version: this.config.version ?? openapi?.version ?? "1.0.0",
        description: this.config.description ?? openapi?.description,
      },
      paths,
    };

    this.pluginManager.triggerOnGenerateOpenAPI(spec);

    return spec;
  }
}
