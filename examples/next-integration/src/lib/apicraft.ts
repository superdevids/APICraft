import "reflect-metadata"
import { APICraftApp } from "@apicraft/core"
import { NextAdapter } from "@apicraft/adapter-next"
import { PostsAPI } from "../apis/posts.js"

const nextAdapter = new NextAdapter({
  apiPrefix: "/api",
})

export const apicraftApp = APICraftApp.create({
  apis: [PostsAPI],
  adapter: nextAdapter,
  openapi: {
    title: "Posts API",
    version: "1.0.0",
    description: "Blog posts API integrated with Next.js App Router",
  },
  middleware: {
    logger: { level: "info" },
  },
})
