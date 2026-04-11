/**
 * Mermaid / Graphviz text from {@link InferredExplorationMapSnapshot} (session FSM, capped for UI).
 */
import type { InferredExplorationMapSnapshot } from "./inferredExplorationMap.js";
/**
 * Short uppercase place line for Mermaid node text only (no takeable / inventory hints).
 * Strips leading YOU ARE / YOU'RE boilerplate from the session fingerprint label.
 */
export declare function shortMermaidPlaceLabelForSnapshot(snap: InferredExplorationMapSnapshot, graphNodeId: string): string;
/** Room label plus optional visible object count for graph nodes. */
export declare function graphNodeCaptionForSnapshot(snap: InferredExplorationMapSnapshot, graphNodeId: string): string;
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
/**
 * Nodes reachable within `maxHops` undirected steps from the current cell (BFS over directed edges).
 */
export declare function collectNeighborhoodNodeIds(snap: InferredExplorationMapSnapshot, maxHops: number, maxNodes: number): Set<string>;
/**
 * Small Graphviz DOT around the current cell (optional tools / tests): a few hops out, capped edges.
 * Same conventions as {@link inferredMapToDot}: dark filled node + **YOU ARE HERE** label line = current;
 * dashed gray = reject; dotted blue = non-move actions (TAKE, LOOK, …).
 */
export declare function inferredMapToLocalDot(snap: InferredExplorationMapSnapshot, options?: ExplorationVizOptions): string;
/**
 * Mermaid flowchart TD with directed edges, self-loops, and current node highlight.
 */
export declare function inferredMapToMermaid(snap: InferredExplorationMapSnapshot, options?: ExplorationVizOptions): string;
/**
 * Graphviz DOT directed graph (same edge cap as Mermaid).
 */
export declare function inferredMapToDot(snap: InferredExplorationMapSnapshot, options?: ExplorationVizOptions): string;
//# sourceMappingURL=explorationGraphViz.d.ts.map