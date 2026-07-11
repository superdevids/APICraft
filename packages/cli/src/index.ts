#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init.js'
import { generateCommand } from './commands/generate.js'
import { serveCommand } from './commands/serve.js'
import { buildCommand } from './commands/build.js'

const program = new Command()

program
  .name('apicraft')
  .description('APICraft — Code-First API Framework')
  .version('0.1.0')

program
  .command('init [project-name]')
  .description('Scaffold a new APICraft project')
  .option('-t, --template <template>', 'Project template (default: rest-api)')
  .option('--adapter <adapter>', 'HTTP adapter (express, fastify, hono)')
  .option('--pkg-manager <manager>', 'Package manager (npm, pnpm, yarn)')
  .action(initCommand)

program
  .command('generate')
  .description('Generate API artifacts')
  .option('-o, --openapi', 'Generate OpenAPI spec')
  .option('-c, --client', 'Generate TypeScript client SDK')
  .option('-r, --react', 'Generate React Query hooks')
  .option('-z, --zod', 'Generate Zod schemas')
  .option('-d, --docs', 'Generate API documentation UI')
  .option('--all', 'Generate all artifacts')
  .option('--output <dir>', 'Output directory (default: ./generated)')
  .option('--watch', 'Watch mode: regenerate on file changes')
  .action(generateCommand)

program
  .command('serve')
  .description('Start the development server')
  .option('-p, --port <port>', 'Port number (default: 3000)')
  .option('-h, --host <host>', 'Host address (default: localhost)')
  .option('--hot', 'Enable hot reload')
  .option('--config <path>', 'Config file path')
  .action(serveCommand)

program
  .command('build')
  .description('Build for production')
  .option('-o, --out-dir <dir>', 'Output directory (default: ./dist)')
  .option('--clean', 'Clean output directory before build')
  .option('--sourcemap', 'Generate source maps')
  .option('--minify', 'Minify output')
  .action(buildCommand)

program.parse(process.argv)
