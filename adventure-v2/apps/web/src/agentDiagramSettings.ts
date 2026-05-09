/**
 * Persist agent-structure Mermaid overrides in localStorage (dev shell only).
 * Does not change server-side cognition; use to compare alternate designs side-by-side.
 */

export const AGENT_DIAGRAM_STORAGE_KEY = "adventure-v2.shell.agentDiagrams.v1";

export type AgentDiagramStorage = {
  /** When true, ignore brain/control text and use bundled imports. */
  useBundled: boolean;
  brain?: string;
  control?: string;
};

export const loadAgentDiagramStorage = (): AgentDiagramStorage | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(AGENT_DIAGRAM_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.useBundled !== "boolean") {
      return null;
    }
    return {
      useBundled: rec.useBundled,
      ...(typeof rec.brain === "string" ? { brain: rec.brain } : {}),
      ...(typeof rec.control === "string" ? { control: rec.control } : {})
    };
  } catch {
    return null;
  }
};

export const saveAgentDiagramStorage = (value: AgentDiagramStorage): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(AGENT_DIAGRAM_STORAGE_KEY, JSON.stringify(value));
};

export const clearAgentDiagramStorage = (): void => {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(AGENT_DIAGRAM_STORAGE_KEY);
};

export const effectiveBrainMermaid = (bundled: string, stored: AgentDiagramStorage | null): string => {
  if (!stored || stored.useBundled) {
    return bundled;
  }
  const t = stored.brain?.trim();
  return t && t.length > 0 ? t : bundled;
};

export const effectiveControlMermaid = (bundled: string, stored: AgentDiagramStorage | null): string => {
  if (!stored || stored.useBundled) {
    return bundled;
  }
  const t = stored.control?.trim();
  return t && t.length > 0 ? t : bundled;
};
