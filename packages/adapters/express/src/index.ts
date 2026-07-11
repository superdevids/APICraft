import type { Application, Request, RequestHandler, Response } from "express";
import express from "express";
import { Server } from "node:http";

/**
 * Describes where a parameter value is sourced from at runtime.
 */
export type ParameterKind = "param" | "query" | "body" | "headers" | "context" | "upload";

/**
 * Metadata that maps a controller-method parameter to its HTTP source.
 */
export interface ParameterDefinition {
  kind: ParameterKind;
  name: string;
  index: number;
  default?: unknown;
}

/**
 * Runtime context passed to guards and middleware during request processing.
 */
export interface RequestContext {
  req: Request;
  res: Response;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * A fully-resolved route descriptor produced by an APICraft decorator scanner.
 * The adapter consumes this to register routes on the underlying HTTP framework.
 */
export interface Pipeline {
  /** HTTP method — lowercase Express-compatible name. */
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Route pattern with Express-compatible path parameters (e.g. `/users/:id`). */
  path: string;
  /** The actual controller method to invoke. */
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
  /** Parameter metadata describing how to extract each argument from the request. */
  parameters: ParameterDefinition[];
  /** Middleware functions that run before the handler (order preserved). */
  middleware: Array<(ctx: RequestContext) => Promise<void> | void>;
  /** Guard functions that must return `true` for the request to proceed. */
  guards: Array<(ctx: RequestContext) => Promise<boolean> | boolean>;
  /** Optional override for the HTTP response status (defaults to 200). */
  responseStatus?: number;
}

/**
 * Well-known adapter interface shared across all framework adapters.
 */
export interface Adapter {
  /** Human-readable adapter name (e.g. "express"). */
  name: string;
  /** Create a new sub-router (useful for grouping routes). */
  createRouter(): express.Router;
  /** Register a single APICraft pipeline as a route. */
  registerRoute(path: string, pipeline: Pipeline): void;
  /** Register a global middleware function. */
  registerMiddleware(middleware: RequestHandler): void;
  /** Start listening on the given port. */
  start(port: number): Promise<void>;
  /** Gracefully shut down the HTTP server. */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

/**
 * A serialisable error detail item used in standardised error payloads.
 */
export interface ErrorDetail {
  field?: string;
  message: string;
  code: string;
}

/**
 * Application-level error that can carry an HTTP status code and structured
 * detail items.  When thrown inside a pipeline handler the adapter catches it
 * and renders the standardised error response.
 */
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

  /** Serialise the error into the standard API error shape (PRD §5.4). */
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

/**
 * Build a {@link RequestContext} from the raw Express request/response pair.
 */
function buildContext(req: Request, _res?: Response): RequestContext {
  return {
    req,
    res: _res ?? ({} as Response),
    params: req.params as unknown as Record<string, string>,
    query: req.query as unknown as Record<string, unknown>,
    body: req.body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

/**
 * Extract function arguments from the incoming request based on the declared
 * parameter metadata array.  Returns an ordered array of values that can be
 * spread into the pipeline handler.
 */
function extractParameters(req: Request, params: ParameterDefinition[]): unknown[] {
  const args: unknown[] = [];

  for (const param of params) {
    switch (param.kind) {
      case "param":
        args[param.index] = req.params[param.name];
        break;
      case "query":
        args[param.index] = (req.query as unknown as Record<string, unknown>)[param.name] ?? param.default;
        break;
      case "body":
        args[param.index] = req.body;
        break;
      case "headers":
        args[param.index] = param.name ? req.headers[param.name] : req.headers;
        break;
      case "context":
        args[param.index] = buildContext(req);
        break;
      case "upload":
        args[param.index] = (req as unknown as Record<string, unknown>).file ?? (req as unknown as Record<string, unknown>).files;
        break;
      default:
        args[param.index] = undefined;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// ExpressAdapter
// ---------------------------------------------------------------------------

/**
 * APICraft adapter for the Express.js HTTP framework.
 *
 * Converts APICraft decorator metadata (wrapped as {@link Pipeline} objects)
 * into standard Express route registrations with full middleware, guard, and
 * parameter-extraction support.
 */
export class ExpressAdapter implements Adapter {
  readonly name = "express";

  readonly #app: Application;
  #server: Server | null = null;

  constructor() {
    this.#app = express();

    // Built-in body parsers — consumers can override or extend via
    // `registerMiddleware` if desired.
    this.#app.use(express.json());
    this.#app.use(express.urlencoded({ extended: true }));
  }

  /** The underlying Express application (exposed for direct access if needed). */
  get app(): Application {
    return this.#app;
  }

  /** Create an isolated Express Router instance. */
  createRouter(): express.Router {
    return express.Router();
  }

  /**
   * Register an APICraft pipeline as an Express route.
   *
   * The method chains guards → middleware → parameter extraction → handler
   * invocation → response serialisation.  Any thrown {@link APIError} is
   * caught and rendered as a standardised error payload.
   */
  registerRoute(path: string, pipeline: Pipeline): void {
    const handler = this.#createHandler(pipeline);
    this.#app[pipeline.method](path, handler);
  }

  /** Register a global Express middleware function. */
  registerMiddleware(middleware: RequestHandler): void {
    this.#app.use(middleware);
  }

  /**
   * Start the Express HTTP server on the given `port`.
   *
   * Resolves once the server begins listening.
   */
  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server = this.#app.listen(port, () => {
        resolve();
      });
      this.#server.once("error", reject);
    });
  }

  /**
   * Gracefully close the HTTP server.
   *
   * If the server is not running this is a no-op.
   */
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

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Convert a {@link Pipeline} into an Express request handler by composing
   * guards, middleware, parameter extraction, and the actual controller
   * invocation into a single async chain.
   */
  #createHandler(pipeline: Pipeline): RequestHandler {
    return async (req: Request, res: Response, next) => {
      try {
        const ctx = buildContext(req, res);

        // 1. Evaluate guards — all must pass.
        for (const guard of pipeline.guards) {
          const allowed = await guard(ctx);
          if (!allowed) {
            res.status(401).json({
              error: {
                code: "UNAUTHORIZED",
                message: "Unauthorized",
              },
            });
            return;
          }
        }

        // 2. Execute pre-handler middleware (order-preserving).
        for (const mw of pipeline.middleware) {
          await mw(ctx);
        }

        // 3. Extract parameters from the raw request.
        const args = extractParameters(req, pipeline.parameters);

        // 4. Invoke the controller method.
        const result = await pipeline.handler(...args);

        // 5. Send the response with the configured (or default) status.
        const statusCode = pipeline.responseStatus ?? 200;
        if (result === undefined || result === null) {
          res.status(statusCode).end();
        } else {
          res.status(statusCode).json(result);
        }
      } catch (error: unknown) {
        // 6. Standardised error handling.
        if (error instanceof APIError) {
          res.status(error.statusCode).json(error.toJSON());
          return;
        }

        // Re-throw non-API errors to Express error middleware (if any).
        next(error);
      }
    };
  }
}

export default ExpressAdapter;
