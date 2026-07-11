# E-Commerce API — APICraft Example

A complex e-commerce API demonstrating authentication, guards, rate limiting, and relational resources with APICraft.

## What it demonstrates

- JWT authentication with `@guard(JWTAuthGuard)`
- Public vs protected endpoints
- Rate limiting middleware
- Helmet security headers
- CORS configuration
- Resource relationships (users → orders → products)
- Custom middleware for request logging
- Pagination support

## Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | No | Login with email + password, returns JWT |
| POST | `/auth/register` | No | Register a new user, returns JWT |
| GET | `/auth/me` | JWT | Get current user profile |

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/products` | No | List products with pagination |
| GET | `/products/:id` | No | Get product by ID |
| POST | `/products` | JWT | Create a product |
| PUT | `/products/:id` | JWT | Update a product |
| DELETE | `/products/:id` | JWT | Delete a product |

### Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orders` | JWT | List current user's orders |
| GET | `/orders/:id` | JWT | Get order details |
| POST | `/orders` | JWT | Create order from cart items |
| PATCH | `/orders/:id/status` | JWT | Update order status |

## Usage

```bash
pnpm install
pnpm dev
# Server on http://localhost:3000
```

## Example flow

```bash
# 1. Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com", "password": "secret123", "name": "Test User"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@test.com", "password": "secret123"}'

# 3. Use the token for authenticated requests
TOKEN="<jwt-from-login>"

# Create a product
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Widget", "price": 9.99, "category": "gadgets", "stock": 100}'

# List products (public)
curl http://localhost:3000/products

# Create an order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"items": [{"productId": "<product-id>", "quantity": 2}]}'
```
