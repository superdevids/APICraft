import { api, get, post, body, response, guard, context } from "@apicraft/core"
import { JWTAuthGuard } from "@apicraft/middleware-auth"
import type { RequestContext } from "@apicraft/core"
import { APIError } from "@apicraft/core"
import { z } from "zod"
import jwt from "jsonwebtoken"

interface AppUser {
  id: string
  email: string
  name: string
  password: string
  createdAt: string
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production"

const RegisterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required").max(100),
})

const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

@api("/auth", { tags: ["Auth"] })
export class AuthAPI {
  private users = new Map<string, AppUser>()

  constructor() {
    this.seed()
  }

  private seed(): void {
    const user: AppUser = {
      id: crypto.randomUUID(),
      email: "admin@example.com",
      name: "Admin",
      password: "admin123",
      createdAt: new Date().toISOString(),
    }
    this.users.set(user.email, user)
  }

  private generateToken(user: AppUser): string {
    return jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" },
    )
  }

  @post("/register")
  @response(201)
  async register(
    @body(RegisterSchema) data: z.infer<typeof RegisterSchema>,
  ): Promise<{ user: Omit<AppUser, "password">; token: string }> {
    if (this.users.has(data.email)) {
      throw new APIError(409, "A user with this email already exists")
    }
    const user: AppUser = {
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      password: data.password,
      createdAt: new Date().toISOString(),
    }
    this.users.set(user.email, user)
    const { password: _, ...safeUser } = user
    const token = this.generateToken(user)
    return { user: safeUser, token }
  }

  @post("/login")
  @response(200)
  async login(
    @body(LoginSchema) data: z.infer<typeof LoginSchema>,
  ): Promise<{ user: Omit<AppUser, "password">; token: string }> {
    const user = this.users.get(data.email)
    if (!user || user.password !== data.password) {
      throw new APIError(401, "Invalid email or password")
    }
    const { password: _, ...safeUser } = user
    const token = this.generateToken(user)
    return { user: safeUser, token }
  }

  @get("/me")
  @guard(JWTAuthGuard)
  @response(200)
  async getProfile(
    @context() ctx: RequestContext,
  ): Promise<{ user: Omit<AppUser, "password"> }> {
    const userId = ctx.user?.id
    if (!userId) {
      throw new APIError(401, "Not authenticated")
    }
    const user = Array.from(this.users.values()).find((u) => u.id === userId)
    if (!user) {
      throw new APIError(404, "User not found")
    }
    const { password: _, ...safeUser } = user
    return { user: safeUser }
  }
}
