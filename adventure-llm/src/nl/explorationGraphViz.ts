/**
 * Mermaid / Graphviz text from {@link InferredExplorationMapSnapshot} (session FSM, capped for UI).
 */

import type {
  DirectedEdgeKind,
  InferredExplorationMapSnapshot,
  InferredRoomKind,
} from "./inferredExplorationMap.js";

const MERMAID_SAFE = /[^a-zA-Z0-9_]/g;

/** Longest first so we peel compound phrases before shorter prefixes. */
const MERMAID_LOCATION_PREFIX_STRIPS: readonly string[] = [
  "YOU ARE STANDING AT THE ",
  "YOU'RE STANDING AT THE ",
  "YOU ARE STANDING AT ",
  "YOU'RE STANDING AT ",
  "YOU ARE INSIDE THE ",
  "YOU'RE INSIDE THE ",
  "YOU ARE INSIDE A ",
  "YOU'RE INSIDE A ",
  "YOU ARE INSIDE ",
  "YOU'RE INSIDE ",
  "YOU ARE IN THE ",
  "YOU'RE IN THE ",
  "YOU ARE IN A ",
  "YOU'RE IN A ",
  "YOU ARE IN ",
  "YOU'RE IN ",
  "YOU ARE AT THE ",
  "YOU'RE AT THE ",
  "YOU ARE AT ",
  "YOU'RE AT ",
  "YOU ARE ON THE ",
  "YOU'RE ON THE ",
  "YOU ARE ON A ",
  "YOU'RE ON A ",
  "YOU ARE ON ",
  "YOU'RE ON ",
  "YOU ARE ",
  "YOU'RE ",
];

const MERMAID_PLACE_LABEL_MAX = 48;

const MERMAID_FALLBACK_BY_ROOM_KIND: Record<InferredRoomKind, string> = {
  road: "ROAD",
  building: "BUILDING",
  forest: "FOREST",
  valley: "VALLEY",
  cave: "CAVE",
  maze: "MAZE",
  grate: "GRATE",
  hall: "HALL",
  water: "WATER",
  other: "PLACE",
};

/**
 * Short uppercase place line for Mermaid node text only (no takeable / inventory hints).
 * Strips leading YOU ARE / YOU'RE boilerplate from the session fingerprint label.
 */
export function shortMermaidPlaceLabelForSnapshot(
  snap: InferredExplorationMapSnapshot,
  graphNodeId: string,
): string {
  const cell = snap.cells.find((c) => c.graphNodeId === graphNodeId);
  const raw =
    cell?.label ||
    cell?.fingerprint ||
    (graphNodeId === snap.currentGraphNodeId
      ? (snap.lastFingerprint ?? "")
      : "");
  let u = raw.replace(/\s+/g, " ").trim().toUpperCase();
  if (u.endsWith(".")) u = u.slice(0, -1).trimEnd();

  let prev = "";
  while (u !== prev) {
    prev = u;
    for (const p of MERMAID_LOCATION_PREFIX_STRIPS) {
      if (u.startsWith(p)) {
        u = u.slice(p.length).trimStart();
        break;
      }
    }
  }

  if (u.length === 0) {
    const kind = cell?.roomKind;
    if (kind !== undefined) return MERMAID_FALLBACK_BY_ROOM_KIND[kind];
    return graphNodeId;
  }

  return u.slice(0, MERMAID_PLACE_LABEL_MAX);
}

/** Room label plus optional visible object count for graph nodes. */
export function graphNodeCaptionForSnapshot(
  snap: InferredExplorationMapSnapshot,
  graphNodeId: string,
): string {
  const cell = snap.cells.find((c) => c.graphNodeId === graphNodeId);
  const base =
    cell?.label ||
    cell?.fingerprint.slice(0, 40) ||
    (graphNodeId === snap.currentGraphNodeId
      ? (snap.lastFingerprint?.slice(0, 40) ?? graphNodeId)
      : graphNodeId);
  const takeable = cell?.takeableObjectWords;
  if (takeable !== null && takeable !== undefined && takeable.length > 0) {
    const list = takeable.join(", ");
    return `${base} (takeable: ${list})`;
  }
  const ground = cell?.groundObjectWords;
  if (
    ground !== null &&
    ground !== undefined &&
    ground.length > 0 &&
    takeable !== null &&
    takeable !== undefined &&
    takeable.length === 0
  ) {
    return `${base} (nothing left to take)`;
  }
  return base;
}

function mermaidNodeId(raw: string): string {
  const s = raw.replace(MERMAID_SAFE, "_");
  return s.length > 0 ? s : "n_unknown";
}

const MERMAID_EDGE_LABEL_MAX = 32;

/**
 * Safe text for `A -->|here| B`: `|` delimits the label; `(`, `/`, etc. can confuse the
 * flowchart lexer. Truncate on a word boundary so we do not leave dangling punctuation.
 */
function mermaidFlowchartEdgeLabel(raw: string): string {
  const t = raw
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\|/g, "/")
    .replace(/#/g, " ")
    .replace(/[[\]()]/g, " ")
    .replace(/\//g, "·")
    .replace(/\s+/g, " ")
    .trim();
  const max = MERMAID_EDGE_LABEL_MAX;
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const base =
    lastSpace > 10 ? slice.slice(0, lastSpace).trimEnd() : slice.trimEnd();
  return `${base}…`;
}

export type ExplorationVizOptions = {
  /** Max edges to emit (newest retained when slicing). */
  readonly maxEdges?: number;
  /** Max distinct nodes declared (from edges + current). */
  readonly maxNodes?: number;
  /**
   * For {@link inferredMapToLocalDot} only: undirected BFS depth from the current cell
   * (default 2 = current + neighbors + neighbors-of-neighbors).
   */
  readonly maxHops?: number;
};

const DEFAULT_MAX_EDGES = 120;
const DEFAULT_MAX_NODES = 40;
const LOCAL_DEFAULT_MAX_EDGES = 36;
const LOCAL_DEFAULT_MAX_NODES = 18;
const LOCAL_DEFAULT_HOPS = 2;

/** Points per grid unit for Graphviz `pos` (neato); matches inferred map: East=+x, North=+y. */
const DOT_PTS_PER_GRID = 52;

/** Matches dashboard Mermaid `currentState`; high contrast on screen and in LLM-facing DOT. */
const DOT_CURRENT_FILL = "#3d3d5c";
const DOT_CURRENT_FONT = "#eeeeee";
const DOT_OTHER_FILL = "#ececf2";
const DOT_OTHER_FONT = "#1a1a1a";

function escDotString(s: string, maxLen: number): string {
  return s
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .slice(0, maxLen);
}

/**
 * Pinned `pos` strings for neato when every node id has a cell in the snapshot; otherwise null.
 */
function graphNodePinnedPositionsForDot(
  snap: InferredExplorationMapSnapshot,
  nodeIds: ReadonlySet<string>,
): Map<string, string> | null {
  const byId = new Map(snap.cells.map((c) => [c.graphNodeId, c] as const));
  const out = new Map<string, string>();
  for (const id of nodeIds) {
    const c = byId.get(id);
    if (!c) return null;
    const px = c.x * DOT_PTS_PER_GRID + c.z * DOT_PTS_PER_GRID * 0.18;
    const py = c.y * DOT_PTS_PER_GRID + c.z * DOT_PTS_PER_GRID * 0.12;
    out.set(id, `${px},${py}!`);
  }
  return out;
}

function collectNodeIdsFromEdges(
  snap: InferredExplorationMapSnapshot,
  edges: readonly { readonly from: string; readonly to: string }[],
): Set<string> {
  const ids = new Set<string>([snap.currentGraphNodeId]);
  for (const e of edges) {
    ids.add(e.from);
    ids.add(e.to);
  }
  return ids;
}

function emitDotDigraph(params: {
  readonly graphId: string;
  readonly snap: InferredExplorationMapSnapshot;
  readonly edges: readonly {
    readonly from: string;
    readonly to: string;
    readonly label: string;
    readonly kind: DirectedEdgeKind;
  }[];
}): string {
  const escShort = (s: string) => escDotString(s, 64);
  const curId = params.snap.currentGraphNodeId;

  const nodeIds = collectNodeIdsFromEdges(params.snap, params.edges);
  const positions = graphNodePinnedPositionsForDot(params.snap, nodeIds);

  const lines: string[] = [`digraph ${params.graphId} {`];
  lines.push(
    `  // YOU ARE HERE = node "${escDotString(curId, 80)}" (dark fill, thick border, two-line label).`,
  );

  if (positions !== null) {
    lines.push("  graph [layout=neato; overlap=scale; splines=true];");
    lines.push("  edge [dir=forward; arrowhead=vee];");
    lines.push(
      '  node [shape=box, fontname="Courier", pin=true, fixedsize=false];',
    );
  } else {
    lines.push('  rankdir="LR";');
    lines.push("  edge [dir=forward; arrowhead=vee];");
    lines.push('  node [shape=box, fontname="Courier"];');
  }

  for (const id of nodeIds) {
    const caption = graphNodeCaptionForSnapshot(params.snap, id);
    const isHere = id === curId;
    const labelBody = isHere ? `YOU ARE HERE\\n${caption}` : caption;
    const parts: string[] = [
      `label="${escDotString(labelBody, 220)}"`,
      "style=filled",
      isHere
        ? `fillcolor="${DOT_CURRENT_FILL}", fontcolor="${DOT_CURRENT_FONT}", penwidth=3, peripheries=2`
        : `fillcolor="${DOT_OTHER_FILL}", fontcolor="${DOT_OTHER_FONT}", penwidth=1`,
    ];
    const pos = positions?.get(id);
    if (pos !== undefined) parts.push(`pos="${pos}"`);
    lines.push(`  "${escDotString(id, 96)}" [${parts.join(", ")}];`);
  }

  for (const e of params.edges) {
    const attrs: string[] = [`label="${escShort(e.label)}"`];
    if (e.kind === "reject") {
      attrs.push("style=dashed", "color=gray");
    } else if (e.kind === "action") {
      attrs.push("style=dotted", 'color="#3366aa"', 'fontcolor="#1a3a66"');
    }
    lines.push(
      `  "${escDotString(e.from, 96)}" -> "${escDotString(e.to, 96)}" [${attrs.join(", ")}];`,
    );
  }
  lines.push("}");
  return lines.join("\n");
}

/**
 * Nodes reachable within `maxHops` undirected steps from the current cell (BFS over directed edges).
 */
export function collectNeighborhoodNodeIds(
  snap: InferredExplorationMapSnapshot,
  maxHops: number,
  maxNodes: number,
): Set<string> {
  const start = snap.currentGraphNodeId;
  const nodes = new Set<string>([start]);
  let frontier = new Set<string>([start]);

  for (let hop = 0; hop < maxHops && nodes.size < maxNodes; hop++) {
    const nextFrontier = new Set<string>();
    for (const n of frontier) {
      for (const e of snap.directedEdges) {
        if (nodes.size >= maxNodes) break;
        if (e.from === n && !nodes.has(e.to)) {
          nodes.add(e.to);
          nextFrontier.add(e.to);
        }
        if (nodes.size >= maxNodes) break;
        if (e.to === n && !nodes.has(e.from)) {
          nodes.add(e.from);
          nextFrontier.add(e.from);
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }
  return nodes;
}

/**
 * Small Graphviz DOT around the current cell (for planner prompts): a few hops out, capped edges.
 * Same conventions as {@link inferredMapToDot}: dark filled node + **YOU ARE HERE** label line = current;
 * dashed gray = reject; dotted blue = non-move actions (TAKE, LOOK, …).
 */
export function inferredMapToLocalDot(
  snap: InferredExplorationMapSnapshot,
  options?: ExplorationVizOptions,
): string {
  const maxHops = options?.maxHops ?? LOCAL_DEFAULT_HOPS;
  const maxN = options?.maxNodes ?? LOCAL_DEFAULT_MAX_NODES;
  const maxE = options?.maxEdges ?? LOCAL_DEFAULT_MAX_EDGES;
  const nodeSet = collectNeighborhoodNodeIds(snap, maxHops, maxN);
  let edgeList = snap.directedEdges.filter(
    (e) => nodeSet.has(e.from) && nodeSet.has(e.to),
  );
  if (edgeList.length > maxE) {
    edgeList = edgeList.slice(-maxE);
  }

  return emitDotDigraph({
    graphId: "planner_local_fsm",
    snap,
    edges: edgeList,
  });
}

function arrowForKind(kind: DirectedEdgeKind): string {
  if (kind === "reject" || kind === "action") return "-.->";
  return "-->";
}

/**
 * Mermaid flowchart LR with directed edges, self-loops, and current node highlight.
 */
export function inferredMapToMermaid(
  snap: InferredExplorationMapSnapshot,
  options?: ExplorationVizOptions,
): string {
  const maxE = options?.maxEdges ?? DEFAULT_MAX_EDGES;
  const maxN = options?.maxNodes ?? DEFAULT_MAX_NODES;
  const edges = snap.directedEdges;
  const slice = edges.length <= maxE ? edges : edges.slice(edges.length - maxE);

  const nodeLabels = new Map<string, string>();
  const cur = snap.currentGraphNodeId;
  nodeLabels.set(cur, shortMermaidPlaceLabelForSnapshot(snap, cur));
  for (const c of snap.cells) {
    if (c.graphNodeId === cur) continue;
    nodeLabels.set(
      c.graphNodeId,
      shortMermaidPlaceLabelForSnapshot(snap, c.graphNodeId),
    );
  }

  const declOrder: string[] = [];
  const seen = new Set<string>();
  const pushRaw = (raw: string): void => {
    if (seen.has(raw)) return;
    seen.add(raw);
    declOrder.push(raw);
  };
  pushRaw(cur);
  for (const e of slice) {
    pushRaw(e.from);
    pushRaw(e.to);
  }

  const lines: string[] = [
    "%% Session-learned FSM: arrows follow from→to (standard directed flow).",
    "%% Solid = travel; dotted = reject or non-move action (TAKE, LOOK, …) at that node.",
    "%% Inferred grid: East=+x, North=+y, Up=+z — Mermaid layout is automatic; use DOT export for compass-aligned positions.",
    "flowchart LR",
  ];

  for (const raw of declOrder.slice(0, maxN)) {
    const mid = mermaidNodeId(raw);
    const lab = (
      nodeLabels.get(raw) ?? shortMermaidPlaceLabelForSnapshot(snap, raw)
    )
      .replace(/"/g, "'")
      .replace(/[[\]\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48);
    lines.push(`  ${mid}["${lab}"]`);
  }

  for (const e of slice) {
    const a = mermaidNodeId(e.from);
    const b = mermaidNodeId(e.to);
    const arr = arrowForKind(e.kind);
    const lab = mermaidFlowchartEdgeLabel(e.label);
    if (lab.length === 0) {
      lines.push(`  ${a} ${arr} ${b}`);
    } else {
      lines.push(`  ${a} ${arr}|${lab}| ${b}`);
    }
  }

  lines.push("  classDef currentState fill:#3d3d5c,stroke:#888,color:#eee");
  lines.push(`  class ${mermaidNodeId(cur)} currentState`);

  return lines.join("\n");
}

/**
 * Graphviz DOT directed graph (same edge cap as Mermaid).
 */
export function inferredMapToDot(
  snap: InferredExplorationMapSnapshot,
  options?: ExplorationVizOptions,
): string {
  const maxE = options?.maxEdges ?? DEFAULT_MAX_EDGES;
  const edges = snap.directedEdges;
  const slice = edges.length <= maxE ? edges : edges.slice(edges.length - maxE);

  return emitDotDigraph({
    graphId: "exploration_fsm",
    snap,
    edges: slice,
  });
}
