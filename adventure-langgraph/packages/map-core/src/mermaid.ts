import type { DirectedMapGraph, PlaceId } from "./directedGraph.js";

/**
 * Stable Mermaid flowchart for inspection / copy — draft only.
 */
export const directedGraphToMermaidFlowchart = (
  g: DirectedMapGraph,
): string => {
  if (g.places.length === 0) {
    return 'flowchart LR\n  empty["(no places yet)"]\n';
  }

  const label = (id: PlaceId): string => JSON.stringify(shortLabel(id, g));

  const shortLabel = (id: PlaceId, graph: DirectedMapGraph): string => {
    const p = graph.places.find((x) => x.id === id);
    const raw = p?.evidence ?? id;
    const t = raw.replace(/"/g, '\\"');
    return t.length > 48 ? `${t.slice(0, 47)}…` : t;
  };

  const lines: string[] = [
    "flowchart LR",
    "  classDef currentPlace fill:#153d22,stroke:#5fd38a,stroke-width:2px,color:#d8f0e0",
  ];

  for (const p of g.places) {
    lines.push(`  ${p.id}${label(p.id)}`);
  }

  for (const e of g.committedEdges) {
    const dir = edgeLabel(e.move);
    lines.push(`  ${e.fromId} -->|"${dir}"| ${e.toId}`);
  }

  if (g.currentPlaceId !== null) {
    lines.push(`  class ${g.currentPlaceId} currentPlace`);
  }

  return lines.join("\n");
};

const edgeLabel = (move: string): string => move.toUpperCase();
