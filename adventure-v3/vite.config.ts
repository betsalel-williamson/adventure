import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "apps/web",
  resolve: {
    alias: {
      "@contracts": path.resolve(
        rootDir,
        "../adventure-v2/packages/contracts/src/index.ts",
      ),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
});
