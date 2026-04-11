import { elements } from "./dashboardElementRefs.js";
import { state } from "./dashboardState.js";
import {
  syncMermaidFullscreenIfOpen,
  updateMapScrollCorners,
} from "./dashboardWidgets.js";

/** @type {Record<string, string>} */
export const ROOM_KIND_LABELS = {
  road: "Road",
  building: "Building",
  forest: "Forest",
  valley: "Valley",
  cave: "Cave",
  maze: "Maze",
  grate: "Grate",
  hall: "Hall",
  water: "Water",
  other: "Other",
};

/**
 * Mermaid returns an error diagram (not a throw) when the source fails to parse.
 * @param {string} svgHtml
 */
export function isMermaidParseErrorSvg(svgHtml) {
  return (
    typeof svgHtml === "string" &&
    (svgHtml.includes('aria-roledescription="error"') ||
      svgHtml.includes("Syntax error in text"))
  );
}

/**
 * @param {string} src
 * @param {HTMLElement | null} container
 */
export async function renderMermaidInto(src, container) {
  if (!container || typeof src !== "string" || src.trim() === "") {
    if (container) container.textContent = "";
    return;
  }
  const gen = ++state.mapMermaidRenderGeneration;
  try {
    const mod =
      await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
    const mer = mod.default;
    mer.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "dark",
    });
    const id = "mermap_" + Date.now().toString(36);
    const { svg } = await mer.render(id, src);
    if (gen !== state.mapMermaidRenderGeneration) return;
    container.innerHTML = "";
    if (isMermaidParseErrorSvg(svg)) {
      container.textContent =
        "(Could not render diagram in-browser. Copy from the Mermaid source section below or open the source.)";
      return;
    }
    container.insertAdjacentHTML("beforeend", svg);
  } catch {
    if (gen !== state.mapMermaidRenderGeneration) return;
    container.textContent =
      "(Could not render diagram in-browser. Copy from the Mermaid source section below or open the source.)";
  }
}

/**
 * @param {object} snapshot
 */
export function applyFsmPanel(snapshot) {
  const el = elements;
  if (!el) return;
  const mm = typeof snapshot.mapMermaid === "string" ? snapshot.mapMermaid : "";
  const dot = typeof snapshot.mapDot === "string" ? snapshot.mapDot : "";
  if (el.mapMermaidSrcEl) el.mapMermaidSrcEl.textContent = mm;
  if (el.mapDotSrcEl) el.mapDotSrcEl.textContent = dot;
  const nulls = snapshot.nullCommandKeysAtCurrentNode;
  if (el.mapNullKeysEl) {
    if (Array.isArray(nulls) && nulls.length > 0) {
      el.mapNullKeysEl.textContent =
        "NULL / exclude at current node (no fp+inv change): " +
        nulls.join(" · ");
    } else {
      el.mapNullKeysEl.textContent = "";
    }
  }
  void renderMermaidInto(mm, el.mapMermaidEl).finally(() => {
    updateMapScrollCorners();
    syncMermaidFullscreenIfOpen();
  });
}

/**
 * @param {object} mapSnap
 * @param {number} sliceZ
 */
export function renderMapSlice(mapSnap, sliceZ) {
  const el = elements;
  if (!el?.mapCoordsEl) return;
  const cur = mapSnap.current;
  el.mapCoordsEl.textContent = `(${cur.x}, ${cur.y}, ${cur.z})`;

  const cells = (mapSnap.cells || []).filter((c) => c.z === sliceZ);
  if (cells.length === 0 && cur.z !== sliceZ) {
    if (el.mapGridEl) el.mapGridEl.replaceChildren();
    if (el.mapGridEl)
      el.mapGridEl.appendChild(
        document.createTextNode(
          `(no cells at z=${sliceZ}; player at z=${cur.z})`,
        ),
      );
    if (el.mapRoomKindEl) el.mapRoomKindEl.textContent = "";
    if (el.mapLegendEl) el.mapLegendEl.replaceChildren();
    updateMapScrollCorners();
    return;
  }
  let minX = cur.x;
  let maxX = cur.x;
  let minY = cur.y;
  let maxY = cur.y;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  if (cur.z === sliceZ) {
    minX = Math.min(minX, cur.x);
    maxX = Math.max(maxX, cur.x);
    minY = Math.min(minY, cur.y);
    maxY = Math.max(maxY, cur.y);
  }
  const pad = 1;
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const byXY = new Map();
  for (const c of cells) {
    byXY.set(`${c.x},${c.y}`, c);
  }

  const here = byXY.get(`${cur.x},${cur.y}`);
  if (el.mapRoomKindEl) {
    if (cur.z === sliceZ && here && here.roomKind) {
      const kind = ROOM_KIND_LABELS[here.roomKind] || here.roomKind;
      const lab = (here.label || "").slice(0, 160);
      el.mapRoomKindEl.textContent = `${kind} — ${lab}${(here.label || "").length > 160 ? "…" : ""}`;
    } else if (cur.z === sliceZ) {
      el.mapRoomKindEl.textContent =
        "Current position: room type unknown (move to refresh fingerprint).";
    } else {
      el.mapRoomKindEl.textContent = "";
    }
  }

  const cols = maxX - minX + 1;
  const kindsForLegend = new Set();
  if (el.mapGridEl) {
    el.mapGridEl.replaceChildren();
    el.mapGridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(1.15rem, 1fr))`;
    for (let y = maxY; y >= minY; y--) {
      for (let x = minX; x <= maxX; x++) {
        const cell = byXY.get(`${x},${y}`);
        const isPlayer = cur.z === sliceZ && x === cur.x && y === cur.y;
        const span = document.createElement("span");
        span.className = "map-cell";
        if (isPlayer) {
          span.classList.add("map-cell--player");
          if (cell && cell.roomKind) {
            span.classList.add(`map-cell--kind-${cell.roomKind}`);
            kindsForLegend.add(cell.roomKind);
          }
          span.textContent = "@";
          span.title = cell
            ? `${ROOM_KIND_LABELS[cell.roomKind] || cell.roomKind} (${x},${y},${sliceZ})\n${cell.label || ""}`
            : `You (${x},${y},${sliceZ})`;
        } else if (cell) {
          const rk = cell.roomKind || "other";
          span.classList.add("map-cell--visited", `map-cell--kind-${rk}`);
          span.textContent = "·";
          span.title = `${ROOM_KIND_LABELS[rk] || rk} (${x},${y},${sliceZ})\n${cell.label || ""}`;
          kindsForLegend.add(rk);
        } else {
          span.classList.add("map-cell--unmapped");
          span.textContent = "·";
          span.title = `Not mapped (${x},${y},${sliceZ})`;
        }
        el.mapGridEl.appendChild(span);
      }
    }
  }

  if (el.mapLegendEl) {
    el.mapLegendEl.replaceChildren();
    const row = document.createElement("div");
    row.className = "map-legend-row";
    const intro = document.createElement("span");
    intro.className = "map-legend-intro muted";
    intro.textContent = "This layer · ";
    row.appendChild(intro);
    const sorted = [...kindsForLegend].sort((a, b) => a.localeCompare(b));
    for (const k of sorted) {
      const pair = document.createElement("span");
      pair.className = "map-legend-pair";
      const sw = document.createElement("span");
      sw.className = `map-legend-swatch map-cell--visited map-cell--kind-${k}`;
      sw.textContent = "·";
      sw.setAttribute("aria-hidden", "true");
      const lb = document.createElement("span");
      lb.className = "map-legend-text";
      lb.textContent = ROOM_KIND_LABELS[k] || k;
      pair.appendChild(sw);
      pair.appendChild(lb);
      row.appendChild(pair);
    }
    const padPair = document.createElement("span");
    padPair.className = "map-legend-pair";
    const swPad = document.createElement("span");
    swPad.className = "map-legend-swatch map-cell--unmapped";
    swPad.textContent = "·";
    const lbPad = document.createElement("span");
    lbPad.className = "map-legend-text muted";
    lbPad.textContent = "Padding";
    padPair.appendChild(swPad);
    padPair.appendChild(lbPad);
    row.appendChild(padPair);
    el.mapLegendEl.appendChild(row);
  }
  updateMapScrollCorners();
}

/**
 * @param {object} snapshot
 */
export function applySnapshot(snapshot) {
  const el = elements;
  if (!el) return;
  if (el.locationHintEl)
    el.locationHintEl.textContent = snapshot.locationHint || "—";
  if (el.inventoryEl) {
    el.inventoryEl.replaceChildren();
    const inv = snapshot.inventory || [];
    if (inv.length === 0) {
      const li = document.createElement("li");
      li.textContent = "(not detected)";
      li.className = "muted";
      el.inventoryEl.appendChild(li);
    } else {
      for (const item of inv) {
        const li = document.createElement("li");
        li.textContent = item;
        el.inventoryEl.appendChild(li);
      }
    }
  }
  if (el.stagnationEl) {
    el.stagnationEl.textContent = snapshot.stagnating
      ? "Location appears stagnant (heuristic)."
      : "";
  }
  if (el.tryNextEl) el.tryNextEl.textContent = snapshot.tryNextLine || "";

  if (!el.mapZInput) return;
  const z = Number(el.mapZInput.value);
  const sliceZ = Number.isFinite(z) ? z : snapshot.map.current.z;
  el.mapZInput.value = String(sliceZ);
  renderMapSlice(snapshot.map, sliceZ);
  applyFsmPanel(snapshot);
}
