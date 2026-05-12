import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@contracts": path.resolve(
        rootDir,
        "../adventure-v2/packages/contracts/src/index.ts",
      ),
      "@adventure-v3/map-core": path.resolve(
        rootDir,
        "packages/map-core/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "apps/web/src/**/*.test.ts",
      "packages/map-core/src/**/*.test.ts",
      "packages/assist-server/src/**/*.test.ts",
    ],
  },
});
