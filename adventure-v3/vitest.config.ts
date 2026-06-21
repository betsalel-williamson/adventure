import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const resolveAliases = {
  "@contracts": path.resolve(
    rootDir,
    "../adventure-v2/packages/contracts/src/index.ts",
  ),
  "@adventure-v3/map-core": path.resolve(
    rootDir,
    "packages/map-core/src/index.ts",
  ),
};

export default defineConfig({
  resolve: {
    alias: resolveAliases,
  },
  test: {
    projects: [
      {
        resolve: { alias: resolveAliases },
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/map-core/src/**/*.test.ts",
            "packages/assist-server/src/**/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias: resolveAliases },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.ts", "apps/web/tests/**/*.test.ts"],
        },
      },
    ],
  },
});
