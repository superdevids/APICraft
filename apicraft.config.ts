import { defineConfig } from "@apicraft/core";

export default defineConfig({
  title: "My API",
  version: "1.0.0",
  description: "API built with APICraft",
  openapi: {
    output: "./openapi.json",
    format: "json",
  },
  client: {
    output: "./client",
  },
  server: {
    port: 3000,
    adapter: "express",
  },
});
