# Next.js Integration — APICraft Example

Demonstrates APICraft integrated with Next.js App Router.

## What it demonstrates

- APICraft API definitions in a Next.js project
- Next.js App Router adapter usage
- Generated route handlers via APICraft
- Client components consuming API data
- Full-stack TypeScript with a single source of truth

## Architecture

```
src/
├── apis/
│   └── posts.ts          ← APICraft API definition
├── app/
│   ├── api/
│   │   └── posts/
│   │       └── route.ts  ← Generated route handler (or hand-written)
│   ├── posts/
│   │   └── page.tsx      ← Client component listing posts
│   ├── layout.tsx        ← Root layout
│   └── page.tsx           ← Home page
└── lib/
    └── apicraft.ts        ← APICraft initialization
```

## Usage

```bash
# Install dependencies
pnpm install

# Run Next.js dev server
pnpm dev

# Server on http://localhost:3000
```

## How it works

1. `src/apis/posts.ts` defines the Posts API using APICraft decorators
2. `src/lib/apicraft.ts` creates the APICraft app with the Next.js adapter
3. Route handlers in `src/app/api/` delegate to APICraft's `executeRequest`
4. Page components fetch data from the API at build-time or client-side
