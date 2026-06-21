import {
  createEmptyGraph,
  directedGraphToMermaidFlowchart,
  mergeGraphFromTranscript,
  parseDirectedMapGraph,
  type DirectedMapGraph,
} from "@adventure-langgraph/map-core";
import { postAssistIngest } from "../api/assistClient.js";
import { v3FeatureFlags } from "../featureFlags.js";
import { renderDraftMermaidMap } from "./draftMapMermaidRender.js";

export type ExplorationMapElements = {
  readonly mermaidVisual: HTMLElement | null;
  readonly mermaidPre: HTMLElement | null;
  readonly status: HTMLElement | null;
};

let graphState: DirectedMapGraph = createEmptyGraph();

/** Last `runId` passed to [`refreshExplorationMapFromTranscript`]; used to clear graph on session change. */
let previousRunId: string | null = null;

export const resetExplorationMapState = (): void => {
  graphState = createEmptyGraph();
  previousRunId = null;
};

const setExplorationMapStatus = (
  el: HTMLElement | null,
  text: string,
): void => {
  if (el) {
    el.textContent = text;
  }
};

const renderExplorationMap = async (
  els: ExplorationMapElements,
  graph: DirectedMapGraph,
): Promise<void> => {
  const mermaid = directedGraphToMermaidFlowchart(graph);
  if (els.mermaidPre) {
    els.mermaidPre.textContent = mermaid;
  }
  await renderDraftMermaidMap(els.mermaidVisual, mermaid);
};

const lastTranscriptLine = (transcript: string): string => {
  const lines = transcript.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.length > 0 ? (lines.at(-1) ?? "") : "";
};

const priorTranscriptLines = (
  transcript: string,
  maxLines: number,
): readonly string[] => {
  const lines = transcript.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length <= 1) {
    return [];
  }
  return lines.slice(
    Math.max(0, lines.length - maxLines - 1),
    lines.length - 1,
  );
};

export const refreshExplorationMapFromTranscript = async (args: {
  readonly runId: string | null;
  readonly transcript: string;
  readonly els: ExplorationMapElements;
}): Promise<void> => {
  if (!v3FeatureFlags.explorationMap) {
    return;
  }

  const { runId, transcript, els } = args;
  const trimmed = transcript.trim();
  if (trimmed === "") {
    return;
  }

  if (runId !== previousRunId) {
    graphState = createEmptyGraph();
    previousRunId = runId;
  }

  let localMergeStatus = "Draft map updated (local merge).";

  if (v3FeatureFlags.locationAgent && runId !== null) {
    const ingest = await postAssistIngest({
      runId,
      transcript: trimmed,
      line: lastTranscriptLine(trimmed),
      context: {
        priorLines: priorTranscriptLines(trimmed, 8),
        currentPlaceId: graphState.currentPlaceId,
      },
    });
    if (ingest.ok) {
      const parsed = parseDirectedMapGraph(ingest.mapJson);
      if (parsed !== null) {
        graphState = parsed;
        await renderExplorationMap(els, graphState);
        setExplorationMapStatus(els.status, "Draft map updated.");
        return;
      }
      localMergeStatus = "Assist map response unreadable — using local merge.";
    }
    if (!ingest.ok) {
      setExplorationMapStatus(
        els.status,
        ingest.error ?? "Assist unavailable — using local merge.",
      );
    }
  }

  graphState = mergeGraphFromTranscript(graphState, trimmed);
  await renderExplorationMap(els, graphState);
  setExplorationMapStatus(els.status, localMergeStatus);
};
