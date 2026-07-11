import "reflect-metadata"
import { APICraftApp } from "@apicraft/core"
import { TodosAPI } from "./apis/todos.js"
import { UsersAPI } from "./apis/users.js"

const app = APICraftApp.create({
  apis: [TodosAPI, UsersAPI],
  adapter: "express",
  openapi: {
    title: "Todo API",
    version: "1.0.0",
    description: "A simple CRUD todo list API built with APICraft",
  },
  middleware: {
    cors: { origin: "*" },
    logger: { level: "info", format: "dev" },
  },
})

const PORT = parseInt(process.env.PORT || "3000", 10)
app.listen(PORT).then(() => {
  console.log(`Todo API running on http://localhost:${PORT}`)
  console.log(`API Docs: http://localhost:${PORT}/docs`)
})
