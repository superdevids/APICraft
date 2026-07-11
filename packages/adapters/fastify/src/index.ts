import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParameterKind = "param" | "query" | "body" | "headers" | "context" | "upload";

export interface ParameterDefinition {
  kind: ParameterKind;
  name: string;
  index: number;
  default?: unknown;
}

export interface RequestContext {
  req: FastifyRequest;
  res: FastifyReply;
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
  createRouter(): unknown;
  registerRoute(path: string, pipeline: Pipeline): void;
  registerMiddleware(middleware: (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void): void;
  start(port: number): Promise<void>;
  close(): Promise<void>;
}

export interface ErrorDetail {
  field?: string;
  message: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

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

/**
 * Create a {@link RequestContext} from a Fastify request/reply pair.
 */
// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

function buildContext(req: FastifyRequest, reply: FastifyReply): RequestContext {
  return {
    req,
    res: reply,
    params: (req.params ?? {}) as Record<string, string>,
    query: (req.query ?? {}) as Record<string, unknown>,
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

function extractParameters(req: FastifyRequest, params: ParameterDefinition[]): unknown[] {
  const args: unknown[] = [];

  for (const param of params) {
    switch (param.kind) {
      case "param":
        args[param.index] = (req.params as Record<string, string>)[param.name];
        break;
      case "query":
        args[param.index] = (req.query as Record<string, unknown>)[param.name] ?? param.default;
        break;
      case "body":
        args[param.index] = req.body;
        break;
      case "headers":
        args[param.index] = param.name ? req.headers[param.name] : req.headers;
        break;
      case "context":
        args[param.index] = buildContext(req, {} as FastifyReply);
        break;
      case "upload":
        args[param.index] = undefined;
        break;
      default:
        args[param.index] = undefined;
    }
  }

  return args;
}

/**
 * Fastify-based HTTP adapter for APICraft.
 *
 * Converts APICraft pipeline descriptors (decorator metadata) into Fastify
 * route registrations with full guard, middleware, and parameter-extraction
 * support.  Uses {@link Fastify} as the underlying HTTP framework.
 *
 * @example
 * ```typescript
 * const adapter = new FastifyAdapter();
 * adapter.registerRoute("/users/:id", {
 *   method: "get",
 *   path: "/users/:id",
 *   handler: (id: string) => ({ id, name: "Alice" }),
 *   parameters: [{ kind: "param", name: "id", index: 0 }],
 *   middleware: [],
 *   guards: [],
 * });
 * await adapter.start(3000);
 * ```
 */
// ---------------------------------------------------------------------------
// FastifyAdapter
// ---------------------------------------------------------------------------

export class FastifyAdapter implements Adapter {
  readonly name = "fastify";

  readonly #app: FastifyInstance;

  constructor() {
    this.#app = Fastify({ logger: true });

    this.#app.setErrorHandler((error, _request, reply) => {
      if (error instanceof APIError) {
        reply.status(error.statusCode).send(error.toJSON());
        return;
      }

      const statusCode = (error as unknown as Record<string, unknown>).statusCode ?? 500;
      const message =
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message ?? "Internal server error";

      reply.status(statusCode as number).send({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message,
        },
      });
    });
  }

  get app(): FastifyInstance {
    return this.#app;
  }

  createRouter(): (instance: FastifyInstance, opts: Record<string, unknown>, done: (err?: Error) => void) => void {
    return (_instance, _opts, done) => {
      done();
    };
  }

  registerRoute(path: string, pipeline: Pipeline): void {
    const handler = this.#createHandler(pipeline);

    const methodMap: Record<string, "GET" | "POST" | "PUT" | "PATCH" | "DELETE"> = {
      get: "GET",
      post: "POST",
      put: "PUT",
      patch: "PATCH",
      delete: "DELETE",
    };

    this.#app.route({
      method: methodMap[pipeline.method],
      url: path,
      handler,
    });
  }

  registerMiddleware(middleware: (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void): void {
    this.#app.addHook("preHandler", middleware);
  }

  async start(port: number): Promise<void> {
    await this.#app.listen({ port });
  }

  async close(): Promise<void> {
    await this.#app.close();
  }

  #createHandler(pipeline: Pipeline) {
    return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const ctx = buildContext(req, reply);

        for (const guard of pipeline.guards) {
          const allowed = await guard(ctx);
          if (!allowed) {
            reply.status(401).send({
              error: {
                code: "UNAUTHORIZED",
                message: "Unauthorized",
              },
            });
            return;
          }
        }

        for (const mw of pipeline.middleware) {
          await mw(ctx);
        }

        const args = extractParameters(req, pipeline.parameters);
        const result = await pipeline.handler(...args);

        const statusCode = pipeline.responseStatus ?? 200;
        if (result === undefined || result === null) {
          reply.status(statusCode).send();
        } else {
          reply.status(statusCode).send(result);
        }
      } catch (error: unknown) {
        if (error instanceof APIError) {
          reply.status(error.statusCode).send(error.toJSON());
          return;
        }
        throw error;
      }
    };
  }
}

export default FastifyAdapter;
