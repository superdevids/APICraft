import "reflect-metadata"
import { APICraftApp } from "@apicraft/core"
import { AuthAPI } from "./apis/auth.js"
import { ProductsAPI } from "./apis/products.js"
import { OrdersAPI } from "./apis/orders.js"

const app = APICraftApp.create({
  apis: [AuthAPI, ProductsAPI, OrdersAPI],
  adapter: "express",
  openapi: {
    title: "E-Commerce API",
    version: "1.0.0",
    description: "A full-featured e-commerce API with auth, products, and orders",
  },
  middleware: {
    cors: { origin: process.env.CORS_ORIGIN || "*" },
    logger: { level: "info", format: "dev" },
    rateLimiter: { window: 60000, max: 100 },
    helmet: {},
  },
  auth: {
    jwt: { secret: process.env.JWT_SECRET || "dev-secret-key-change-in-production" },
  },
})

const PORT = parseInt(process.env.PORT || "3000", 10)
app.listen(PORT).then(() => {
  console.log(`E-Commerce API running on http://localhost:${PORT}`)
  console.log(`API Docs: http://localhost:${PORT}/docs`)
})
