import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'vitest/config'

loadEnvConfig(process.cwd())

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
  },
})
