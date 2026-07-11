import { defineConfig } from "@apicraft/core";

export default defineConfig({
  title: "APICraft API",
  version: "1.0.0",
  description: "A sample API built with APICraft — Code-First API Framework",
  apis: [],
  adapter: "express",
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  openapi: {
    title: "APICraft API",
    version: "1.0.0",
    description: "Auto-generated OpenAPI 3.1 specification",
    output: "./generated",
    servers: [{ url: "http://localhost:3000", description: "Development server" }],
  },
  client: {
    output: "./generated",
    name: "APICraftClient",
  },
  middleware: {
    cors: { origin: "*" },
    logger: { level: "info", format: "dev" },
    rateLimiter: { windowMs: 60000, max: 100 },
    compression: { threshold: 1024 },
    helmet: { contentSecurityPolicy: false },
  },
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
      algorithms: ["HS256"],
    },
  },
});
