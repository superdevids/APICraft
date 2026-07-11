# Contributing to APICraft

Thank you for your interest in contributing to APICraft! We welcome contributions of all forms — bug reports, feature requests, documentation improvements, and code changes.

---

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (`npm install -g pnpm`)
- **Git**

### Setting Up the Development Environment

```bash
# Clone the repository
git clone git@github.com:apicraft/apicraft.git
cd apicraft

# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Repository Layout

```
packages/
├── core/              # Runtime engine, decorators, metadata, validation
├── cli/               # Command-line interface
├── adapters/          # Framework adapters (express, fastify, hono, koa, next, nest)
├── generators/        # Code generators (openapi, client, react, zod, docs)
└── middleware/        # Middleware packages (cors, logger, auth, rate-limiter, compression, helmet)
```

Each package is independently versioned and published under the `@apicraft/` scope.

---

## Development Workflow

### Branch Strategy

We follow a simplified GitHub Flow:

- **`main`** — Stable branch. Always releasable.
- **`feat/<feature-name>`** — Feature branches. Created from `main`, merged back via PR.
- **`fix/<issue-name>`** — Bug fix branches.
- **`docs/<description>`** — Documentation-only changes.

```bash
# Create a feature branch
git checkout -b feat/my-feature main

# Make changes and commit
git add .
git commit -m "feat(core): add support for custom serializers"

# Push and open a pull request
git push origin feat/my-feature
```

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type     | Description |
|----------|-------------|
| `feat`   | A new feature |
| `fix`    | A bug fix |
| `docs`   | Documentation changes |
| `style`  | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `perf`   | Performance improvements |
| `test`   | Adding or updating tests |
| `chore`  | Build process, dependencies, etc. |
| `ci`     | CI/CD changes |

**Scopes:**

| Scope      | Package |
|------------|---------|
| `core`     | `@apicraft/core` |
| `cli`      | `@apicraft/cli` |
| `adapter:*` | `@apicraft/adapter-*` |
| `gen:*`    | `@apicraft/generator-*` |
| `mw:*`     | `@apicraft/middleware-*` |

**Examples:**

```
feat(core): add @patch decorator for HTTP PATCH support
fix(adapter:express): handle empty body in POST requests
docs(readme): add WebSocket example
refactor(cli): extract generate logic from serve command
test(core): add unit tests for DefinitionRegistry.scan
```

### Development Commands

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @apicraft/core build

# Run tests for all packages
pnpm test

# Run tests for a specific package
pnpm --filter @apicraft/core test

# Watch mode for development
pnpm dev

# Lint all packages
pnpm lint

# Format all files
pnpm format
```

---

## Pull Request Process

### Step-by-Step Guide

1. **Find or create an issue** — Before starting work, check if there's an existing issue or create one to track your contribution.

2. **Discuss your approach** — For significant changes, leave a comment on the issue describing your planned approach. This saves time and ensures alignment.

3. **Fork and branch** — Fork the repository and create a feature branch from `main`.

4. **Make changes** — Implement your changes following the coding standards below.

5. **Write tests** — Add tests that cover your changes. See [Testing Requirements](#testing-requirements).

6. **Run the full test suite** — Ensure all tests pass:

   ```bash
   pnpm test
   pnpm lint
   ```

7. **Commit your changes** — Use conventional commit format:

   ```bash
   git add .
   git commit -m "feat(core): add support for custom response serializers"
   ```

8. **Push your branch** — Push to your fork and open a pull request against `main`.

9. **Complete the PR template** — Fill out the pull request template with all required information.

10. **Address review feedback** — Respond to reviewer comments and make requested changes.

### PR Requirements

- All tests must pass
- Linting must pass with no errors
- TypeScript compilation must produce no errors
- New features must include tests
- Bug fixes must include a test that reproduces the bug
- Documentation must be updated for new features or API changes
- The PR must be focused on a single concern

### Review Process

1. A maintainer will review your PR within 1–3 business days
2. You may receive requests for changes or clarifications
3. Once approved, a maintainer will merge your PR

---

## Coding Standards

### TypeScript Style

- **Strict mode** enabled in all packages
- **No `any`** — Use `unknown` and type guards instead
- **Explicit return types** on all public methods
- **JSDoc comments** for all public APIs
- **ES modules** — Use `import`/`export` syntax, not `require`
- **Decorators** use `experimentalDecorators: true` (legacy decorators via `reflect-metadata`). While TC39 Stage 3 decorators are the future, we currently use the legacy decorator proposal for maximum compatibility with `reflect-metadata`

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | PascalCase | `APICraftApp`, `DefinitionRegistry` |
| Interfaces | PascalCase | `RequestContext`, `APIDefinition` |
| Types | PascalCase | `HTTPMethod`, `TypeSchema` |
| Functions | camelCase | `defineConfig`, `buildZodSchema` |
| Variables | camelCase | `apiPrefix`, `routeHandler` |
| Constants | UPPER_CASE | `API_KEY`, `ROUTE_KEY` |
| Files | kebab-case | `schema-builder.ts`, `rate-limiter.ts` |
| Packages | @scope/kebab-case | `@apicraft/adapter-express` |

### File Organization

- One class or interface per file (except small related types)
- Files are organized by feature, not by type
- Barrel files (`index.ts`) re-export public API

### Linting and Formatting

We use [Biome](https://biomejs.dev/) for both linting and code formatting (replacing ESLint + Prettier):

```bash
# Check for linting issues
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Format all files
pnpm format
```

Run linting before committing. Biome provides fast, unified linting and formatting with sensible defaults.

---

## Testing Requirements

### Test Framework

We use **Vitest** for all testing. Tests live next to source files in `__tests__/` directories or with `.test.ts` extension.

### Test Types

| Test Type | Location | Description |
|-----------|----------|-------------|
| Unit tests | `packages/*/src/**/*.test.ts` | Test individual functions and classes |
| Integration tests | `tests/` | Test cross-package interactions |
| E2E tests | `tests/e2e/` | Full HTTP request/response tests |

### What to Test

- **All public APIs** must have unit tests
- **Edge cases** — Empty inputs, invalid data, boundary values
- **Error paths** — Every error condition should be tested
- **Middleware** — Before, after, and error handlers
- **Generators** — Output format and content correctness
- **Adapters** — Request/response cycle for each framework

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { ValidationEngine } from './validation-engine'

describe('ValidationEngine', () => {
  describe('coerceType', () => {
    it('should coerce string to number', () => {
      expect(ValidationEngine.coerceType('42', 'number')).toBe(42)
    })

    it('should throw on invalid number coercion', () => {
      expect(() => ValidationEngine.coerceType('abc', 'number')).toThrow()
    })

    it('should handle boolean coercion', () => {
      expect(ValidationEngine.coerceType('true', 'boolean')).toBe(true)
      expect(ValidationEngine.coerceType('false', 'boolean')).toBe(false)
    })
  })
})
```

### Test Coverage

We aim for **80%+ code coverage**. Pull requests that add new code should maintain or improve coverage.

```bash
# Run tests with coverage
pnpm test:coverage
```

---

## Documentation

### When to Update Docs

- **New features** — Add JSDoc to new public APIs, update relevant README sections
- **API changes** — Update all references to changed APIs across documentation
- **Bug fixes** — Add note to CHANGELOG.md under the `### Fixed` section

### Documentation Locations

| Location | Purpose |
|----------|---------|
| `README.md` | Project overview, quick start, features |
| `ARCHITECTURE.md` | Deep architecture, data flow, component design |
| `CONTRIBUTING.md` | Contribution guidelines (this file) |
| `CHANGELOG.md` | Version history and release notes |
| `SECURITY.md` | Security policy and vulnerability reporting |
| `packages/*/README.md` | Package-specific documentation |

### Writing Style

- Use **American English** spelling
- Use **active voice** where possible
- Include **code examples** for all APIs
- Use **fenced code blocks** with language tags
- Keep lines under **100 characters** in markdown files

---

## Package Development Guidelines

### Creating a New Package

1. Create the directory structure:

```
packages/<category>/<name>/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

2. Set up `package.json`:

```json
{
  "name": "@apicraft/<name>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@apicraft/core": "workspace:*"
  }
}
```

3. Add `tsconfig.json` that extends the root config
4. Add path alias to root `tsconfig.json`
5. Add the package to workspace root list if not auto-detected
6. Implement and export your package's public API

### Package Dependencies

- **Core** — All packages can depend on `@apicraft/core`
- **Generators** — Can depend on other generators for composition
- **Adapters** — May have framework-specific peer dependencies
- **CLI** — Depends on generators for `generate` command
- **No circular dependencies** — Package graph must be a DAG

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** — Breaking API changes
- **MINOR** — New features, backward compatible
- **PATCH** — Bug fixes, backward compatible

---

## Release Process

### For Maintainers

1. Ensure `main` branch is green (all tests passing)
2. Create a release branch: `git checkout -b release/v0.1.0`
3. Update version numbers across packages (use `pnpm changeset` or manual)
4. Update `CHANGELOG.md` with the new version
5. Create a pull request from the release branch
6. After approval and merge, tag the release:

```bash
git checkout main
git pull
git tag v0.1.0
git push origin v0.1.0
```

7. Publish packages:

```bash
pnpm publish -r
```

---

## Questions?

If you have questions about contributing, please:

- Open a [GitHub Discussion](https://github.com/apicraft/apicraft/discussions)
- Ask in the issue or PR you're working on
- Reach out to maintainers via GitHub

We're here to help and appreciate your contributions!
