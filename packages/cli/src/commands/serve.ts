import path from 'node:path'
import chalk from 'chalk'
import ora from 'ora'
import chokidar from 'chokidar'
import type { APICraftConfig } from '@apicraft/core'

export async function serveCommand(options: { port?: string; host?: string; hot?: boolean; config?: string }) {
  try {
    const cwd = process.cwd()
    const configPath = options.config || path.resolve(cwd, 'apicraft.config.ts')
    const port = parseInt(options.port || '3000', 10)
    const host = options.host || 'localhost'

    const spinner = ora('Loading configuration...').start()
    const config = await loadServeConfig(configPath)
    spinner.succeed(chalk.green('Configuration loaded'))

    const { APICraftApp } = await import('@apicraft/core')
    let app = APICraftApp.create(config as unknown as APICraftConfig)

    const startSpinner = ora(`Starting server on ${host}:${port}...`).start()
    await app.listen(port)
    startSpinner.succeed(chalk.green(`Server running on http://${host}:${port}`))

    console.log(chalk.blue(`📖 API Docs: http://${host}:${port}/docs`))

    if (options.hot) {
      console.log(chalk.cyan('\nHot reload enabled. Watching for changes...\n'))
      const watcher = chokidar.watch('src/**/*.ts', {
        cwd,
        ignoreInitial: true,
        persistent: true,
      })
      watcher.on('change', async (filePath: string) => {
        console.log(chalk.yellow(`\n🔄 ${filePath} changed, restarting...`))
        try {
          await app.close()
          const newConfig = await loadServeConfig(configPath)
          const { APICraftApp: NewApp } = await import('@apicraft/core')
          app = NewApp.create(newConfig as unknown as APICraftConfig)
          await app.listen(port)
          console.log(chalk.green(`  ✓ Server restarted on http://${host}:${port}`))
        } catch (error) {
          console.error(chalk.red(`  ✗ Failed to restart: ${error instanceof Error ? error.message : String(error)}`))
        }
      })
      watcher.on('error', (error: unknown) => {
        console.error(chalk.red(`Watcher error: ${error instanceof Error ? error.message : String(error)}`))
      })
    }

    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\nShutting down gracefully...'))
      await app.close()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n\nShutting down gracefully...'))
      await app.close()
      process.exit(0)
    })
  } catch (error) {
    console.error(chalk.red('\nFailed to start server:'), error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

async function loadServeConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    const configModule = await import(path.resolve(configPath))
    return configModule.default || configModule
  } catch {
    return { apis: [], adapter: 'express' }
  }
}
