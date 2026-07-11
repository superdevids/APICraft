# Todo App — APICraft Example

A simple CRUD todo list API demonstrating APICraft's core features.

## What it demonstrates

- `@api()` class decorator for API grouping
- `@get()`, `@post()`, `@patch()`, `@del()` HTTP method decorators
- `@param()`, `@query()`, `@body()` parameter decorators
- `@response()` status code decorator
- Zod schema validation for request bodies
- In-memory data storage with Map
- Multiple API classes in a single app
- Auto-generated OpenAPI spec and docs UI
- Express adapter integration

## Endpoints

### Todos

| Method | Path | Description |
|--------|------|-------------|
| GET | `/todos` | List all todos (supports `?completed=true`) |
| GET | `/todos/:id` | Get a single todo by ID |
| POST | `/todos` | Create a new todo |
| PATCH | `/todos/:id` | Partially update a todo |
| DELETE | `/todos/:id` | Delete a todo |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all users |
| POST | `/users` | Create a new user |

## Usage

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Server runs on http://localhost:3000
# API docs at http://localhost:3000/docs
```

## Example requests

```bash
# Create a todo
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn APICraft", "completed": false}'

# List todos
curl http://localhost:3000/todos

# Get single todo
curl http://localhost:3000/todos/1

# Update a todo
curl -X PATCH http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Delete a todo
curl -X DELETE http://localhost:3000/todos/1
```
