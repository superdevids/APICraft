import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
    },
    server: {
      deps: {
        inline: ['reflect-metadata', 'zod'],
      },
    },
  },
  optimizeDeps: {
    include: ['reflect-metadata', 'zod'],
  },
  ssr: {
    noExternal: ['reflect-metadata', 'zod', '@apicraft/core', '@apicraft/adapter-express', '@apicraft/middleware-auth'],
  },
})
