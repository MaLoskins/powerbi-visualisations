/* ═══════════════════════════════════════════════
   Legend Renderer
   Categorical / series colour legend
   ═══════════════════════════════════════════════ */

"use strict";

import { RenderConfig } from "../types";
import { LEGEND_VERTICAL_WIDTH } from "../constants";
import { el, clearChildren } from "../utils/dom";
import { getCategoryColor } from "../utils/color";

/**
 * Render legend entries into the legend container.
 * Uses the colour assignments from the category colour map.
 */
export function renderLegend(
    container: HTMLElement,
    entries: string[],
    cfg: RenderConfig["legend"],
    colorCfg: RenderConfig["color"],
): void {
    clearChildren(container);

    if (!cfg.showLegend || entries.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.gap = "8px 16px";
    container.style.padding = "4px 8px";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";
    container.style.fontSize = `${cfg.legendFontSize}px`;
    container.style.color = cfg.legendFontColor;

    for (const entry of entries) {
        const item = el("div", "bscatter-legend-item");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = "4px";
        item.style.whiteSpace = "nowrap";

        const swatch = el("span", "bscatter-legend-swatch");
        swatch.style.display = "inline-block";
        swatch.style.width = "10px";
        swatch.style.height = "10px";
        swatch.style.borderRadius = "50%";
        swatch.style.flexShrink = "0";
        swatch.style.backgroundColor = colorCfg.colorByCategory
            ? getCategoryColor(entry)
            : colorCfg.defaultBubbleColor;

        const label = el("span", "bscatter-legend-label", entry);
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        label.style.whiteSpace = "nowrap";
        label.style.maxWidth = "120px";

        item.appendChild(swatch);
        item.appendChild(label);
        container.appendChild(item);
    }
}

/**
 * Compute the space (px) consumed by the legend for layout calculations.
 */
export function getLegendSize(
    cfg: RenderConfig["legend"],
    entryCount: number,
): number {
    if (!cfg.showLegend || entryCount === 0) return 0;
    // Rough estimate based on font size + padding
    const isVertical = cfg.legendPosition === "left" || cfg.legendPosition === "right";
    if (isVertical) return LEGEND_VERTICAL_WIDTH;
    return cfg.legendFontSize + 20;
}
