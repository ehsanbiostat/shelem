import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Rooms boot a real server and drive real clients over a socket, so these are
    // slower than the pure-function suites and run one file at a time.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
