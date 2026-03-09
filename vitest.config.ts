import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use tests/ directory
    include: ["tests/**/*.test.ts"],
    // Long timeout for database tests
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially to avoid DB connection pool exhaustion
    fileParallelism: false,
  },
});
