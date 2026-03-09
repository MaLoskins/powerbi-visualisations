/*
 *  Marimekko Chart – Power BI Custom Visual
 *  render/legend.ts — Colour legend for segment categories
 */
"use strict";

import { RenderConfig } from "../types";
import { LEGEND_SWATCH_SIZE, LEGEND_ITEM_GAP, FONT_FAMILY } from "../constants";
import { el, clearChildren } from "../utils/dom";

/* ═══════════════════════════════════════════════
   Legend Rendering
   ═══════════════════════════════════════════════ */

/** Render the legend into the provided container div */
export function renderLegend(
    container: HTMLDivElement,
    segmentCategories: readonly string[],
    colorMap: Map<string, string>,
    cfg: RenderConfig["legend"],
): void {
    clearChildren(container);

    if (!cfg.showLegend || segmentCategories.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    container.style.alignItems = "center";
    container.style.gap = LEGEND_ITEM_GAP + "px";
    container.style.padding = "4px 8px";
    container.style.fontFamily = FONT_FAMILY;
    container.style.fontSize = cfg.legendFontSize + "px";
    container.style.color = cfg.legendFontColor;
    container.style.overflowY = "auto";
    container.style.overflowX = "hidden";

    if (cfg.legendPosition === "right") {
        container.style.flexDirection = "column";
        container.style.flexWrap = "nowrap";
        container.style.alignItems = "flex-start";
        container.style.gap = "6px";
    } else {
        container.style.flexDirection = "row";
        container.style.justifyContent = "center";
    }

    for (const cat of segmentCategories) {
        const item = el("div", "marimekko-legend-item");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = "4px";
        item.style.whiteSpace = "nowrap";

        const swatch = el("span", "marimekko-legend-swatch");
        swatch.style.display = "inline-block";
        swatch.style.width = LEGEND_SWATCH_SIZE + "px";
        swatch.style.height = LEGEND_SWATCH_SIZE + "px";
        swatch.style.borderRadius = "2px";
        swatch.style.backgroundColor = colorMap.get(cat) ?? "#94A3B8";
        swatch.style.flexShrink = "0";

        const label = el("span", "marimekko-legend-label", cat);
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        label.style.whiteSpace = "nowrap";
        if (cfg.legendPosition === "right") {
            label.style.maxWidth = "100px";
        } else {
            label.style.maxWidth = "120px";
        }
        label.title = cat; /* Full text on hover */

        item.appendChild(swatch);
        item.appendChild(label);
        container.appendChild(item);
    }
}
