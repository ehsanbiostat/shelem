import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sources only. `npm run build` emits compiled copies of every test into dist/,
    // and without this vitest collects those too — running each suite twice and, worse,
    // reporting a green run from a stale build after the source has changed.
    include: ['src/**/*.test.ts'],
  },
});
