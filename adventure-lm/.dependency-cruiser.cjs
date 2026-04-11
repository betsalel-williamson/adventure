/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-adventure-lm-app-tree-from-lm-glue",
      comment:
        "ADR0014: @adventure-lm/lm-glue must not import the main app tree (src/, scripts/). " +
        "Dat- and fixture-heavy tests live under adventure-lm/src/test/lm-glue/ instead.",
      severity: "error",
      from: {
        path: "^packages/lm-glue/src",
      },
      to: {
        path: "^(src|scripts)/",
      },
    },
    {
      name: "lm-glue-from-browser-bundle-only",
      comment:
        "ADR0005: browser code must not reach @adventure-lm/lm-glue except through " +
        "src/browser/cognitionBundle.ts (esbuild entry for generated browserAutoplayCognition.js).",
      severity: "error",
      from: {
        path: "^src/browser",
        pathNot: "^src/browser/cognitionBundle\\.ts$",
      },
      to: {
        path: "^packages/lm-glue",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: [
        "npm",
        "npm-dev",
        "npm-optional",
        "npm-peer",
        "npm-bundled",
      ],
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
