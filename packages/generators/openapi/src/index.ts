import type { APIDefinition, RouteDefinition, ParameterDefinition, TypeSchema } from "@apicraft/core";
import yaml from "js-yaml";

export interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  enum?: string[];
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  $ref?: string;
  nullable?: boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
}

export interface ParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required: boolean;
  schema: SchemaObject;
  example?: unknown;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema: SchemaObject;
  example?: unknown;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: ParameterObject[];
}

export interface SecuritySchemeObject {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface OpenAPI3_1Document {
  openapi: "3.1.0";
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecuritySchemeObject>;
  };
  tags?: Array<{ name: string; description?: string }>;
  security?: Array<Record<string, string[]>>;
  externalDocs?: { url: string; description?: string };
}

export interface Generator {
  generate(): string | object;
  generateToFile?(outputPath: string): Promise<void>;
}

function toParamPath(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

function methodToKey(method: string): string {
  return method.toLowerCase();
}

export class OpenAPIGenerator implements Generator {
  constructor(
    private definitions: APIDefinition[],
    private config: {
      title: string;
      version: string;
      description?: string;
      servers?: Array<{ url: string; description?: string }>;
    },
  ) {}

  generate(): OpenAPI3_1Document {
    const paths = this.buildPaths();
    const components = this.buildComponents();
    const tags = this.buildTags();

    const doc: OpenAPI3_1Document = {
      openapi: "3.1.0",
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
      },
      paths,
      components,
    };

    if (this.config.servers && this.config.servers.length > 0) {
      doc.servers = this.config.servers;
    }

    if (tags.length > 0) {
      doc.tags = tags;
    }

    const securitySchemes = this.buildSecuritySchemes();
    if (Object.keys(securitySchemes).length > 0) {
      doc.components.securitySchemes = securitySchemes;
    }

    return doc;
  }

  generateJSON(): string {
    return JSON.stringify(this.generate(), null, 2);
  }

  generateYAML(): string {
    return yaml.dump(this.generate(), {
      indent: 2,
      lineWidth: 120,
      noRefs: false,
      sortKeys: false,
    });
  }

  generateToFile(outputPath: string): Promise<void> {
    const content = outputPath.endsWith(".yaml") || outputPath.endsWith(".yml")
      ? this.generateYAML()
      : this.generateJSON();
    return Promise.resolve().then(() => {
      const fs = require("fs");
      fs.writeFileSync(outputPath, content, "utf-8");
    });
  }

  private buildPaths(): Record<string, PathItem> {
    const paths: Record<string, PathItem> = {};

    for (const api of this.definitions) {
      for (const route of api.routes) {
        const openapiPath = toParamPath(route.fullPath || `${api.prefix}${route.path}`);
        if (!paths[openapiPath]) {
          paths[openapiPath] = {};
        }

        const operation = this.buildOperation(api, route);
        const method = methodToKey(route.method);

        if (method === "get" || method === "post" || method === "put" || method === "patch" || method === "delete") {
          (paths[openapiPath] as Record<string, Operation>)[method] = operation;
        }
      }
    }

    return paths;
  }

  private buildOperation(api: APIDefinition, route: RouteDefinition): Operation {
    const operation: Operation = {
      operationId: `${api.name}_${route.handlerName}`,
      summary: route.summary,
      description: route.description,
      tags: [...api.tags],
      responses: this.buildResponses(route),
    };

    const pathParams = route.parameters.filter((p) => p.kind === "param");
    const queryParams = route.parameters.filter((p) => p.kind === "query");
    const headerParams = route.parameters.filter((p) => p.kind === "headers");

    const allParams = [...pathParams, ...queryParams, ...headerParams];
    if (allParams.length > 0) {
      operation.parameters = this.buildParameters(allParams);
    }

    const bodyParam = route.parameters.find((p) => p.kind === "body");
    if (bodyParam) {
      operation.requestBody = this.buildRequestBody(bodyParam);
    }

    return operation;
  }

  private buildParameters(params: ParameterDefinition[]): ParameterObject[] {
    return params.map((p) => {
      const inType = p.kind === "param" ? "path" : p.kind === "query" ? "query" : "header";
      return {
        name: p.name,
        in: inType,
        description: p.description,
        required: p.kind === "param" ? true : p.required,
        schema: this.buildSchema(p.type),
        default: p.default,
      };
    });
  }

  private buildRequestBody(param: ParameterDefinition): RequestBodyObject {
    return {
      description: param.description,
      required: param.required,
      content: {
        "application/json": {
          schema: this.buildSchema(param.type),
        },
      },
    };
  }

  private buildResponses(route: RouteDefinition): Record<string, ResponseObject> {
    const responses: Record<string, ResponseObject> = {};

    const successKey = String(route.responseStatus || 200);
    responses[successKey] = {
      description: "Successful response",
    };

    const returnType = this.inferReturnType(route);
    if (returnType) {
      responses[successKey].content = {
        "application/json": {
          schema: returnType,
        },
      };
    }

    responses["400"] = {
      description: "Bad request",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    };

    responses["401"] = {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    };

    responses["500"] = {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    };

    return responses;
  }

  private inferReturnType(route: RouteDefinition): SchemaObject | null {
    // Try to infer a basic response schema from the route parameters
    // that are not body/context (these may indicate the response shape)
    const pathParams = route.parameters.filter((p) => p.kind === "param");
    const queryParams = route.parameters.filter((p) => p.kind === "query");

    // For list endpoints (path ends with "/" or has query params like page/limit),
    // infer an array response
    const isListEndpoint = route.path === "/" && queryParams.some((p) => p.name === "page" || p.name === "limit");

    if (isListEndpoint) {
      return {
        type: "array",
        items: { type: "object" },
      };
    }

    // For single-resource endpoints (has :id path param), infer an object response
    if (pathParams.some((p) => p.name === "id")) {
      return {
        type: "object",
        properties: {
          id: { type: "string" },
        },
      };
    }

    // For create endpoints (POST /), infer an object response
    if (route.method === "post" && route.path === "/") {
      return {
        type: "object",
      };
    }

    // Default: return a generic object schema for GET endpoints, null for others
    if (route.method === "get") {
      return { type: "object" };
    }

    return null;
  }

  private buildSchema(type: TypeSchema): SchemaObject {
    return this.convertTypeToOpenAPI(type);
  }

  private buildComponents(): { schemas: Record<string, SchemaObject> } {
    const schemas: Record<string, SchemaObject> = {};

    for (const api of this.definitions) {
      for (const route of api.routes) {
        for (const param of route.parameters) {
          if (param.type.kind === "reference" && param.type.name) {
            const schemaName = param.type.name;
            if (!schemas[schemaName]) {
              schemas[schemaName] = this.resolveReferenceSchema(param.type);
            }
          }

          if (param.type.kind === "object" && param.type.name) {
            const schemaName = param.type.name;
            if (!schemas[schemaName]) {
              schemas[schemaName] = this.convertTypeToOpenAPI(param.type);
            }
          }
        }
      }
    }

    return { schemas };
  }

  private resolveReferenceSchema(type: TypeSchema): SchemaObject {
    return {
      type: "object",
      description: type.name ? `Schema for ${type.name}` : "Referenced schema",
      properties: {},
    };
  }

  private buildTags(): Array<{ name: string; description?: string }> {
    const tagMap = new Map<string, string>();

    for (const api of this.definitions) {
      for (const tag of api.tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, `Operations related to ${tag}`);
        }
      }
      if (api.tags.length === 0) {
        const tag = api.name;
        if (!tagMap.has(tag)) {
          tagMap.set(tag, `Operations for ${api.name}`);
        }
      }
    }

    return Array.from(tagMap.entries()).map(([name, description]) => ({ name, description }));
  }

  private buildSecuritySchemes(): Record<string, SecuritySchemeObject> {
    const schemes: Record<string, SecuritySchemeObject> = {};

    for (const api of this.definitions) {
      for (const guard of api.guards) {
        const name = guard.class.name || "defaultAuth";
        if (!schemes[name]) {
          schemes[name] = {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT authentication",
          };
        }
      }

      for (const route of api.routes) {
        for (const guard of route.guards) {
          const name = guard.class.name || "defaultAuth";
          if (!schemes[name]) {
            schemes[name] = {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "JWT authentication",
            };
          }
        }
      }
    }

    return schemes;
  }

  private convertTypeToOpenAPI(type: TypeSchema): SchemaObject {
    switch (type.kind) {
      case "string": {
        const schema: SchemaObject = { type: "string" };
        if (type.format) schema.format = type.format;
        if (type.zodInfo?.email) schema.format = "email";
        if (type.zodInfo?.uuid) schema.format = "uuid";
        if (type.zodInfo?.pattern) schema.pattern = type.zodInfo.pattern;
        if (type.zodInfo?.min !== undefined) schema.minLength = type.zodInfo.min;
        if (type.zodInfo?.max !== undefined) schema.maxLength = type.zodInfo.max;
        return schema;
      }

      case "number": {
        const schema: SchemaObject = { type: "number" };
        if (type.format) schema.format = type.format;
        if (type.zodInfo?.min !== undefined) schema.minimum = type.zodInfo.min;
        if (type.zodInfo?.max !== undefined) schema.maximum = type.zodInfo.max;
        return schema;
      }

      case "boolean": {
        return { type: "boolean" };
      }

      case "array": {
        const schema: SchemaObject = { type: "array" };
        if (type.items) {
          schema.items = this.convertTypeToOpenAPI(type.items);
        } else {
          schema.items = {};
        }
        return schema;
      }

      case "object": {
        const schema: SchemaObject = { type: "object" };
        if (type.properties) {
          schema.properties = {};
          schema.required = [];

          for (const [key, propType] of Object.entries(type.properties)) {
            schema.properties[key] = this.convertTypeToOpenAPI(propType);
            if (type.required?.includes(key)) {
              schema.required!.push(key);
            }
          }
        }

        return schema;
      }

      case "enum": {
        const schema: SchemaObject = { type: "string" };
        if (type.enum) {
          schema.enum = type.enum;
        }
        return schema;
      }

      case "union": {
        if (type.members && type.members.length > 0) {
          return {
            oneOf: type.members.map((m) => this.convertTypeToOpenAPI(m)),
          };
        }
        return {};
      }

      case "reference": {
        if (type.name) {
          return { $ref: `#/components/schemas/${type.name}` };
        }
        return {};
      }

      default:
        return {};
    }
  }
}

export default OpenAPIGenerator;
