import { elements } from "./dashboardElementRefs.js";

/**
 * @param {HTMLElement | null} btn
 * @param {HTMLElement | null} sourceEl
 */
export function wireCopyPromptButton(btn, sourceEl) {
  if (!btn || !sourceEl) return;
  const iconEl = btn.querySelector(".dashboard-material-icon");
  const defaultGlyph = iconEl?.textContent?.trim() ?? "";
  const defaultText = iconEl ? null : btn.textContent?.trim() || "Copy";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text =
      sourceEl instanceof HTMLTextAreaElement || "value" in sourceEl
        ? String(/** @type {{ value?: string }} */ (sourceEl).value ?? "")
        : (sourceEl.textContent ?? "");
    void navigator.clipboard.writeText(text).then(
      () => {
        if (iconEl && defaultGlyph) {
          iconEl.textContent = "check";
        } else {
          btn.textContent = "Copied";
        }
        setTimeout(() => {
          if (iconEl && defaultGlyph) {
            iconEl.textContent = defaultGlyph;
          } else {
            btn.textContent = defaultText ?? "Copy";
          }
        }, 1200);
      },
      () => {
        if (iconEl && defaultGlyph) {
          iconEl.textContent = "error";
        } else {
          btn.textContent = "Failed";
        }
        setTimeout(() => {
          if (iconEl && defaultGlyph) {
            iconEl.textContent = defaultGlyph;
          } else {
            btn.textContent = defaultText ?? "Copy";
          }
        }, 1200);
      },
    );
  });
}

/**
 * @param {HTMLElement | null} el
 * @param {string} endClass
 */
export function updateScrollEndClass(el, endClass) {
  if (!el) return;
  const { scrollTop, scrollHeight, clientHeight } = el;
  const eps = 3;
  const atBottom = scrollTop + clientHeight >= scrollHeight - eps;
  const noOverflow = scrollHeight <= clientHeight + eps;
  el.classList.toggle(endClass, atBottom || noOverflow);
}

export function updateMapScrollCorners() {
  const el = elements;
  if (!el) return;
  updateScrollEndClass(el.mapViewportEl, "map-viewport--scroll-end");
  updateScrollEndClass(el.mapMermaidEl, "map-mermaid--scroll-end");
}

/** Call after `bindDashboardElements` to attach scroll/resize observers. */
export function wireMapScrollAndResize() {
  const el = elements;
  if (!el) return;
  if (el.mapViewportEl) {
    el.mapViewportEl.addEventListener("scroll", updateMapScrollCorners, {
      passive: true,
    });
  }
  if (el.mapMermaidEl) {
    el.mapMermaidEl.addEventListener("scroll", updateMapScrollCorners, {
      passive: true,
    });
  }
  globalThis.window.addEventListener("resize", updateMapScrollCorners, {
    passive: true,
  });
  const mapScrollResizeRo = new ResizeObserver(() => {
    requestAnimationFrame(updateMapScrollCorners);
  });
  if (el.mapViewportEl) mapScrollResizeRo.observe(el.mapViewportEl);
  if (el.mapMermaidEl) mapScrollResizeRo.observe(el.mapMermaidEl);
  updateMapScrollCorners();
}

export function wireDashboardHelpDialogs() {
  const doc = globalThis.document;
  const dialog = doc.getElementById("dashboard-help-dialog");
  const titleEl = doc.getElementById("dashboard-help-dialog-title");
  const bodyEl = doc.getElementById("dashboard-help-dialog-body");
  const closeBtn = doc.querySelector(".dashboard-help-dialog-close");
  if (!dialog || !titleEl || !bodyEl) return;

  doc.querySelectorAll("[data-help-template]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const tid = btn.getAttribute("data-help-template");
      const tTitle = btn.getAttribute("data-help-title") || "Help";
      const tpl = tid ? doc.getElementById(tid) : null;
      if (!tpl || tpl.tagName !== "TEMPLATE") return;
      titleEl.textContent = tTitle;
      bodyEl.replaceChildren();
      bodyEl.appendChild(tpl.content.cloneNode(true));
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      }
    });
  });

  closeBtn?.addEventListener("click", () => {
    dialog.close();
  });
}

export function fillMermaidFullscreenFromSource() {
  const el = elements;
  if (!el?.mermaidFullscreenBody || !el.mapMermaidEl) return;
  el.mermaidFullscreenBody.replaceChildren();
  const svg = el.mapMermaidEl.querySelector("svg");
  if (svg) {
    el.mermaidFullscreenBody.appendChild(svg.cloneNode(true));
    return;
  }
  const text = (el.mapMermaidEl.textContent || "").trim();
  const p = document.createElement("p");
  p.className = "mermaid-fullscreen-fallback";
  p.textContent = text || "(No diagram yet.)";
  el.mermaidFullscreenBody.appendChild(p);
}

export function syncMermaidFullscreenIfOpen() {
  const el = elements;
  if (!el) return;
  if (el.mermaidFullscreenDialog && el.mermaidFullscreenDialog.open) {
    fillMermaidFullscreenFromSource();
  }
}

export function wireMermaidFullscreenDialog() {
  const el = elements;
  if (!el?.mermaidFullscreenDialog || !el.mermaidFullscreenBody) return;
  el.mermaidFullscreenOpenBtn?.addEventListener("click", () => {
    fillMermaidFullscreenFromSource();
    if (typeof el.mermaidFullscreenDialog.showModal === "function") {
      el.mermaidFullscreenDialog.showModal();
    }
  });
  el.mermaidFullscreenCloseBtn?.addEventListener("click", () => {
    el.mermaidFullscreenDialog.close();
  });
  el.mermaidFullscreenDialog.addEventListener("click", (e) => {
    if (e.target === el.mermaidFullscreenDialog) {
      el.mermaidFullscreenDialog.close();
    }
  });
}

export function wireCopyPromptButtonsFromElements() {
  const el = elements;
  if (!el) return;
  wireCopyPromptButton(el.copyPromptLastSystemBtn, el.promptLastSystemEl);
  wireCopyPromptButton(el.copyPromptLastUserBtn, el.promptLastUserEl);
  wireCopyPromptButton(el.copyPromptLastMergedBtn, el.promptLastMergedEl);
  wireCopyPromptButton(el.copyMermaidBtn, el.mapMermaidSrcEl);
  wireCopyPromptButton(el.copyDotBtn, el.mapDotSrcEl);
}
