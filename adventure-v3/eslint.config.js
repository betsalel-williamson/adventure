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
    files: ["vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
