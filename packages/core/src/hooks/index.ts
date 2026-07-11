import type { RequestContext } from "../types/index.js";

/**
 * Lifecycle hooks that can be applied to individual API classes.
 * These hooks fire before and after request handling for that specific API.
 *
 * API classes can implement this interface directly and the hooks
 * will be called automatically during request processing:
 *
 * @example
 * ```typescript
 * @api("/users")
 * class UsersAPI implements LifecycleHooks {
 *   async beforeRequest(ctx: RequestContext) {
 *     console.log(`[UsersAPI] Starting ${ctx.request.method} ${ctx.request.path}`);
 *   }
 *   async afterRequest(ctx: RequestContext) {
 *     console.log(`[UsersAPI] Completed with status ${ctx.response.statusCode}`);
 *   }
 *   async onError(ctx: RequestContext, error: Error) {
 *     console.error(`[UsersAPI] Error: ${error.message}`);
 *   }
 * }
 * ```
 */
export interface LifecycleHooks {
  /** Called before the route handler executes. */
  beforeRequest?(ctx: RequestContext): Promise<void>;
  /** Called after the route handler completes successfully. */
  afterRequest?(ctx: RequestContext): Promise<void>;
  /** Called when an error is thrown during request processing. */
  onError?(ctx: RequestContext, error: Error): Promise<void>;
}

/**
 * Manages lifecycle hooks registered per API name.
 * Hooks can be registered programmatically or automatically detected
 * from API class instances.
 */
export class LifecycleManager {
  private hooks = new Map<string, LifecycleHooks>();

  /**
   * Register lifecycle hooks for a named API.
   *
   * @param apiName - The name of the API (matches the class name)
   * @param hooks - Lifecycle hooks implementation
   */
  register(apiName: string, hooks: LifecycleHooks): void {
    this.hooks.set(apiName, hooks);
  }

  /**
   * Retrieve the lifecycle hooks registered for an API.
   */
  getHooks(apiName: string): LifecycleHooks | undefined {
    return this.hooks.get(apiName);
  }

  /**
   * Remove lifecycle hooks for a named API.
   */
  unregister(apiName: string): void {
    this.hooks.delete(apiName);
  }

  /** Execute the beforeRequest hook for the given API, if registered. */
  async executeBeforeRequest(apiName: string, ctx: RequestContext): Promise<void> {
    const hooks = this.hooks.get(apiName);
    if (!hooks?.beforeRequest) return;
    await hooks.beforeRequest(ctx);
  }

  /** Execute the afterRequest hook for the given API, if registered. */
  async executeAfterRequest(apiName: string, ctx: RequestContext): Promise<void> {
    const hooks = this.hooks.get(apiName);
    if (!hooks?.afterRequest) return;
    await hooks.afterRequest(ctx);
  }

  /** Execute the onError hook for the given API, if registered. */
  async executeOnError(apiName: string, ctx: RequestContext, error: Error): Promise<void> {
    const hooks = this.hooks.get(apiName);
    if (!hooks?.onError) return;
    await hooks.onError(ctx, error);
  }
}
