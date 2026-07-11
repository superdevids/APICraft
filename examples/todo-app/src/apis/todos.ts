import {
  api, get, post, patch, del,
  param, query, body, response,
} from "@apicraft/core"
import { APIError, NotFoundError } from "@apicraft/core"
import { z } from "zod"

interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

const CreateTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  completed: z.boolean().optional().default(false),
})

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
})

@api("/todos", { tags: ["Todos"] })
export class TodosAPI {
  private todos = new Map<string, Todo>()

  constructor() {
    this.seed()
  }

  private seed(): void {
    const sample: Todo = {
      id: crypto.randomUUID(),
      title: "Learn APICraft framework",
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.todos.set(sample.id, sample)
  }

  @get("/")
  @response(200)
  async list(
    @query("completed", { required: false }) completed?: string,
  ): Promise<{ data: Todo[]; total: number }> {
    const all = Array.from(this.todos.values())
    const filtered = completed !== undefined
      ? all.filter((t) => t.completed === (completed === "true"))
      : all
    return { data: filtered, total: filtered.length }
  }

  @get("/:id")
  @response(200)
  async getById(
    @param("id") id: string,
  ): Promise<Todo> {
    const todo = this.todos.get(id)
    if (!todo) {
      throw new NotFoundError(`Todo with id "${id}" not found`)
    }
    return todo
  }

  @post("/")
  @response(201)
  async create(
    @body(CreateTodoSchema) data: z.infer<typeof CreateTodoSchema>,
  ): Promise<Todo> {
    const now = new Date().toISOString()
    const todo: Todo = {
      id: crypto.randomUUID(),
      title: data.title,
      completed: data.completed ?? false,
      createdAt: now,
      updatedAt: now,
    }
    this.todos.set(todo.id, todo)
    return todo
  }

  @patch("/:id")
  @response(200)
  async update(
    @param("id") id: string,
    @body(UpdateTodoSchema) data: z.infer<typeof UpdateTodoSchema>,
  ): Promise<Todo> {
    const existing = this.todos.get(id)
    if (!existing) {
      throw new NotFoundError(`Todo with id "${id}" not found`)
    }
    const updated: Todo = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }
    this.todos.set(id, updated)
    return updated
  }

  @del("/:id")
  @response(200)
  async remove(
    @param("id") id: string,
  ): Promise<{ success: boolean }> {
    if (!this.todos.has(id)) {
      throw new NotFoundError(`Todo with id "${id}" not found`)
    }
    this.todos.delete(id)
    return { success: true }
  }
}
