import path from 'node:path'
import fs from 'node:fs/promises'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import { DefinitionRegistry } from '@apicraft/core'
import type { APIDefinition } from '@apicraft/core'
import { OpenAPIGenerator } from '@apicraft/generator-openapi'
import { ClientSDKGenerator } from '@apicraft/generator-client'
import { ReactQueryGenerator } from '@apicraft/generator-react'
import { ZodSchemaGenerator } from '@apicraft/generator-zod'
import { DocUIGenerator } from '@apicraft/generator-docs'

interface FileResult {
  path: string
  content: string
}

interface GeneratorWrapper {
  name: string
  enabled: boolean
  outputFileName: string
  run(): Promise<FileResult>
}

export async function generateCommand(options: {
  openapi?: boolean
  client?: boolean
  react?: boolean
  zod?: boolean
  docs?: boolean
  all?: boolean
  output?: string
  watch?: boolean
  config?: string
}) {
  try {
    const cwd = process.cwd()
    const configPath = options.config || path.resolve(cwd, 'apicraft.config.ts')
    const outputDir = path.resolve(cwd, options.output || './generated')

    const registry = DefinitionRegistry.getInstance()
    const config = await loadConfig(configPath)

    let definitions: APIDefinition[] = []
    if (config.apis && config.apis.length > 0) {
      const spinner = ora('Scanning API definitions...').start()
      definitions = registry.scan(config.apis)
      spinner.succeed(chalk.green(`Found ${definitions.length} API definitions`))
    } else {
      console.log(chalk.yellow('No API classes configured. Run `apicraft init` first or add APIs to your config.'))
      return
    }

    await fs.mkdir(outputDir, { recursive: true })

    const shouldGenerate = options.all ? true : undefined

    const generators: GeneratorWrapper[] = [
      {
        name: 'OpenAPI spec',
        enabled: options.openapi || shouldGenerate || false,
        outputFileName: 'openapi.json',
        run: async () => {
          const openapiConfig = {
            title: (config.openapi?.title as string) || 'APICraft API',
            version: (config.openapi?.version as string) || '1.0.0',
            description: config.openapi?.description as string | undefined,
          }
          const gen = new OpenAPIGenerator(definitions, openapiConfig)
          const doc = gen.generate()
          return { path: 'openapi.json', content: JSON.stringify(doc, null, 2) }
        },
      },
      {
        name: 'TypeScript client SDK',
        enabled: options.client || shouldGenerate || false,
        outputFileName: 'client.ts',
        run: async () => {
          const gen = new ClientSDKGenerator(definitions)
          return { path: 'client.ts', content: gen.generate() }
        },
      },
      {
        name: 'React Query hooks',
        enabled: options.react || shouldGenerate || false,
        outputFileName: 'hooks.ts',
        run: async () => {
          const gen = new ReactQueryGenerator(definitions)
          return { path: 'hooks.ts', content: gen.generate() }
        },
      },
      {
        name: 'Zod schemas',
        enabled: options.zod || shouldGenerate || false,
        outputFileName: 'schemas.ts',
        run: async () => {
          const gen = new ZodSchemaGenerator(definitions)
          return { path: 'schemas.ts', content: gen.generate() }
        },
      },
      {
        name: 'API docs UI',
        enabled: options.docs || shouldGenerate || false,
        outputFileName: 'docs.html',
        run: async () => {
          const openapiConfig = {
            title: (config.openapi?.title as string) || 'APICraft API',
            version: (config.openapi?.version as string) || '1.0.0',
          }
          const openapiGen = new OpenAPIGenerator(definitions, openapiConfig)
          const spec = openapiGen.generate()
          const gen = new DocUIGenerator(spec)
          return { path: 'docs.html', content: gen.generate() }
        },
      },
    ]

    const enabledGenerators = generators.filter((g) => g.enabled)
    if (enabledGenerators.length === 0) {
      console.log(chalk.yellow('No generators selected. Use flags like --openapi, --client, or --all.'))
      return
    }

    for (const gen of enabledGenerators) {
      const spinner = ora(`Generating ${gen.name}...`).start()
      try {
        const result = await gen.run()
        const filePath = path.join(outputDir, result.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, result.content, 'utf-8')
        spinner.succeed(chalk.green(`${gen.name} generated → ${result.path}`))
      } catch (error) {
        spinner.fail(chalk.red(`${gen.name} failed: ${error instanceof Error ? error.message : String(error)}`))
      }
    }

    if (options.watch) {
      console.log(chalk.cyan('\nWatching for changes... (Ctrl+C to stop)'))
      const watcher = chokidar.watch('src/**/*.ts', {
        cwd,
        ignoreInitial: true,
        persistent: true,
      })
      watcher.on('change', async (filePath: string) => {
        console.log(chalk.yellow(`\n📝 ${filePath} changed, regenerating...`))
        try {
          const newConfig = await loadConfig(configPath)
          const newDefinitions = registry.scan(newConfig.apis)
          for (const gen of enabledGenerators) {
            try {
              const result = await gen.run()
              const outputPath = path.join(outputDir, result.path)
              await fs.mkdir(path.dirname(outputPath), { recursive: true })
              await fs.writeFile(outputPath, result.content, 'utf-8')
              console.log(chalk.green(`  ✓ ${gen.name} regenerated → ${result.path}`))
            } catch (error) {
              console.error(chalk.red(`  ✗ ${gen.name} failed: ${error instanceof Error ? error.message : String(error)}`))
            }
          }
        } catch (error) {
          console.error(chalk.red(`  ✗ Reload failed: ${error instanceof Error ? error.message : String(error)}`))
        }
      })
      watcher.on('error', (error: unknown) => {
        console.error(chalk.red(`Watcher error: ${error instanceof Error ? error.message : String(error)}`))
      })
      process.on('SIGINT', () => {
        watcher.close()
        process.exit(0)
      })
    }
  } catch (error) {
    console.error(chalk.red('\nGeneration failed:'), error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function loadConfig(configPath: string): Promise<{ apis: Function[]; openapi?: Record<string, unknown>; [key: string]: unknown }> {
  try {
    const configModule = await import(path.resolve(configPath))
    const config = configModule.default || configModule
    return config
  } catch {
    return { apis: [] }
  }
}
