import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Mirror tsconfig's "@/*" -> "./src/*" so modules that use the alias
  // (e.g. the lobby service) resolve under Vitest just as they do in Next.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
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
