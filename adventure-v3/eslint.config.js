import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ["**/dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["apps/web/src/**/*.ts"],
    ignores: ["apps/web/src/**/*.test.ts"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["apps/web/src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["packages/map-core/src/**/*.ts"],
    ignores: ["packages/map-core/src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.es2021,
      },
    },
  },
  {
    files: ["packages/map-core/src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.vitest,
      },
    },
  },
  {
    files: ["packages/assist-server/src/**/*.ts"],
    ignores: ["packages/assist-server/src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["packages/assist-server/src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ["vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
