import path from "node:path";

/**
 * Paths aligned with `eslint.config.js` `ignores`. Lint-staged must not pass
 * these to eslint — explicit paths to ignored files trigger ESLint's
 * "File ignored because of a matching ignore pattern" warnings under
 * `--max-warnings=0`.
 */
function isEslintIgnoredPath(file) {
  const parts = path.normalize(file).split(path.sep);
  if (parts.includes("node_modules")) return true;
  if (parts.includes("dist")) return true;
  if (parts.includes("reports")) return true;
  if (parts.includes(".cache")) return true;
  const pub = parts.indexOf("public");
  if (pub !== -1 && parts[pub + 1] === "generated") return true;
  return false;
}

const shellArgList = (filenames) =>
  filenames.map((f) => JSON.stringify(f)).join(" ");

export default {
  "*.{ts,mts,cts,js,mjs,cjs}": (filenames) => {
    const files = filenames.filter((f) => !isEslintIgnoredPath(f));
    if (files.length === 0) {
      return [];
    }
    const args = shellArgList(files);
    return [
      `eslint --fix --max-warnings=0 ${args}`,
      `prettier --write ${args}`,
    ];
  },
  "*.{json,md,yml,yaml}": "prettier --write",
};
