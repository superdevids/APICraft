import { api, get, post, body, response } from "@apicraft/core"
import { z } from "zod"

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

const CreateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email format"),
})

@api("/users", { tags: ["Users"] })
export class UsersAPI {
  private users = new Map<string, User>()

  constructor() {
    this.seed()
  }

  private seed(): void {
    const user: User = {
      id: crypto.randomUUID(),
      name: "Demo User",
      email: "demo@example.com",
      createdAt: new Date().toISOString(),
    }
    this.users.set(user.id, user)
  }

  @get("/")
  @response(200)
  async list(): Promise<{ data: User[]; total: number }> {
    const data = Array.from(this.users.values())
    return { data, total: data.length }
  }

  @post("/")
  @response(201)
  async create(
    @body(CreateUserSchema) data: z.infer<typeof CreateUserSchema>,
  ): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      createdAt: new Date().toISOString(),
    }
    this.users.set(user.id, user)
    return user
  }
}
