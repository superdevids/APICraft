import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import chalk from 'chalk'
import ora from 'ora'
import prompts from 'prompts'

export async function initCommand(name: string | undefined, options: { template?: string; adapter?: string; pkgManager?: string }) {
  try {
    const projectName = name || await promptForProjectName()
    if (!isValidProjectName(projectName)) {
      console.error(chalk.red(`Invalid project name "${projectName}". Must be a valid npm package name.`))
      process.exit(1)
    }

    const projectPath = path.resolve(process.cwd(), projectName)

    try {
      await fsPromises.stat(projectPath)
      console.error(chalk.red(`Directory "${projectName}" already exists.`))
      process.exit(1)
    } catch {
      // Directory doesn't exist — good to proceed
    }

    const adapter = options.adapter || 'express'
    const pkgManager = options.pkgManager || detectPkgManager()

    const spinner = ora('Creating project structure...').start()

    await fsPromises.mkdir(projectPath, { recursive: true })
    await fsPromises.mkdir(path.join(projectPath, 'src', 'apis'), { recursive: true })

    await generatePackageJson(projectPath, projectName)
    await generateTsconfig(projectPath)
    await generateConfig(projectPath, adapter)
    await generateSrcIndex(projectPath)
    await generateUsersAPI(projectPath)
    await generateGitignore(projectPath)
    await generateReadme(projectPath, projectName)

    spinner.succeed(chalk.green('Project structure created!'))

    const installSpinner = ora('Installing dependencies...').start()
    try {
      execSync(`${pkgManager} install`, { cwd: projectPath, stdio: 'pipe', timeout: 120000 })
      installSpinner.succeed(chalk.green('Dependencies installed!'))
    } catch {
      installSpinner.warn(chalk.yellow(`Dependency installation failed. Run \`${pkgManager} install\` manually.`))
    }

    console.log(`
${chalk.green('✔')} APICraft project "${chalk.bold(projectName)}" created!

${chalk.bold('Next steps:')}
  ${chalk.cyan(`cd ${projectName}`)}
  ${chalk.cyan(`${pkgManager} run dev`)}

${chalk.bold('Your API:')} http://localhost:3000
${chalk.bold('API Docs:')} http://localhost:3000/docs
`)
  } catch (error) {
    console.error(chalk.red('\nFailed to create project:'), error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function promptForProjectName(): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'projectName',
    message: 'What is the name of your project?',
    initial: 'my-api',
    validate: (value: string) => isValidProjectName(value) ? true : 'Must be a valid npm package name (lowercase, no spaces)',
  })
  return response.projectName
}

function isValidProjectName(name: string): boolean {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
}

function detectPkgManager(): string {
  const cwd = process.cwd()
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) return 'npm'
  const npmUserAgent = process.env.npm_config_user_agent || ''
  if (npmUserAgent.includes('pnpm')) return 'pnpm'
  if (npmUserAgent.includes('yarn')) return 'yarn'
  return 'npm'
}

async function generatePackageJson(dir: string, name: string): Promise<void> {
  const content = {
    name,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
    },
    dependencies: {
      apicraft: 'latest',
    },
    devDependencies: {
      typescript: '^5.6.0',
      tsx: '^4.19.0',
      '@types/node': '^20.14.0',
    },
  }
  await fsPromises.writeFile(path.join(dir, 'package.json'), JSON.stringify(content, null, 2) + '\n')
}

async function generateTsconfig(dir: string): Promise<void> {
  const content = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
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
    include: ['src'],
  }
  await fsPromises.writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify(content, null, 2) + '\n')
}

async function generateConfig(dir: string, adapter: string): Promise<void> {
  const content = `import { defineConfig } from 'apicraft'

export default defineConfig({
  apis: [],
  adapter: '${adapter}',
  openapi: {
    title: 'My API',
    version: '1.0.0',
  },
})
`
  await fsPromises.writeFile(path.join(dir, 'apicraft.config.ts'), content)
}

async function generateSrcIndex(dir: string): Promise<void> {
  const content = `import { APICraftApp } from 'apicraft'
import { UsersAPI } from './apis/users.js'

const app = APICraftApp.create({
  apis: [UsersAPI],
  adapter: 'express',
  openapi: {
    title: 'My API',
    version: '1.0.0',
  },
})

app.listen(3000).then(() => {
  console.log('Server running on http://localhost:3000')
  console.log('API Docs: http://localhost:3000/docs')
})
`
  await fsPromises.writeFile(path.join(dir, 'src', 'index.ts'), content)
}

async function generateUsersAPI(dir: string): Promise<void> {
  const content = `import { api, get, post, param, body, query, response } from 'apicraft'

@api('/users', { tags: ['Users'] })
export class UsersAPI {
  @get('/')
  async list(
    @query('page', { default: 1 }) page: number,
    @query('limit', { default: 10 }) limit: number,
  ) {
    return { data: [], total: 0, page, limit }
  }

  @get('/:id')
  async get(@param('id') id: string) {
    return { id, name: 'Sample User', email: 'user@example.com' }
  }

  @post('/')
  @response(201)
  async create(@body body: { name: string; email: string }) {
    return { id: 'new-id', ...body }
  }
}
`
  await fsPromises.writeFile(path.join(dir, 'src', 'apis', 'users.ts'), content)
}

async function generateGitignore(dir: string): Promise<void> {
  const content = `node_modules
dist
.env
*.tsbuildinfo
`
  await fsPromises.writeFile(path.join(dir, '.gitignore'), content)
}

async function generateReadme(dir: string, name: string): Promise<void> {
  const content = `# ${name}

API built with [APICraft](https://apicraft.dev) — Code-First API Framework.

## Getting started

\`\`\`bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## API Endpoints

- \`GET /users\` — List users
- \`GET /users/:id\` — Get user by ID
- \`POST /users\` — Create user

## Project structure

\`\`\`
${name}/
├── src/
│   ├── apis/       # API controllers
│   │   └── users.ts
│   └── index.ts    # Entry point
├── apicraft.config.ts
├── package.json
└── tsconfig.json
\`\`\`
`
  await fsPromises.writeFile(path.join(dir, 'README.md'), content)
}
