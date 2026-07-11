#!/usr/bin/env node

/**
 * create-apicraft — Scaffolding CLI for APICraft projects
 *
 * Usage:
 *   npm create apicraft my-api
 *   npx create-apicraft my-api
 *   pnpm create apicraft my-api
 */

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";

// ─── Types ───

interface ProjectOptions {
  name: string;
  adapter: string;
  pkgManager: string;
  features: {
    websocket: boolean;
    fileUpload: boolean;
    auth: boolean;
    rateLimiting: boolean;
  };
}

// ─── Adapter configurations ───

const ADAPTERS = [
  {
    name: "express",
    title: "Express.js",
    description: "Most popular Node.js web framework — largest ecosystem",
    package: "@apicraft/adapter-express",
    install: "express",
  },
  {
    name: "fastify",
    title: "Fastify",
    description: "High-performance, low-overhead web framework",
    package: "@apicraft/adapter-fastify",
    install: "fastify",
  },
  {
    name: "hono",
    title: "Hono",
    description: "Ultrafast, multi-runtime web framework",
    package: "@apicraft/adapter-hono",
    install: "hono",
  },
  {
    name: "koa",
    title: "Koa",
    description: "Express team's modern, lightweight framework",
    package: "@apicraft/adapter-koa",
    install: "koa",
  },
  {
    name: "next",
    title: "Next.js (App Router)",
    description: "Full-stack React framework with App Router",
    package: "@apicraft/adapter-next",
    install: "next",
  },
  {
    name: "nest",
    title: "NestJS",
    description: "Enterprise-grade Node.js framework",
    package: "@apicraft/adapter-nest",
    install: "@nestjs/core @nestjs/common",
  },
] as const;

// ─── Banner ───

function showBanner(): void {
  const banner = `
${chalk.cyan.bold("    ___    ____  ______   __________   ___")}
${chalk.cyan.bold("   /   |  / __ \\/_  __/  /_  __/ __ \\ /   |")}
${chalk.cyan.bold("  / /| | / /_/ / / /      / / / /_/ // /| |")}
${chalk.cyan.bold(" / __ |/ _, _/ / /      / / / _, _// __  |")}
${chalk.cyan.bold("/_/  |_/_/ |_| /_/      /_/ /_/ |_|/_/  |_|")}

${chalk.gray("Code-First API Framework for TypeScript")}
${chalk.gray("Define once. Generate everything.")}
`;
  console.log(banner);
}

// ─── Main ───

async function main(): Promise<void> {
  showBanner();

  const args = process.argv.slice(2);
  const projectNameArg = args[0] && !args[0].startsWith("-") ? args[0] : undefined;

  const options = await gatherOptions(projectNameArg);
  await createProject(options);
}

async function gatherOptions(nameArg?: string): Promise<ProjectOptions> {
  const questions: prompts.PromptObject[] = [];

  if (!nameArg) {
    questions.push({
      type: "text",
      name: "name",
      message: "Project name:",
      initial: "my-api",
      validate: (v: string) => isValidProjectName(v) || "Must be a valid npm package name",
    });
  }

  questions.push({
    type: "select",
    name: "adapter",
    message: "Choose a framework adapter:",
    choices: ADAPTERS.map((a) => ({
      title: `${a.title} — ${chalk.gray(a.description)}`,
      value: a.name,
    })),
    initial: 0,
  });

  questions.push({
    type: "select",
    name: "pkgManager",
    message: "Package manager:",
    choices: [
      { title: "npm", value: "npm" },
      { title: "pnpm", value: "pnpm" },
      { title: "yarn", value: "yarn" },
    ],
    initial: detectPkgManagerIndex(),
  });

  questions.push({
    type: "multiselect",
    name: "features",
    message: "Select optional features:",
    choices: [
      { title: "WebSocket support (@ws decorator)", value: "websocket", selected: false },
      { title: "File upload (@upload decorator)", value: "fileUpload", selected: false },
      { title: "Authentication (JWT guard)", value: "auth", selected: true },
      { title: "Rate limiting (@throttle decorator)", value: "rateLimiting", selected: true },
    ],
  });

  const response = await prompts(questions);

  return {
    name: nameArg || response.name,
    adapter: response.adapter || "express",
    pkgManager: response.pkgManager || "npm",
    features: {
      websocket: response.features?.includes("websocket") ?? false,
      fileUpload: response.features?.includes("fileUpload") ?? false,
      auth: response.features?.includes("auth") ?? true,
      rateLimiting: response.features?.includes("rateLimiting") ?? true,
    },
  };
}

async function createProject(options: ProjectOptions): Promise<void> {
  const { name, adapter, pkgManager, features } = options;
  const projectPath = path.resolve(process.cwd(), name);

  // Validate
  if (!isValidProjectName(name)) {
    console.error(chalk.red(`Invalid project name "${name}".`));
    process.exit(1);
  }

  try {
    await fsPromises.stat(projectPath);
    console.error(chalk.red(`Directory "${name}" already exists.`));
    process.exit(1);
  } catch {
    // Good — directory doesn't exist
  }

  const adapterConfig = ADAPTERS.find((a) => a.name === adapter)!;
  const spinner = ora("Creating project structure...").start();

  // Create directories
  await fsPromises.mkdir(projectPath, { recursive: true });
  await fsPromises.mkdir(path.join(projectPath, "src", "apis"), { recursive: true });
  await fsPromises.mkdir(path.join(projectPath, "src", "generated"), { recursive: true });

  // Generate files
  await generatePackageJson(projectPath, name, adapterConfig, features);
  await generateTsconfig(projectPath);
  await generateConfig(projectPath, adapter, features);
  await generateSrcIndex(projectPath, adapter, features);
  await generateUsersAPI(projectPath, features);
  await generateGitignore(projectPath);
  await generateEnvExample(projectPath, features);
  await generateReadme(projectPath, name, adapterConfig, features);

  spinner.succeed(chalk.green("Project structure created!"));

  // Install dependencies
  const installSpinner = ora(`Installing dependencies with ${pkgManager}...`).start();
  try {
    execSync(`${pkgManager} install`, {
      cwd: projectPath,
      stdio: "pipe",
      timeout: 120_000,
    });
    installSpinner.succeed(chalk.green("Dependencies installed!"));
  } catch {
    installSpinner.warn(
      chalk.yellow(`Installation failed. Run \`${pkgManager} install\` manually.`),
    );
  }

  // Success message
  console.log(`
${chalk.green("✔")} APICraft project "${chalk.bold(name)}" created successfully!

${chalk.bold("Next steps:")}
  ${chalk.cyan(`cd ${name}`)}
  ${chalk.cyan(`${pkgManager} run dev`)}

${chalk.bold("Your API:")}     http://localhost:3000
${chalk.bold("API Docs:")}    http://localhost:3000/docs
${chalk.bold("OpenAPI:")}     http://localhost:3000/openapi.json

${chalk.gray("Happy coding! 🚀")}
`);
}

// ─── File generators ───

function isValidProjectName(name: string): boolean {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name);
}

function detectPkgManagerIndex(): number {
  const userAgent = process.env.npm_config_user_agent || "";
  if (userAgent.includes("pnpm")) return 1;
  if (userAgent.includes("yarn")) return 2;
  return 0;
}

async function generatePackageJson(
  dir: string,
  name: string,
  adapter: (typeof ADAPTERS)[number],
  features: ProjectOptions["features"],
): Promise<void> {
  const dependencies: Record<string, string> = {
    apicraft: "latest",
    [adapter.package]: "latest",
    zod: "^3.23.0",
    "reflect-metadata": "^0.2.2",
  };

  // Add adapter-specific runtime dependency
  if (adapter.install) {
    for (const pkg of adapter.install.split(" ")) {
      dependencies[pkg] = "*";
    }
  }

  if (features.auth) {
    dependencies["jsonwebtoken"] = "^9.0.2";
  }

  const devDependencies: Record<string, string> = {
    typescript: "^5.6.0",
    tsx: "^4.19.0",
    "@types/node": "^20.14.0",
    "reflect-metadata": "^0.2.2",
  };

  if (features.auth) {
    devDependencies["@types/jsonwebtoken"] = "^9.0.7";
  }

  if (adapter.name === "express") {
    devDependencies["@types/express"] = "^4.17.21";
  }

  const content = {
    name,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
      generate: "apicraft generate --all",
    },
    dependencies,
    devDependencies,
  };

  await fsPromises.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(content, null, 2) + "\n",
  );
}

async function generateTsconfig(dir: string): Promise<void> {
  const content = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
    include: ["src"],
  };
  await fsPromises.writeFile(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(content, null, 2) + "\n",
  );
}

async function generateConfig(
  dir: string,
  adapter: string,
  features: ProjectOptions["features"],
): Promise<void> {
  const middleware: string[] = [];
  middleware.push("    cors: { origin: '*' }");
  middleware.push("    logger: { level: 'info', format: 'dev' }");
  if (features.rateLimiting) {
    middleware.push("    rateLimiter: { windowMs: 60000, max: 100 }");
  }
  middleware.push("    compression: { threshold: 1024 }");
  middleware.push("    helmet: { contentSecurityPolicy: false }");

  const content = `import { defineConfig } from 'apicraft'
import "reflect-metadata"

export default defineConfig({
  title: '${path.basename(dir)} API',
  version: '1.0.0',
  description: 'API built with APICraft',
  adapter: '${adapter}',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  openapi: {
    title: '${path.basename(dir)} API',
    version: '1.0.0',
    output: './generated',
    servers: [{ url: 'http://localhost:3000', description: 'Development' }],
  },
  middleware: {
${middleware.join(",\n")},
  },
${
  features.auth
    ? `  auth: {
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      algorithms: ['HS256'],
    },
  },
`
    : ""}})
`;
  await fsPromises.writeFile(path.join(dir, "apicraft.config.ts"), content);
}

async function generateSrcIndex(
  dir: string,
  adapter: string,
  features: ProjectOptions["features"],
): Promise<void> {
  const content = `import "reflect-metadata"
import { APICraftApp } from 'apicraft'
import { UsersAPI } from './apis/users.js'

const app = APICraftApp.create({
  apis: [UsersAPI],
  adapter: '${adapter}',
  openapi: {
    title: '${path.basename(dir)} API',
    version: '1.0.0',
    description: 'A REST API built with APICraft',
  },
  middleware: {
    cors: { origin: '*' },
    logger: { level: 'info', format: 'dev' },
${features.rateLimiting ? "    rateLimiter: { windowMs: 60000, max: 100 },\n" : ""}    helmet: { contentSecurityPolicy: false },
  },
${features.auth ? `  auth: {
    jwt: { secret: process.env.JWT_SECRET || 'dev-secret', algorithms: ['HS256'] },
  },\n` : ""}})

const PORT = parseInt(process.env.PORT || '3000', 10)

app.listen(PORT).then(() => {
  console.log('\\n🚀 APICraft server running!')
  console.log('   API:       http://localhost:' + PORT)
  console.log('   OpenAPI:   http://localhost:' + PORT + '/openapi.json')
  console.log('   Docs:      http://localhost:' + PORT + '/docs\\n')
})
`;
  await fsPromises.writeFile(path.join(dir, "src", "index.ts"), content);
}

async function generateUsersAPI(
  dir: string,
  features: ProjectOptions["features"],
): Promise<void> {
  const content = `import { api, get, post, put, del, param, body, query, response } from 'apicraft'
${features.auth ? "import { guard } from 'apicraft'\n" : ""}

interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

@api('/users', { tags: ['Users'], description: 'User management API' })
${features.auth ? "@guard(class { async authenticate(ctx: any) { return true } })\n" : ""}export class UsersAPI {
  private users: User[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: new Date() },
    { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: new Date() },
  ]

  @get('/')
  @response(200)
  async list(
    @query('page', { default: 1 }) page: number,
    @query('limit', { default: 10 }) limit: number,
  ) {
    const start = (page - 1) * limit
    const data = this.users.slice(start, start + limit)
    return { data, total: this.users.length, page, limit }
  }

  @get('/:id')
  @response(200)
  async getById(@param('id') id: string) {
    const user = this.users.find(u => u.id === id)
    if (!user) throw new Error('User not found')
    return user
  }

  @post('/')
  @response(201)
  async create(@body body: { name: string; email: string }) {
    const user: User = {
      id: String(this.users.length + 1),
      ...body,
      createdAt: new Date(),
    }
    this.users.push(user)
    return user
  }

  @put('/:id')
  @response(200)
  async update(
    @param('id') id: string,
    @body body: Partial<{ name: string; email: string }>,
  ) {
    const idx = this.users.findIndex(u => u.id === id)
    if (idx === -1) throw new Error('User not found')
    this.users[idx] = { ...this.users[idx], ...body }
    return this.users[idx]
  }

  @del('/:id')
  @response(200)
  async delete(@param('id') id: string) {
    const idx = this.users.findIndex(u => u.id === id)
    if (idx === -1) throw new Error('User not found')
    this.users.splice(idx, 1)
    return { success: true }
  }
}
`;
  await fsPromises.writeFile(path.join(dir, "src", "apis", "users.ts"), content);
}

async function generateGitignore(dir: string): Promise<void> {
  const content = `# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Generated
generated/
`;
  await fsPromises.writeFile(path.join(dir, ".gitignore"), content);
}

async function generateEnvExample(
  dir: string,
  features: ProjectOptions["features"],
): Promise<void> {
  const lines = [
    "# Environment variables",
    "PORT=3000",
    "HOST=0.0.0.0",
    "NODE_ENV=development",
    "",
    "# CORS",
    'CORS_ORIGIN="*"',
    "",
  ];

  if (features.auth) {
    lines.push("# JWT Authentication", "JWT_SECRET=change-this-to-a-secure-secret", "");
  }

  if (features.rateLimiting) {
    lines.push("# Rate Limiting", "RATE_LIMIT_WINDOW_MS=60000", "RATE_LIMIT_MAX=100", "");
  }

  await fsPromises.writeFile(path.join(dir, ".env.example"), lines.join("\n") + "\n");
}

async function generateReadme(
  dir: string,
  name: string,
  adapter: (typeof ADAPTERS)[number],
  features: ProjectOptions["features"],
): Promise<void> {
  const featureList: string[] = [];
  featureList.push(`- **Adapter:** ${adapter.title}`);
  if (features.websocket) featureList.push("- **WebSocket:** Real-time communication via @ws");
  if (features.fileUpload) featureList.push("- **File Upload:** Multipart handling via @upload");
  if (features.auth) featureList.push("- **Authentication:** JWT-based auth guard");
  if (features.rateLimiting) featureList.push("- **Rate Limiting:** Per-route throttling via @throttle");

  const content = `# ${name}

A REST API built with [APICraft](https://github.com/apicraft/apicraft) — the Code-First API Framework for TypeScript.

## Features

${featureList.join("\n")}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Generate client SDK, OpenAPI spec, and docs
npm run generate
\`\`\`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /users | List users (paginated) |
| GET | /users/:id | Get user by ID |
| POST | /users | Create a new user |
| PUT | /users/:id | Update user |
| DELETE | /users/:id | Delete user |

## Project Structure

\`\`\`
${name}/
├── src/
│   ├── apis/
│   │   └── users.ts        # User API controller
│   ├── generated/           # Auto-generated artifacts
│   └── index.ts             # Application entry point
├── .env.example             # Environment template
├── .gitignore
├── apicraft.config.ts       # APICraft configuration
├── package.json
├── tsconfig.json
└── README.md
\`\`\`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| HOST | 0.0.0.0 | Server host |
| NODE_ENV | development | Environment |
${features.auth ? "| JWT_SECRET | - | JWT signing secret |\n" : ""}

## Documentation

- [APICraft Documentation](https://github.com/apicraft/apicraft)
- [OpenAPI Spec](http://localhost:3000/openapi.json)
- [Interactive Docs](http://localhost:3000/docs)

## License

MIT
`;
  await fsPromises.writeFile(path.join(dir, "README.md"), content);
}

// ─── Entry point ───

main().catch((error) => {
  console.error(chalk.red("\n✖ Failed to create project:"), error instanceof Error ? error.message : String(error));
  process.exit(1);
});
