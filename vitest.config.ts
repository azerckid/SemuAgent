import { fileURLToPath } from 'node:url'
import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'vitest/config'

loadEnvConfig(process.cwd())

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // In Next.js RSC builds `server-only` resolves to an empty module via the
      // `react-server` export condition. vitest runs in a plain node env with no
      // such condition, so its default entry throws. Alias to an empty stub to
      // keep the production import guard (lib/env.ts) from breaking tests.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
  },
})
