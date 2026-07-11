---
name: Bug report
about: Create a report to help us improve APICraft
title: ''
labels: bug
assignees: ''

---

## Describe the Bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Define API with '...'
2. Start server with '...'
3. Send request to '....'
4. See error

## Expected Behavior

A clear and concise description of what you expected to happen.

## Actual Behavior

What actually happened, including any error messages, stack traces, or unexpected output.

## Code Example

```typescript
// Minimal code example that reproduces the issue
import { api, get, APICraftApp } from '@apicraft/core'
import { ExpressAdapter } from '@apicraft/adapter-express'

@api('/test')
class TestAPI {
  @get('/')
  async hello() {
    return { message: 'Hello' }
  }
}

const app = APICraftApp.create({
  apis: [TestAPI],
  adapter: 'express',
})
app.listen(3000)
```

## Environment

- **APICraft version:** [e.g., 0.1.0]
- **Adapter:** [e.g., express, fastify, hono, koa, next, nest]
- **Node.js version:** [e.g., 18.20.0]
- **Package manager:** [e.g., pnpm 8.15.0, npm 10.0.0]
- **Operating system:** [e.g., macOS 14.0, Windows 11, Ubuntu 22.04]
- **TypeScript version:** [e.g., 5.5.0]

## Additional Context

Add any other context about the problem here, such as:
- Related issues or PRs
- Workarounds you've tried
- Screenshots or logs

## Possible Solution

If you have suggestions on how to fix the bug, please describe them here.
