import {
  api, get, post, patch, del,
  param, query, body, response,
} from "@apicraft/core"
import { APIError, NotFoundError } from "@apicraft/core"
import { z } from "zod"

export interface Post {
  id: string
  title: string
  content: string
  author: string
  published: boolean
  createdAt: string
  updatedAt: string
}

const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required"),
  author: z.string().min(1, "Author is required"),
  published: z.boolean().optional().default(false),
})

const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  published: z.boolean().optional(),
})

@api("/api/posts", { tags: ["Posts"] })
export class PostsAPI {
  private posts = new Map<string, Post>()

  constructor() {
    this.seed()
  }

  private seed(): void {
    const samples: Post[] = [
      {
        id: crypto.randomUUID(),
        title: "Getting Started with APICraft",
        content: "APICraft is a code-first API framework for TypeScript...",
        author: "APICraft Team",
        published: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        title: "Building REST APIs with Decorators",
        content: "Using decorators like @api, @get, and @post makes API definition clean...",
        author: "APICraft Team",
        published: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        title: "Coming Soon: React Query Hooks",
        content: "APICraft will auto-generate React Query hooks from your API definitions...",
        author: "APICraft Team",
        published: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    for (const post of samples) {
      this.posts.set(post.id, post)
    }
  }

  @get("/")
  @response(200)
  async list(
    @query("published", { required: false }) published?: string,
    @query("page", { default: "1" }) page?: string,
    @query("limit", { default: "10" }) limit?: string,
  ): Promise<{ data: Post[]; meta: { total: number; page: number; limit: number } }> {
    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1)
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || "10", 10) || 10))
    let all = Array.from(this.posts.values())
    if (published !== undefined) {
      all = all.filter((p) => p.published === (published === "true"))
    }
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const total = all.length
    const start = (pageNum - 1) * limitNum
    const data = all.slice(start, start + limitNum)
    return { data, meta: { total, page: pageNum, limit: limitNum } }
  }

  @get("/:id")
  @response(200)
  async getById(
    @param("id") id: string,
  ): Promise<Post> {
    const post = this.posts.get(id)
    if (!post) {
      throw new NotFoundError(`Post with id "${id}" not found`)
    }
    return post
  }

  @post("/")
  @response(201)
  async create(
    @body(CreatePostSchema) data: z.infer<typeof CreatePostSchema>,
  ): Promise<Post> {
    const now = new Date().toISOString()
    const post: Post = {
      id: crypto.randomUUID(),
      title: data.title,
      content: data.content,
      author: data.author,
      published: data.published ?? false,
      createdAt: now,
      updatedAt: now,
    }
    this.posts.set(post.id, post)
    return post
  }

  @patch("/:id")
  @response(200)
  async update(
    @param("id") id: string,
    @body(UpdatePostSchema) data: z.infer<typeof UpdatePostSchema>,
  ): Promise<Post> {
    const existing = this.posts.get(id)
    if (!existing) {
      throw new NotFoundError(`Post with id "${id}" not found`)
    }
    const updated: Post = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }
    this.posts.set(id, updated)
    return updated
  }

  @del("/:id")
  @response(200)
  async remove(
    @param("id") id: string,
  ): Promise<{ success: boolean }> {
    if (!this.posts.has(id)) {
      throw new NotFoundError(`Post with id "${id}" not found`)
    }
    this.posts.delete(id)
    return { success: true }
  }
}
