import { api, get, post, put, del, param, query, body, response, guard } from "@apicraft/core"
import { JWTAuthGuard } from "@apicraft/middleware-auth"
import { APIError, NotFoundError } from "@apicraft/core"
import { z } from "zod"

interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  stock: number
  imageUrl: string
  createdAt: string
}

const CreateProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1).max(2000),
  price: z.number().positive("Price must be positive"),
  category: z.string().min(1),
  stock: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().default(""),
})

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional(),
})

@api("/products", { tags: ["Products"] })
export class ProductsAPI {
  private products = new Map<string, Product>()

  constructor() {
    this.seed()
  }

  private seed(): void {
    const samples: Product[] = [
      {
        id: crypto.randomUUID(),
        name: "Wireless Headphones",
        description: "Premium noise-cancelling wireless headphones with 30hr battery life",
        price: 149.99,
        category: "electronics",
        stock: 50,
        imageUrl: "https://example.com/headphones.png",
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Running Shoes",
        description: "Lightweight running shoes with responsive cushioning",
        price: 89.99,
        category: "sports",
        stock: 100,
        imageUrl: "https://example.com/shoes.png",
        createdAt: new Date().toISOString(),
      },
    ]
    for (const product of samples) {
      this.products.set(product.id, product)
    }
  }

  @get("/")
  @response(200)
  async list(
    @query("page", { default: "1" }) page?: string,
    @query("limit", { default: "20" }) limit?: string,
    @query("category", { required: false }) category?: string,
  ): Promise<{ data: Product[]; meta: { total: number; page: number; limit: number } }> {
    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || "20", 10) || 20))
    let all = Array.from(this.products.values())
    if (category) {
      all = all.filter((p) => p.category === category)
    }
    const total = all.length
    const start = (pageNum - 1) * limitNum
    const data = all.slice(start, start + limitNum)
    return { data, meta: { total, page: pageNum, limit: limitNum } }
  }

  @get("/:id")
  @response(200)
  async getById(
    @param("id") id: string,
  ): Promise<Product> {
    const product = this.products.get(id)
    if (!product) {
      throw new NotFoundError(`Product with id "${id}" not found`)
    }
    return product
  }

  @post("/")
  @guard(JWTAuthGuard)
  @response(201)
  async create(
    @body(CreateProductSchema) data: z.infer<typeof CreateProductSchema>,
  ): Promise<Product> {
    const product: Product = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      stock: data.stock,
      imageUrl: data.imageUrl || "",
      createdAt: new Date().toISOString(),
    }
    this.products.set(product.id, product)
    return product
  }

  @put("/:id")
  @guard(JWTAuthGuard)
  @response(200)
  async update(
    @param("id") id: string,
    @body(UpdateProductSchema) data: z.infer<typeof UpdateProductSchema>,
  ): Promise<Product> {
    const existing = this.products.get(id)
    if (!existing) {
      throw new NotFoundError(`Product with id "${id}" not found`)
    }
    const updated: Product = { ...existing, ...data }
    this.products.set(id, updated)
    return updated
  }

  @del("/:id")
  @guard(JWTAuthGuard)
  @response(200)
  async remove(
    @param("id") id: string,
  ): Promise<{ success: boolean }> {
    if (!this.products.has(id)) {
      throw new NotFoundError(`Product with id "${id}" not found`)
    }
    this.products.delete(id)
    return { success: true }
  }
}
