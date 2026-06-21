import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const resolveIndexHtmlPath = (): string => {
  const meta = import.meta.url;
  if (typeof meta === "string" && meta.startsWith("file:")) {
    return join(dirname(fileURLToPath(meta)), "..", "..", "index.html");
  }
  return join(process.cwd(), "apps", "web", "index.html");
};

/**
 * Injects the real shell `<body>` inner markup from `index.html` into the jsdom document.
 * Scripts in the file do not execute (innerHTML assignment). Use for DOM contract / wiring tests.
 */
export const loadShellIndexBodyIntoDocument = (): void => {
  const html = readFileSync(resolveIndexHtmlPath(), "utf8");
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!match?.[1]) {
    throw new Error(
      "index.html: could not extract <body> content for test harness",
    );
  }
  document.body.innerHTML = match[1].trim();
};
