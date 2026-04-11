import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "node",
          globals: false,
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.dom.test.ts"],
        },
      }),
      defineProject({
        test: {
          name: "lm-glue",
          globals: false,
          environment: "node",
          include: ["packages/lm-glue/src/**/*.test.ts"],
        },
      }),
      defineProject({
        test: {
          name: "dom",
          globals: false,
          environment: "happy-dom",
          include: ["src/**/*.dom.test.ts"],
        },
      }),
    ],
  },
});
