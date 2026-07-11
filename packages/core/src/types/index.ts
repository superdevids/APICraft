import type { z } from "zod";

export type HTTPMethod = "get" | "post" | "put" | "patch" | "delete" | "ws";

export interface TypeSchema {
  kind: "string" | "number" | "boolean" | "array" | "object" | "enum" | "union" | "reference";
  name?: string;
  type?: string;
  format?: string;
  enum?: string[];
  items?: TypeSchema;
  properties?: Record<string, TypeSchema>;
  required?: string[];
  members?: TypeSchema[];
  zodInfo?: {
    min?: number;
    max?: number;
    email?: boolean;
    uuid?: boolean;
    pattern?: string;
  };
}

export interface ParameterDefinition {
  kind: "param" | "query" | "body" | "headers" | "context" | "upload";
  name: string;
  index: number;
  type: TypeSchema;
  zodSchema?: z.ZodTypeAny;
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface ThrottleDefinition {
  window: number;
  max: number;
}

export interface Middleware {
  before?(ctx: RequestContext): Promise<void>;
  after?(ctx: RequestContext): Promise<void>;
  onError?(ctx: RequestContext, error: Error): Promise<void>;
}

export interface MiddlewareDefinition {
  class: new (...args: unknown[]) => Middleware;
  options?: Record<string, unknown>;
  scope: "global" | "api" | "route";
}

export interface Guard {
  authenticate(ctx: RequestContext): Promise<boolean>;
  onFailure?(ctx: RequestContext): Promise<void>;
}

export interface GuardDefinition {
  class: new (...args: unknown[]) => Guard;
  options?: Record<string, unknown>;
  scope: "api" | "route";
}

export interface RouteDefinition {
  method: HTTPMethod;
  path: string;
  fullPath: string;
  handlerName: string;
  parameters: ParameterDefinition[];
  responseStatus: number;
  responseContentType: string;
  guards: GuardDefinition[];
  middleware: MiddlewareDefinition[];
  throttle?: ThrottleDefinition;
  summary?: string;
  description?: string;
}

export interface APIDefinition {
  name: string;
  prefix: string;
  version?: string;
  tags: string[];
  routes: RouteDefinition[];
  guards: GuardDefinition[];
  middleware: MiddlewareDefinition[];
}

export interface AuthenticatedUser {
  id: string;
  roles: string[];
  [key: string]: unknown;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export interface RequestContext {
  request: {
    method: string;
    path: string;
    params: Record<string, string>;
    query: Record<string, string | string[]>;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    ip: string;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
  };
  state: Map<string, unknown>;
  logger: Logger;
  user?: AuthenticatedUser;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface Adapter {
  name: string;
  registerRoutes(
    apis: APIDefinition[],
    handlers: Map<string, (ctx: RequestContext) => Promise<void>>,
    globalMiddleware: MiddlewareDefinition[],
  ): void;
  createRequestContext(originalReq: unknown, originalRes: unknown): RequestContext;
  sendResponse(ctx: RequestContext): Promise<void>;
  listen(port: number): Promise<void>;
  close(): Promise<void>;
}

export interface APICraftPlugin {
  name: string;
  version: string;
  hooks: {
    onDefinitionScan?: (definitions: APIDefinition[]) => void;
    onRouteRegister?: (route: RouteDefinition) => void;
    onGenerateOpenAPI?: (spec: object) => void;
    onRequest?: (ctx: RequestContext) => void | Promise<void>;
    onResponse?: (ctx: RequestContext) => void | Promise<void>;
    onError?: (ctx: RequestContext, error: Error) => void | Promise<void>;
  };
  middleware?: any[];
  decorators?: Record<string, Function>;
  generators?: any[];
}

export interface APICraftConfig {
  title?: string;
  version?: string;
  description?: string;
  apis?: Function[];
  adapter?: "express" | "fastify" | "hono" | "next" | "koa" | "nest" | Adapter;
  server?: {
    port?: number;
    adapter?: "express" | "fastify" | "hono" | "next" | "koa" | "nest" | Adapter;
  };
  openapi?: {
    output?: string;
    format?: string;
    title?: string;
    version?: string;
    description?: string;
  };
  client?: {
    output?: string;
  };
  middleware?: {
    cors?: {
      origin?: string | string[];
      methods?: string[];
      allowedHeaders?: string[];
      credentials?: boolean;
    };
    logger?: {
      level?: string;
      format?: string;
    };
    rateLimiter?: {
      windowMs?: number;
      max?: number;
    };
    compression?: {
      level?: number;
      threshold?: number;
    };
    helmet?: {
      contentSecurityPolicy?: boolean;
      frameguard?: boolean;
    };
  };
  plugins?: APICraftPlugin[];
  auth?: {
    jwt?: {
      secret: string;
      algorithms?: string[];
    };
    apiKey?: {
      header?: string;
    };
  };
}
