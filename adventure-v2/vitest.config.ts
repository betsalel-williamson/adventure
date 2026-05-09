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
    include: ["tests/**/*.test.ts"]
  }
});
