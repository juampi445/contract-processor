import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest needs the same `@/*` -> `src/*` alias that `tsconfig.json` gives the
 * Next build; without it any module importing through the alias fails to load.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
