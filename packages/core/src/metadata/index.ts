import "reflect-metadata";
import type { APIDefinition, RouteDefinition, ParameterDefinition } from "../types/index.js";

export const API_METADATA_KEY = "apicraft:api";
export const ROUTE_METADATA_KEY = "apicraft:route";
export const PARAM_METADATA_KEY = "apicraft:param";

export class DefinitionRegistry {
  private static instance: DefinitionRegistry;
  private apiMap = new Map<Function, APIDefinition>();

  static getInstance(): DefinitionRegistry {
    if (!DefinitionRegistry.instance) {
      DefinitionRegistry.instance = new DefinitionRegistry();
    }
    return DefinitionRegistry.instance;
  }

  registerAPI(target: Function, metadata: APIDefinition): void {
    const existing = this.apiMap.get(target);
    if (existing) {
      Object.assign(existing, metadata, { routes: existing.routes ?? [] });
      return;
    }
    this.apiMap.set(target, { ...metadata, routes: metadata.routes ?? [] });
  }

  registerRoute(target: Object, metadata: RouteDefinition): void {
    const routes: RouteDefinition[] = Reflect.getOwnMetadata(ROUTE_METADATA_KEY, target) ?? [];
    routes.push(metadata);
    Reflect.defineMetadata(ROUTE_METADATA_KEY, routes, target);
  }

  registerParam(target: Object, metadata: ParameterDefinition): void {
    const params: ParameterDefinition[] = Reflect.getOwnMetadata(PARAM_METADATA_KEY, target) ?? [];
    params.push(metadata);
    Reflect.defineMetadata(PARAM_METADATA_KEY, params, target);
  }

  getAPIDefinition(target: Function): APIDefinition | undefined {
    return this.apiMap.get(target);
  }

  getRouteDefinitions(target: Function): RouteDefinition[] {
    return Reflect.getOwnMetadata(ROUTE_METADATA_KEY, target.prototype) ?? [];
  }

  getParamDefinitions(target: Function): ParameterDefinition[] {
    return Reflect.getOwnMetadata(PARAM_METADATA_KEY, target.prototype) ?? [];
  }

  getAllDefinitions(): APIDefinition[] {
    return Array.from(this.apiMap.values());
  }

  scan(classes: Function[]): APIDefinition[] {
    const results: APIDefinition[] = [];

    for (const cls of classes) {
      const apiDef = this.getAPIDefinition(cls);
      if (!apiDef) continue;

      const routeDefs = this.getRouteDefinitions(cls);
      const paramDefs = this.getParamDefinitions(cls);

      const sortedParamDefs = paramDefs.sort((a: ParameterDefinition, b: ParameterDefinition) => a.index - b.index);

      const combinedRoutes: RouteDefinition[] = [];
      for (const route of routeDefs) {
        const routeParams = sortedParamDefs.filter(
          (p: ParameterDefinition) => p.kind !== "context" && p.kind !== "body" && p.kind !== "headers",
        );
        combinedRoutes.push({
          ...route,
          parameters: route.parameters.length > 0 ? route.parameters : routeParams,
          guards: [...(apiDef.guards ?? []), ...route.guards],
          middleware: [...(apiDef.middleware ?? []), ...route.middleware],
        });
      }

      results.push({
        ...apiDef,
        routes: combinedRoutes,
      });
    }

    return results;
  }
}
