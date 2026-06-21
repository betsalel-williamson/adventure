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
    },
  },
  test: {
    environment: "node",
    include: ["apps/web/src/**/*.test.ts"],
  },
});
