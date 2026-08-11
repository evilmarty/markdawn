import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/App.jsx',
        'src/lib/frontmatter.js',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
})
