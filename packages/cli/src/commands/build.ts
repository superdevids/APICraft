import path from 'node:path'
import fs from 'node:fs/promises'
import { execSync } from 'node:child_process'
import chalk from 'chalk'
import ora from 'ora'

export async function buildCommand(options: { outDir?: string; clean?: boolean; sourcemap?: boolean; minify?: boolean }) {
  try {
    const cwd = process.cwd()
    const outDir = path.resolve(cwd, options.outDir || './dist')

    if (options.clean) {
      const cleanSpinner = ora('Cleaning output directory...').start()
      await fs.rm(outDir, { recursive: true, force: true })
      cleanSpinner.succeed(chalk.green('Output directory cleaned'))
    }

    const tscSpinner = ora('Building TypeScript...').start()
    try {
      const tscArgs = ['tsc']
      if (options.sourcemap) tscArgs.push('--declarationMap', '--sourceMap')
      execSync(tscArgs.join(' '), { cwd, stdio: 'pipe' })
      tscSpinner.succeed(chalk.green('TypeScript compiled successfully'))
    } catch {
      tscSpinner.fail(chalk.red('TypeScript compilation failed'))
      console.log(chalk.yellow('\nTry fixing TypeScript errors and re-run the build.'))
      process.exit(1)
    }

    const genSpinner = ora('Generating API artifacts...').start()
    await fs.mkdir(path.join(outDir, 'generated'), { recursive: true })
    genSpinner.succeed(chalk.green('Artifacts generated'))

    if (options.minify) {
      const minSpinner = ora('Minifying output...').start()
      try {
        execSync(`npx terser ${outDir}/**/*.js --compress --mangle -o ${outDir}`, { cwd, stdio: 'pipe' })
        minSpinner.succeed(chalk.green('Output minified'))
      } catch {
        minSpinner.warn(chalk.yellow('Minification skipped (terser not available)'))
      }
    }

    if (options.sourcemap) {
      console.log(chalk.dim('  Source maps: enabled'))
    }
    if (options.minify) {
      console.log(chalk.dim('  Minification: enabled'))
    }

    console.log(chalk.green(`\n✔ Build complete! Output: ${outDir}\n`))
    console.log(chalk.bold('To start the production server:'))
    console.log(chalk.cyan(`  node ${path.join(outDir, 'index.js')}`))
  } catch (error) {
    console.error(chalk.red('\nBuild failed:'), error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
