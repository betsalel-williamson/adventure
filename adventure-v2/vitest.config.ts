import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: {
      "@contracts": path.resolve(rootDir, "packages/contracts/src/index.ts")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    /** HTTP + SSE tests use 5s read windows; allow headroom for slow CI. */
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "tests/**",
        "**/*.test.ts",
        "apps/web/**",
        "fixtures/**",
        "coverage/**",
        "**/vite.config.ts",
        "**/vitest.config.ts"
      ]
    }
  }
});
