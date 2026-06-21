import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@adventure-langgraph/map-core": path.resolve(
        rootDir,
        "../adventure-langgraph/packages/map-core/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["packages/ag2-bridge/src/**/*.test.ts"],
  },
});
