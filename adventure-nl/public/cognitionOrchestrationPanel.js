/**
 * Read-only cognition / autoplay orchestration panel (ADR0013).
 * @param {{ subscribe: (fn: (snapshot: unknown) => void) => { unsubscribe: () => void } }} actor
 * @param {{
 *   stateEl: HTMLElement | null;
 *   eventsEl: HTMLElement | null;
 *   contextEl: HTMLElement | null;
 *   childEl: HTMLElement | null;
 * }} el
 * @returns {() => void}
 */
export function subscribeCognitionOrchestrationPanel(actor, el) {
  if (!el.stateEl) return () => {};
  const sub = actor.subscribe((snapshot) => {
    const v = snapshot.value;
    el.stateEl.textContent =
      typeof v === "string" ? v : JSON.stringify(v, null, 0);

    const evs = snapshot.context.recentEvents ?? [];
    if (el.eventsEl) {
      el.eventsEl.replaceChildren();
      for (const row of evs.slice(-12).reverse()) {
        const li = document.createElement("li");
        li.className = "mono small cognition-orchestration-event";
        const line = `${row.type} ${row.summary}`.slice(0, 220);
        li.textContent = line;
        el.eventsEl.appendChild(li);
      }
    }

    if (el.contextEl) {
      const c = snapshot.context;
      const parts = [
        `move=${c.moveNumber}`,
        c.lastError ? `err=${String(c.lastError).slice(0, 120)}` : "",
        c.pendingPrompt ? `phase=${c.pendingPrompt.phase}` : "",
      ].filter(Boolean);
      el.contextEl.textContent = parts.join(" · ") || "—";
    }

    if (el.childEl) {
      const ch = snapshot.children;
      if (ch && typeof ch === "object" && Object.keys(ch).length > 0) {
        el.childEl.textContent = Object.keys(ch).join(", ");
      } else {
        el.childEl.textContent = "—";
      }
    }
  });
  return () => sub.unsubscribe();
}

/**
 * @param {Document} doc
 */
export function resolveCognitionOrchestrationElements(doc) {
  return {
    stateEl: doc.getElementById("cognition-orchestration-state"),
    eventsEl: doc.getElementById("cognition-orchestration-events"),
    contextEl: doc.getElementById("cognition-orchestration-context"),
    childEl: doc.getElementById("cognition-orchestration-child"),
  };
}
