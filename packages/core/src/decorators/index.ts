import "reflect-metadata";
import type { z } from "zod";
import {
  DefinitionRegistry,
  API_METADATA_KEY,
  ROUTE_METADATA_KEY,
  PARAM_METADATA_KEY,
} from "../metadata/index.js";
import type {
  HTTPMethod,
  APIDefinition,
  RouteDefinition,
  ParameterDefinition,
  TypeSchema,
  Middleware,
  MiddlewareDefinition,
  Guard,
  GuardDefinition,
  ThrottleDefinition,
} from "../types/index.js";

const registry = DefinitionRegistry.getInstance();

function inferTypeSchema(typeName: string, target: Object, propertyKey: string | symbol, parameterIndex?: number): TypeSchema {
  if (parameterIndex !== undefined) {
    const paramTypes: Array<new (...args: unknown[]) => unknown> = Reflect.getOwnMetadata("design:paramtypes", target, propertyKey) ?? [];
    const paramType = paramTypes[parameterIndex];
    if (paramType) return mapTypeToSchema(paramType);
  }
  const returnType: new (...args: unknown[]) => unknown = Reflect.getOwnMetadata("design:returntype", target, propertyKey);
  if (returnType) return mapTypeToSchema(returnType);
  return { kind: "string", name: typeName };
}

function mapTypeToSchema(type: new (...args: unknown[]) => unknown): TypeSchema {
  if (type === String) return { kind: "string", name: "string" };
  if (type === Number) return { kind: "number", name: "number" };
  if (type === Boolean) return { kind: "boolean", name: "boolean" };
  if (type === Array) return { kind: "array", name: "array", items: { kind: "string", name: "string" } };
  if (type === Object) return { kind: "object", name: "object" };
  if (type === Date) return { kind: "string", name: "string", format: "date-time" };
  return { kind: "string", name: type.name ?? "unknown" };
}

function defineMetadata(key: string, value: unknown, target: Object, propertyKey?: string | symbol): void {
  if (propertyKey !== undefined) {
    Reflect.defineMetadata(key, value, target, propertyKey);
  } else {
    Reflect.defineMetadata(key, value, target);
  }
}

function getOwnAPIDefinition(target: Function): APIDefinition {
  const existing: APIDefinition = Reflect.getOwnMetadata(API_METADATA_KEY, target) ?? Reflect.getOwnMetadata(API_METADATA_KEY, target.prototype);
  if (existing) return existing;

  const def: APIDefinition = {
    name: target.name,
    prefix: "",
    tags: [],
    routes: [],
    guards: [],
    middleware: [],
  };
  return def;
}

function getOwnRouteMetadata(targetPrototype: Object, append: boolean): RouteDefinition[] {
  if (!append) return [];
  return Reflect.getOwnMetadata(ROUTE_METADATA_KEY, targetPrototype) ?? [];
}

function saveRouteMetadata(targetPrototype: Object, routes: RouteDefinition[]): void {
  Reflect.defineMetadata(ROUTE_METADATA_KEY, routes, targetPrototype);
}

function getOwnParamParams(targetPrototype: Object, key: string | symbol): ParameterDefinition[] {
  return Reflect.getOwnMetadata(PARAM_METADATA_KEY, targetPrototype, key) ?? [];
}

function saveParamMetadata(targetPrototype: Object, key: string | symbol, params: ParameterDefinition[]): void {
  if (params.length > 0) {
    params.sort((a, b) => a.index - b.index);
  }
  Reflect.defineMetadata(PARAM_METADATA_KEY, params, targetPrototype, key);
}

/* ─────────── CLASS DECORATORS ─────────── */

export function api(prefix: string, options?: { tags?: string[]; description?: string }): ClassDecorator {
  return (target) => {
    const existing = getOwnAPIDefinition(target as Function);
    const def: APIDefinition = {
      ...existing,
      name: (target as Function).name,
      prefix,
      tags: options?.tags ?? [],
      routes: existing.routes ?? [],
      guards: existing.guards ?? [],
      middleware: existing.middleware ?? [],
    };

    Reflect.defineMetadata(API_METADATA_KEY, def, target);
    Reflect.defineMetadata(API_METADATA_KEY, def, target.prototype);
    registry.registerAPI(target as Function, def);
  };
}

export function guard(
  GuardClass: new (...args: unknown[]) => Guard,
  options?: Record<string, unknown>,
): ClassDecorator & MethodDecorator {
  return (target: Object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      const proto = typeof target === "function" ? target.prototype : target;
      const routes: RouteDefinition[] = getOwnRouteMetadata(proto, true);
      const guardDef: GuardDefinition = { class: GuardClass, options, scope: "route" };
      const idx = routes.findIndex((r) => r.handlerName === String(propertyKey) || r.handlerName === "");
      if (idx >= 0) {
        routes[idx] = { ...routes[idx], guards: [...routes[idx].guards, guardDef] };
      } else {
        const route: RouteDefinition = {
          method: "get" as HTTPMethod,
          path: "",
          fullPath: "",
          handlerName: String(propertyKey),
          parameters: [],
          responseStatus: 200,
          responseContentType: "application/json",
          guards: [guardDef],
          middleware: [],
        };
        routes.push(route);
      }
      saveRouteMetadata(proto, routes);
    } else {
      const ctor = target as Function;
      const existing = getOwnAPIDefinition(ctor);
      const guardDef: GuardDefinition = { class: GuardClass, options, scope: "api" };
      existing.guards = [...(existing.guards ?? []), guardDef];
      Reflect.defineMetadata(API_METADATA_KEY, existing, ctor);
      Reflect.defineMetadata(API_METADATA_KEY, existing, ctor.prototype);
      registry.registerAPI(ctor, existing);
    }
  };
}

export function use(
  MiddlewareClass: new (...args: unknown[]) => Middleware,
  options?: Record<string, unknown>,
): ClassDecorator & MethodDecorator {
  return (target: Object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    const middlewareDef: MiddlewareDefinition = {
      class: MiddlewareClass,
      options,
      scope: "route",
    };

    if (propertyKey !== undefined && descriptor !== undefined) {
      const proto = typeof target === "function" ? target.prototype : target;
      const routes: RouteDefinition[] = getOwnRouteMetadata(proto, true);
      const idx = routes.findIndex((r) => r.handlerName === String(propertyKey));
      if (idx >= 0) {
        routes[idx] = { ...routes[idx], middleware: [...routes[idx].middleware, middlewareDef] };
      } else {
        const route: RouteDefinition = {
          method: "get" as HTTPMethod,
          path: "",
          fullPath: "",
          handlerName: String(propertyKey),
          parameters: [],
          responseStatus: 200,
          responseContentType: "application/json",
          guards: [],
          middleware: [middlewareDef],
        };
        routes.push(route);
      }
      saveRouteMetadata(proto, routes);
    } else {
      const ctor = target as Function;
      const existing = getOwnAPIDefinition(ctor);
      const def: MiddlewareDefinition = { ...middlewareDef, scope: "api" };
      existing.middleware = [...(existing.middleware ?? []), def];
      Reflect.defineMetadata(API_METADATA_KEY, existing, ctor);
      Reflect.defineMetadata(API_METADATA_KEY, existing, ctor.prototype);
      registry.registerAPI(ctor, existing);
    }
  };
}

export function version(ver: string): ClassDecorator {
  return (target) => {
    const ctor = target as Function;
    const existing = getOwnAPIDefinition(ctor);
    existing.version = ver;
    Reflect.defineMetadata(API_METADATA_KEY, existing, ctor);
    Reflect.defineMetadata(API_METADATA_KEY, existing, ctor.prototype);
    registry.registerAPI(ctor, existing);
  };
}

/* ─────────── METHOD DECORATORS ─────────── */

function createRouteDecorator(method: HTTPMethod): (path: string) => MethodDecorator {
  return (path: string) =>
    (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const proto = typeof target === "function" ? target.prototype : target;

      const apiDef: APIDefinition = Reflect.getOwnMetadata(API_METADATA_KEY, target) ?? Reflect.getOwnMetadata(API_METADATA_KEY, proto) ?? {};
      const prefix = apiDef.prefix ?? "";
      const routePath = path.startsWith("/") ? path : `/${path}`;
      const fullPath = prefix ? `${prefix}${routePath}` : routePath;

      const returnType: new (...args: unknown[]) => unknown = Reflect.getOwnMetadata("design:returntype", target, propertyKey);
      const paramTypes: Array<new (...args: unknown[]) => unknown> = Reflect.getOwnMetadata("design:paramtypes", target, propertyKey) ?? [];

      const paramDefs: ParameterDefinition[] = getOwnParamParams(proto, propertyKey);
      paramDefs.sort((a, b) => a.index - b.index);

      for (let i = 0; i < paramTypes.length; i++) {
        const exists = paramDefs.some((p) => p.index === i);
        if (!exists) {
          const schema = mapTypeToSchema(paramTypes[i]);
          paramDefs.push({
            kind: "body",
            name: `arg${i}`,
            index: i,
            type: schema,
            required: true,
          });
        }
      }

      const routes: RouteDefinition[] = getOwnRouteMetadata(proto, true);
      const existingIdx = routes.findIndex((r) => r.handlerName === String(propertyKey));
      const routeDef: RouteDefinition = {
        method,
        path: routePath,
        fullPath,
        handlerName: String(propertyKey),
        parameters: paramDefs,
        responseStatus: 200,
        responseContentType: "application/json",
        guards: [],
        middleware: [],
        summary: undefined,
        description: undefined,
      };

      if (existingIdx >= 0) {
        const existing = routes[existingIdx];
        routes[existingIdx] = {
          ...existing,
          method: existing.method ?? method,
          path: existing.path || routePath,
          fullPath: existing.fullPath || fullPath,
          parameters: paramDefs.filter((p) => p.kind !== "context").length > 0 ? paramDefs.filter((p) => p.kind !== "context") : paramDefs,
        };
      } else {
        routes.push(routeDef);
      }

      saveRouteMetadata(proto, routes);
    };
}

export const get = createRouteDecorator("get");
export const post = createRouteDecorator("post");
export const put = createRouteDecorator("put");
export const patch = createRouteDecorator("patch");
export const del = createRouteDecorator("delete");

export function response(statusCode: number, contentType = "application/json"): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const proto = typeof target === "function" ? target.prototype : target;
    const routes: RouteDefinition[] = getOwnRouteMetadata(proto, true);
    const idx = routes.findIndex((r) => r.handlerName === String(propertyKey));
    if (idx >= 0) {
      routes[idx] = { ...routes[idx], responseStatus: statusCode, responseContentType: contentType };
    } else {
      routes.push({
        method: "get" as HTTPMethod,
        path: "",
        fullPath: "",
        handlerName: String(propertyKey),
        parameters: [],
        responseStatus: statusCode,
        responseContentType: contentType,
        guards: [],
        middleware: [],
      });
    }
    saveRouteMetadata(proto, routes);
  };
}

export function throttle(options: ThrottleDefinition): MethodDecorator {
  return (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const proto = typeof target === "function" ? target.prototype : target;
    const routes: RouteDefinition[] = getOwnRouteMetadata(proto, true);
    const idx = routes.findIndex((r) => r.handlerName === String(propertyKey));
    if (idx >= 0) {
      routes[idx] = { ...routes[idx], throttle: options };
    } else {
      routes.push({
        method: "get" as HTTPMethod,
        path: "",
        fullPath: "",
        handlerName: String(propertyKey),
        parameters: [],
        responseStatus: 200,
        responseContentType: "application/json",
        guards: [],
        middleware: [],
        throttle: options,
      });
    }
    saveRouteMetadata(proto, routes);
  };
}

/* ─────────── PARAMETER DECORATORS ─────────── */

function createParamDecorator(
  kind: ParameterDefinition["kind"],
  name: string,
  options?: {
    zod?: z.ZodTypeAny;
    required?: boolean;
    default?: unknown;
    description?: string;
    maxSize?: string;
    types?: string[];
  },
): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const proto = typeof target === "function" ? target.prototype : target;

    const typeSchema = inferTypeSchema(name, target, propertyKey, parameterIndex);

    const paramDef: ParameterDefinition = {
      kind,
      name,
      index: parameterIndex,
      type: typeSchema,
      zodSchema: options?.zod,
      required: options?.required ?? true,
      default: options?.default,
      description: options?.description,
    };

    if (kind === "upload") {
      paramDef.type = {
        kind: "object",
        name: "File",
        properties: {
          filename: { kind: "string", name: "string" },
          mimetype: { kind: "string", name: "string" },
          size: { kind: "number", name: "number" },
        },
      };
    }

    const paramDefs: ParameterDefinition[] = getOwnParamParams(proto, propertyKey);
    paramDefs.push(paramDef);
    saveParamMetadata(proto, propertyKey, paramDefs);
  };
}

export function param(
  name: string,
  options?: { zod?: z.ZodTypeAny; required?: boolean; description?: string },
): ParameterDecorator {
  return createParamDecorator("param", name, options);
}

export function query(
  name: string,
  options?: { default?: unknown; zod?: z.ZodTypeAny; required?: boolean; description?: string },
): ParameterDecorator {
  return createParamDecorator("query", name, options);
}

export function body(schema?: z.ZodTypeAny): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const proto = typeof target === "function" ? target.prototype : target;

    const typeSchema = inferTypeSchema("body", target, propertyKey, parameterIndex);

    const paramDef: ParameterDefinition = {
      kind: "body",
      name: "body",
      index: parameterIndex,
      type: typeSchema,
      zodSchema: schema,
      required: true,
    };

    const paramDefs: ParameterDefinition[] = getOwnParamParams(proto, propertyKey);
    paramDefs.push(paramDef);
    saveParamMetadata(proto, propertyKey, paramDefs);
  };
}

export function headers(name?: string): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const proto = typeof target === "function" ? target.prototype : target;
    const headerName = name ?? "headers";

    const paramDef: ParameterDefinition = {
      kind: "headers",
      name: headerName,
      index: parameterIndex,
      type: { kind: "object", name: "Headers" },
      required: false,
    };

    const paramDefs: ParameterDefinition[] = getOwnParamParams(proto, propertyKey);
    paramDefs.push(paramDef);
    saveParamMetadata(proto, propertyKey, paramDefs);
  };
}

export function context(): ParameterDecorator {
  return (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) return;
    const proto = typeof target === "function" ? target.prototype : target;

    const paramDef: ParameterDefinition = {
      kind: "context",
      name: "context",
      index: parameterIndex,
      type: { kind: "object", name: "RequestContext" },
      required: true,
    };

    const paramDefs: ParameterDefinition[] = getOwnParamParams(proto, propertyKey);
    paramDefs.push(paramDef);
    saveParamMetadata(proto, propertyKey, paramDefs);
  };
}

/** @deprecated Use the enhanced `upload` from `@apicraft/core/upload` instead. */
function internalUpload(
  name: string,
  options?: { maxSize?: string; types?: string[] },
): ParameterDecorator {
  return createParamDecorator("upload", name, { ...options });
}
