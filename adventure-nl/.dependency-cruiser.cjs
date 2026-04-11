/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-adventure-nl-app-tree-from-nl-glue",
      comment:
        "ADR0014: @adventure-nl/nl-glue must not import the main app tree (src/, scripts/). " +
        "Dat- and fixture-heavy tests live under adventure-nl/src/test/nl-glue/ instead.",
      severity: "error",
      from: {
        path: "^packages/nl-glue/src",
      },
      to: {
        path: "^(src|scripts)/",
      },
    },
    {
      name: "nl-glue-from-browser-bundle-only",
      comment:
        "ADR0005: browser code must not reach @adventure-nl/nl-glue except through " +
        "src/browser/cognitionBundle.ts (esbuild entry for generated browserAutoplayCognition.js).",
      severity: "error",
      from: {
        path: "^src/browser",
        pathNot: "^src/browser/cognitionBundle\\.ts$",
      },
      to: {
        path: "^packages/nl-glue",
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
