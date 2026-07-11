import { api, get, post, patch, param, body, response, guard, context } from "@apicraft/core"
import { JWTAuthGuard } from "@apicraft/middleware-auth"
import { APIError, NotFoundError } from "@apicraft/core"
import type { RequestContext } from "@apicraft/core"
import { z } from "zod"

interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
}

interface Order {
  id: string
  userId: string
  items: OrderItem[]
  totalAmount: number
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  createdAt: string
  updatedAt: string
}

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive("Quantity must be at least 1"),
})

const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, "At least one item is required"),
})

const UpdateStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
})

@api("/orders", { tags: ["Orders"] })
@guard(JWTAuthGuard)
export class OrdersAPI {
  private orders = new Map<string, Order>()

  @get("/")
  @response(200)
  async list(
    @context() ctx: RequestContext,
  ): Promise<{ data: Order[]; total: number }> {
    const userId = ctx.user?.id
    const userOrders = Array.from(this.orders.values())
      .filter((o) => o.userId === userId)
    return { data: userOrders, total: userOrders.length }
  }

  @get("/:id")
  @response(200)
  async getById(
    @param("id") id: string,
    @context() ctx: RequestContext,
  ): Promise<Order> {
    const order = this.orders.get(id)
    if (!order) {
      throw new NotFoundError(`Order with id "${id}" not found`)
    }
    if (order.userId !== ctx.user?.id) {
      throw new APIError(403, "You do not have access to this order")
    }
    return order
  }

  @post("/")
  @response(201)
  async create(
    @body(CreateOrderSchema) data: z.infer<typeof CreateOrderSchema>,
    @context() ctx: RequestContext,
  ): Promise<Order> {
    const items: OrderItem[] = data.items.map((item) => ({
      productId: item.productId,
      name: "Product", // In a real app, fetch from products service
      price: 0,
      quantity: item.quantity,
    }))

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const now = new Date().toISOString()

    const order: Order = {
      id: crypto.randomUUID(),
      userId: ctx.user?.id || "unknown",
      items,
      totalAmount,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }
    this.orders.set(order.id, order)
    return order
  }

  @patch("/:id/status")
  @response(200)
  async updateStatus(
    @param("id") id: string,
    @body(UpdateStatusSchema) data: z.infer<typeof UpdateStatusSchema>,
  ): Promise<Order> {
    const order = this.orders.get(id)
    if (!order) {
      throw new NotFoundError(`Order with id "${id}" not found`)
    }
    const updated: Order = {
      ...order,
      status: data.status,
      updatedAt: new Date().toISOString(),
    }
    this.orders.set(id, updated)
    return updated
  }
}
