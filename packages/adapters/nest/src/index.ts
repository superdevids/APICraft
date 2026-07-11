import "reflect-metadata";

import {
  type DynamicModule,
  type INestApplication,
  type Type,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { Request, Response } from "express";
import type {
  Adapter,
  APIDefinition,
  Logger,
  MiddlewareDefinition,
  RequestContext,
  RouteDefinition,
} from "@apicraft/core";
import { APIError } from "@apicraft/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HTTP_METHOD_DECORATORS: Record<string, (path?: string) => MethodDecorator> = {
  get: Get,
  post: Post,
  put: Put,
  patch: Patch,
  delete: Delete,
};

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_$]/g, "_");
}

function createLogger(): Logger {
  return {
    info: (msg, meta?) => console.log(`[APICraft] ${msg}`, meta ?? ""),
    warn: (msg, meta?) => console.warn(`[APICraft] ${msg}`, meta ?? ""),
    error: (msg, meta?) => console.error(`[APICraft] ${msg}`, meta ?? ""),
    debug: (msg, meta?) => console.debug(`[APICraft] ${msg}`, meta ?? ""),
  };
}

/** Internal extension that stashes the raw response for sendResponse(). */
interface ContextWithRaw extends RequestContext {
  __rawResponse?: Response;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class NestJSAdapter implements Adapter {
  readonly name = "nest";

  private app: INestApplication | null = null;
  private apis: APIDefinition[] = [];
  private handlerMap = new Map<string, (ctx: RequestContext) => Promise<void>>();
  private globalMiddleware: MiddlewareDefinition[] = [];
  private extraControllers: Type<object>[] = [];

  // -----------------------------------------------------------------------
  // Core Adapter interface
  // -----------------------------------------------------------------------

  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    globalMiddleware: MiddlewareDefinition[],
  ): void {
    this.apis = apis;
    this.handlerMap = handlers;
    this.globalMiddleware = globalMiddleware;
  }

  createRequestContext(originalReq: unknown, originalRes: unknown): RequestContext {
    const req = originalReq as Request;
    const res = originalRes as Response;

    const ctx: ContextWithRaw = {
      __rawResponse: res,
      request: {
        method: req.method.toLowerCase(),
        path: req.path,
        params: (req.params ?? {}) as Record<string, string>,
        query: (req.query ?? {}) as Record<string, string | string[]>,
        headers: (req.headers ?? {}) as Record<string, string | string[] | undefined>,
        body: req.body,
        ip: req.ip ?? req.socket?.remoteAddress ?? "",
      },
      response: {
        statusCode: 200,
        headers: {},
        body: undefined,
      },
      state: new Map<string, unknown>(),
      logger: createLogger(),
    };

    return ctx;
  }

  async sendResponse(ctx: RequestContext): Promise<void> {
    const res = (ctx as ContextWithRaw).__rawResponse;
    if (!res) return;

    for (const [key, value] of Object.entries(ctx.response.headers)) {
      if (value != null) {
        res.setHeader(key, String(value));
      }
    }

    const { statusCode, body } = ctx.response;
    res.status(statusCode);

    if (body !== undefined && body !== null) {
      res.json(body);
    } else {
      res.end();
    }
  }

  async listen(port: number): Promise<void> {
    const controllers: Type<object>[] = [...this.extraControllers];

    for (const apiDef of this.apis) {
      const ctrl = this.buildController(apiDef);
      controllers.push(ctrl);
    }

    const rootModule = this.buildModule(controllers);
    this.app = await NestFactory.create(rootModule);
    this.app.enableCors();

    await this.app.listen(port);
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
  }

  // -----------------------------------------------------------------------
  // Dynamic NestJS module / controller generation
  // -----------------------------------------------------------------------

  private buildModule(controllers: Type<object>[]): DynamicModule {
    const mod = {
      module: class AppModule {},
      controllers,
    };

    Reflect.defineMetadata("imports", [], mod.module);
    Reflect.defineMetadata("controllers", controllers, mod.module);
    Reflect.defineMetadata("providers", [], mod.module);
    Reflect.defineMetadata("exports", [], mod.module);

    return mod;
  }

  private runAllMiddleware(
    ctx: RequestContext,
    defs: MiddlewareDefinition[],
    phase: "before" | "after" | "onError",
    error?: Error,
  ): Promise<void> {
    const relevant = defs.filter((m) => {
      const proto = m.class.prototype as Record<string, unknown>;
      return typeof proto[phase] === "function";
    });

    return relevant.reduce(
      (chain, mwDef) =>
        chain.then(async () => {
          const instance = new mwDef.class() as Record<string, (ctx: RequestContext, err?: Error) => Promise<void>>;
          if (phase === "onError" && error) {
            await instance[phase](ctx, error);
          } else {
            await instance[phase](ctx);
          }
        }),
      Promise.resolve(),
    );
  }

  private buildController(apiDef: APIDefinition): Type<object> {
    const {
      handlerMap,
      globalMiddleware,
      createRequestContext,
      runAllMiddleware,
      sendResponse,
    } = this;

    const prefix = apiDef.prefix || "/";
    const controllerName = `${sanitizeName(apiDef.name)}Controller`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class DynamicController { [key: string]: any }

    Object.defineProperty(DynamicController, "name", { value: controllerName });

    Controller(prefix)(DynamicController);

    const allRouteMiddleware = [...globalMiddleware, ...(apiDef.middleware ?? [])];

    for (const route of apiDef.routes) {
      const routeKey = `${route.fullPath}:${route.method}`;
      const methodName = `__apicraft_${sanitizeName(route.handlerName)}`;

      DynamicController.prototype[methodName] = async function handler(
        this: unknown,
        req: Request,
        res: Response,
      ): Promise<void> {
        const ctx = createRequestContext(req, res);

        try {
          await runAllMiddleware(ctx, allRouteMiddleware, "before");

          await runAllMiddleware(ctx, route.middleware ?? [], "before");

          const allGuards = [...(apiDef.guards ?? []), ...(route.guards ?? [])];
          for (const gd of allGuards) {
            const guard = new gd.class() as {
              authenticate(c: RequestContext): Promise<boolean> | boolean;
              onFailure?(c: RequestContext): Promise<void>;
            };
            const allowed = await guard.authenticate(ctx);
            if (!allowed) {
              await guard.onFailure?.(ctx);
              throw new HttpException(
                { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
                401,
              );
            }
          }

          const handler = handlerMap.get(routeKey);
          if (handler) {
            await handler(ctx);
          }

          await runAllMiddleware(ctx, route.middleware ?? [], "after");

          await runAllMiddleware(ctx, allRouteMiddleware, "after");

          await sendResponse(ctx);
        } catch (err: unknown) {
          const actual =
            err instanceof HttpException
              ? err
              : err instanceof APIError
                ? new HttpException(err.toJSON(), err.statusCode)
                : new HttpException(
                    { error: { message: err instanceof Error ? err.message : "Internal Server Error" } },
                    500,
                  );

          const mwChain = [...allRouteMiddleware, ...(route.middleware ?? [])];
          await runAllMiddleware(ctx, mwChain, "onError", err instanceof Error ? err : new Error(String(err)));

          throw actual;
        }
      };

      const descriptor =
        Object.getOwnPropertyDescriptor(DynamicController.prototype, methodName) ??
        ({
          value: DynamicController.prototype[methodName],
          writable: true,
          enumerable: true,
          configurable: true,
        } as PropertyDescriptor);

      const methodDecorator = HTTP_METHOD_DECORATORS[route.method];
      if (methodDecorator) {
        methodDecorator(route.path)(DynamicController.prototype, methodName, descriptor);
      }

      if (route.responseStatus !== 200) {
        HttpCode(route.responseStatus)(DynamicController.prototype, methodName, descriptor);
      }

      Req()(DynamicController.prototype, methodName, 0);
      Res()(DynamicController.prototype, methodName, 1);
    }

    return DynamicController;
  }

  // -----------------------------------------------------------------------
  // Extra public API
  // -----------------------------------------------------------------------

  registerMiddleware(def: MiddlewareDefinition): void {
    this.globalMiddleware.push(def);
  }

  addController(controller: Type<object>): void {
    this.extraControllers.push(controller);
  }

  generateModule(): string {
    const controllerImports = this.apis
      .map(
        (api) =>
          `import { ${sanitizeName(api.name)}Controller } from './${sanitizeName(api.name)}.controller'`,
      )
      .join("\n");

    const controllerNames = this.apis
      .map((api) => `${sanitizeName(api.name)}Controller`)
      .join(", ");

    return [
      `import { Module } from '@nestjs/common'`,
      controllerImports,
      ``,
      `@Module({`,
      `  controllers: [${controllerNames}],`,
      `})`,
      `export class AppModule {}`,
      ``,
    ].join("\n");
  }

  generateController(pipelines?: RouteDefinition[]): string {
    const routes = pipelines ?? this.apis.flatMap((a) => a.routes);

    const grouped = new Map<string, RouteDefinition[]>();
    for (const api of this.apis) {
      const existing = grouped.get(api.name) ?? [];
      grouped.set(api.name, [...existing, ...api.routes]);
    }

    const parts: string[] = [];

    for (const [apiName, apiRoutes] of grouped) {
      const safeName = sanitizeName(apiName);
      const apiDef = this.apis.find((a) => a.name === apiName);
      const prefix = apiDef?.prefix ?? "";
      const lines: string[] = [];

      lines.push(`import {`);
      lines.push(
        `  Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, Headers, HttpCode, HttpException,`,
      );
      lines.push(`} from '@nestjs/common'`);
      lines.push(``);
      lines.push(`@Controller('${prefix}')`);
      lines.push(`export class ${safeName}Controller {`);

      for (const route of apiRoutes) {
        const method = route.method;
        const capMethod = method.charAt(0).toUpperCase() + method.slice(1);
        const path = route.path;
        const handlerName = route.handlerName;

        const paramDecls: string[] = [];

        for (const p of route.parameters) {
          switch (p.kind) {
            case "param":
              paramDecls.push(`@Param('${p.name}') ${p.name}: string`);
              break;
            case "query":
              paramDecls.push(`@Query('${p.name}') ${p.name}?: string`);
              break;
            case "body":
              paramDecls.push(`@Body() body: unknown`);
              break;
            case "headers":
              if (p.name && p.name !== "headers") {
                paramDecls.push(`@Headers('${p.name}') ${p.name}?: string`);
              } else {
                paramDecls.push(`@Headers() headers: Record<string, string | string[] | undefined>`);
              }
              break;
            case "context":
              paramDecls.push(`ctx: RequestContext`);
              break;
          }
        }

        const paramList = paramDecls.join(", ");

        lines.push(``);
        if (route.responseStatus !== 200) {
          lines.push(`  @HttpCode(${route.responseStatus})`);
        }
        lines.push(`  @${capMethod}('${path}')`);
        lines.push(`  async ${handlerName}(${paramList}) {`);
        lines.push(`    throw new HttpException('Not implemented — replace with handler logic', 501);`);
        lines.push(`  }`);
      }

      lines.push(`}`);
      lines.push(``);

      parts.push(lines.join("\n"));
    }

    return parts.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Factory (used by @apicraft/core resolveAdapter)
// ---------------------------------------------------------------------------

export function createAdapter(): NestJSAdapter {
  return new NestJSAdapter();
}

export default NestJSAdapter;
