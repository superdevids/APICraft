# create-apicraft

Scaffolding CLI for creating new APICraft projects.

## Usage

```bash
# Using npm
npm create apicraft my-api

# Using pnpm
pnpm create apicraft my-api

# Using yarn
yarn create apicraft my-api

# Using npx
npx create-apicraft my-api
```

## Features

- Interactive project scaffolding with prompts
- Support for all 6 framework adapters (Express, Fastify, Hono, Koa, Next.js, NestJS)
- Optional features: WebSocket, File Upload, JWT Auth, Rate Limiting
- Automatic dependency installation
- Generates complete project structure with sample API
- Environment variable template generation

## What It Creates

```
my-api/
├── src/
│   ├── apis/
│   │   └── users.ts         # Sample CRUD API
│   ├── generated/            # For auto-generated artifacts
│   └── index.ts             # Server entry point
├── .env.example
├── .gitignore
├── apicraft.config.ts        # APICraft configuration
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
