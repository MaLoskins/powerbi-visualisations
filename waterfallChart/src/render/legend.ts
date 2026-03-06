/* ═══════════════════════════════════════════════
   WaterfallChart - Legend Renderer
   Colour legend for Increase / Decrease / Total
   ═══════════════════════════════════════════════ */

"use strict";

import { RenderConfig, BarType, WaterfallBar } from "../types";
import { CSS_PREFIX, FONT_STACK, LEGEND_SWATCH_SIZE, LEGEND_ITEM_GAP, LEGEND_HEIGHT_MAX } from "../constants";
import { resolveBarColor } from "./chart";

interface LegendEntry {
    label: string;
    color: string;
}

/** Render the legend into an HTML container element. Returns total height consumed. */
export function renderLegend(
    container: HTMLElement,
    bars: WaterfallBar[],
    cfg: RenderConfig,
): number {
    container.innerHTML = "";

    if (!cfg.legend.showLegend) {
        container.style.display = "none";
        return 0;
    }

    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.gap = LEGEND_ITEM_GAP + "px";
    container.style.padding = "4px 8px";
    container.style.fontFamily = FONT_STACK;
    container.style.fontSize = cfg.legend.legendFontSize + "px";
    container.style.color = cfg.legend.legendFontColor;
    container.style.overflow = "hidden";
    container.style.maxHeight = LEGEND_HEIGHT_MAX + "px";
    container.style.boxSizing = "border-box";

    /* Build legend entries based on which bar types are present */
    const presentTypes = new Set<BarType>(bars.map((b) => b.barType));
    const entries: LegendEntry[] = [];

    if (presentTypes.has("start")) {
        entries.push({ label: "Start", color: resolveBarColor("start", cfg.colors) });
    }
    if (presentTypes.has("increase")) {
        entries.push({ label: "Increase", color: resolveBarColor("increase", cfg.colors) });
    }
    if (presentTypes.has("decrease")) {
        entries.push({ label: "Decrease", color: resolveBarColor("decrease", cfg.colors) });
    }
    if (presentTypes.has("total")) {
        entries.push({ label: "Total", color: resolveBarColor("total", cfg.colors) });
    }

    for (const entry of entries) {
        const item = document.createElement("span");
        item.className = `${CSS_PREFIX}legend-item`;
        item.style.display = "inline-flex";
        item.style.alignItems = "center";
        item.style.gap = "4px";

        const swatch = document.createElement("span");
        swatch.className = `${CSS_PREFIX}legend-swatch`;
        swatch.style.display = "inline-block";
        swatch.style.width = LEGEND_SWATCH_SIZE + "px";
        swatch.style.height = LEGEND_SWATCH_SIZE + "px";
        swatch.style.borderRadius = "2px";
        swatch.style.backgroundColor = entry.color;
        swatch.style.flexShrink = "0";

        const label = document.createElement("span");
        label.textContent = entry.label;
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        label.style.whiteSpace = "nowrap";

        item.appendChild(swatch);
        item.appendChild(label);
        container.appendChild(item);
    }

    return container.offsetHeight || 28;
}
