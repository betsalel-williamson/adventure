/**
 * Renders draft map Mermaid source to SVG in the DOM (v1-style), not raw text only.
 */

let visualRenderGeneration = 0;

let mermaidConfigured = false;

const isParseErrorSvg = (svg: string): boolean =>
  svg.includes('aria-roledescription="error"') ||
  svg.includes("Syntax error in text");

export const renderDraftMermaidMap = async (
  container: HTMLElement | null,
  source: string,
): Promise<void> => {
  if (!container) {
    return;
  }

  const gen = ++visualRenderGeneration;
  const trimmed = source.trim();

  if (trimmed === "") {
    container.replaceChildren();
    return;
  }

  try {
    const mod = await import("mermaid");
    const mermaid = mod.default;
    if (gen !== visualRenderGeneration) {
      return;
    }

    if (!mermaidConfigured) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "dark",
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
      });
      mermaidConfigured = true;
    }

    const id = `draft_mermap_${gen}_${Date.now().toString(36)}`;
    const { svg } = await mermaid.render(id, trimmed);
    if (gen !== visualRenderGeneration) {
      return;
    }

    if (isParseErrorSvg(svg)) {
      container.replaceChildren();
      container.textContent =
        "Mermaid could not parse this map. Open “Mermaid source” below to inspect.";
      return;
    }

    container.innerHTML = svg;
  } catch {
    if (gen !== visualRenderGeneration) {
      return;
    }
    container.replaceChildren();
    container.textContent =
      "Could not render the map diagram. Check “Mermaid source” below.";
  }
};
