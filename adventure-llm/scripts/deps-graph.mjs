#!/usr/bin/env node
/**
 * Writes dependency-cruiser artifacts under reports/depcruise/:
 * - nl-glue.html + nl-glue.dot — @adventure-llm/nl-glue only (with Phase A validation rules)
 * - app-glue-slice.html — nl-glue + selected backend dirs (no custom rules; broader graph)
 */
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
const outDir = path.join(root, "reports", "depcruise");

await mkdir(outDir, { recursive: true });

function depcruise(args) {
  execFileSync("npx", ["depcruise", ...args], {
    cwd: root,
    stdio: "inherit",
  });
}

depcruise([
  "--config",
  ".dependency-cruiser.cjs",
  "--validate",
  "--output-type",
  "html",
  "--output-to",
  "reports/depcruise/nl-glue.html",
  "packages/nl-glue/src",
]);

depcruise([
  "--config",
  ".dependency-cruiser.cjs",
  "--validate",
  "--output-type",
  "dot",
  "--output-to",
  "reports/depcruise/nl-glue.dot",
  "packages/nl-glue/src",
]);

depcruise([
  "--no-config",
  "--output-type",
  "html",
  "--output-to",
  "reports/depcruise/app-glue-slice.html",
  "packages/nl-glue/src",
  "src/nl",
  "src/cli",
  "src/cognition",
  "src/browser",
  "src/test/nl-glue",
]);

console.log(
  "deps-graph: wrote reports/depcruise/nl-glue.html, nl-glue.dot, app-glue-slice.html",
);
