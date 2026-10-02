import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // Next.js keeps tsconfig `jsx: "preserve"`; tell esbuild how to compile the
  // .tsx modules that page-level tests import.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'services/*/src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
})
