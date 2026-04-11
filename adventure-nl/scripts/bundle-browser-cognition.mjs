#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
const outDir = path.join(root, "public", "generated");
const shimDir = path.join(root, "src", "browser", "shims");
await mkdir(outDir, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/browser/cognitionBundle.ts"],
  bundle: true,
  outfile: "public/generated/browserAutoplayCognition.js",
  format: "esm",
  platform: "browser",
  sourcemap: true,
  logLevel: "warning",
  banner: {
    js: `if (typeof process === "undefined") { var process = { env: {} }; }\n`,
  },
  plugins: [
    {
      name: "browser-nl-shims",
      setup(build) {
        build.onResolve({ filter: /interpretEvalFixtures\.js$/ }, () => ({
          path: path.join(shimDir, "interpretEvalFixtures.browser.ts"),
        }));
        build.onResolve({ filter: /vocabAiCategories\.js$/ }, () => ({
          path: path.join(shimDir, "vocabAiCategories.browser.ts"),
        }));
      },
    },
  ],
});
