import type { APICraftPlugin, APIDefinition, RouteDefinition, RequestContext } from "../types/index.js";

/**
 * Central registry and trigger for all registered plugins.
 * Used internally by APICraftApp to fire hooks at the appropriate times.
 */
export class PluginManager {
  private plugins = new Map<string, APICraftPlugin>();

  /**
   * Register a plugin.
   *
   * @throws {Error} If the plugin name is already registered, or if
   *                 the plugin lacks required `name` and `version` fields.
   */
  register(plugin: APICraftPlugin): void {
    if (!plugin.name || !plugin.version) {
      throw new Error(`Plugin must have both "name" and "version" properties`);
    }
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister a previously registered plugin.
   *
   * @throws {Error} If the plugin is not registered.
   */
  unregister(name: string): void {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is not registered`);
    }
    this.plugins.delete(name);
  }

  /** Retrieve a plugin by name, or `undefined` if not found. */
  getPlugin(name: string): APICraftPlugin | undefined {
    return this.plugins.get(name);
  }

  /** Return all registered plugins. */
  getAllPlugins(): APICraftPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Synchronously trigger onDefinitionScan on all plugins. */
  triggerOnDefinitionScan(definitions: APIDefinition[]): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.hooks.onDefinitionScan?.(definitions);
      } catch (err) {
        console.error(`[PluginManager] "${plugin.name}" onDefinitionScan error:`, err);
      }
    }
  }

  /** Synchronously trigger onRouteRegister on all plugins. */
  triggerOnRouteRegister(route: RouteDefinition): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.hooks.onRouteRegister?.(route);
      } catch (err) {
        console.error(`[PluginManager] "${plugin.name}" onRouteRegister error:`, err);
      }
    }
  }

  /** Synchronously trigger onGenerateOpenAPI on all plugins. */
  triggerOnGenerateOpenAPI(spec: object): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.hooks.onGenerateOpenAPI?.(spec);
      } catch (err) {
        console.error(`[PluginManager] "${plugin.name}" onGenerateOpenAPI error:`, err);
      }
    }
  }

  /** Asynchronously trigger onRequest on all plugins. */
  async triggerOnRequest(ctx: RequestContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.hooks.onRequest?.(ctx);
      } catch (err) {
        console.error(`[PluginManager] "${plugin.name}" onRequest error:`, err);
      }
    }
  }

  /** Asynchronously trigger onResponse on all plugins. */
  async triggerOnResponse(ctx: RequestContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.hooks.onResponse?.(ctx);
      } catch (err) {
        console.error(`[PluginManager] "${plugin.name}" onResponse error:`, err);
      }
    }
  }

  /** Asynchronously trigger onError on all plugins. */
  async triggerOnError(ctx: RequestContext, error: Error): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.hooks.onError?.(ctx, error);
      } catch (err) {
        console.error(`[PluginManager] "${plugin.name}" onError error:`, err);
      }
    }
  }
}
