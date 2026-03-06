/* ═══════════════════════════════════════════════
   Packed Bubble Chart – Legend Renderer
   ═══════════════════════════════════════════════ */

"use strict";

import { RenderConfig } from "../types";
import { CSS_PREFIX, FONT_STACK, RESOURCE_COLORS } from "../constants";
import { clearChildren } from "../utils/dom";

export interface LegendDimensions {
    /** Height consumed by top/bottom legend, or width consumed by right legend */
    size: number;
}

/** Render or update the legend. */
export function renderLegend(
    container: HTMLDivElement,
    groups: string[],
    cfg: RenderConfig,
): LegendDimensions {
    clearChildren(container);

    if (!cfg.legend.showLegend || groups.length === 0) {
        container.style.display = "none";
        return { size: 0 };
    }

    const isRight = cfg.legend.position === "right";
    const fs = cfg.legend.fontSize;
    /* Scale spacing proportionally to font size */
    const pad = Math.max(2, Math.round(fs * 0.4));
    const gap = Math.max(6, Math.round(fs * 1.1));
    const swatchSize = Math.max(6, Math.round(fs * 0.9));

    container.style.display = "flex";
    container.style.fontFamily = FONT_STACK;
    container.style.fontSize = `${fs}px`;
    container.style.color = cfg.legend.fontColor;
    container.style.padding = `${pad}px ${pad * 2}px`;
    container.style.gap = `${gap}px`;
    container.style.flexWrap = "wrap";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.flexDirection = isRight ? "column" : "row";

    if (isRight) {
        container.style.maxWidth = "25%";
        container.style.maxHeight = "";
        container.style.minWidth = "0";
        container.style.overflowX = "hidden";
        container.style.overflowY = "auto";
        container.style.alignItems = "flex-start";
        container.style.justifyContent = "flex-start";
    } else {
        container.style.maxWidth = "";
        container.style.maxHeight = "30%";
        container.style.minWidth = "";
        container.style.overflowX = "hidden";
        container.style.overflowY = "auto";
    }

    for (let i = 0; i < groups.length; i++) {
        const item = document.createElement("div");
        item.className = `${CSS_PREFIX}-legend-item`;
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = `${Math.round(fs * 0.35)}px`;
        item.style.minWidth = "0";
        item.style.maxWidth = "100%";

        const swatch = document.createElement("span");
        swatch.className = `${CSS_PREFIX}-legend-swatch`;
        swatch.style.width = `${swatchSize}px`;
        swatch.style.height = `${swatchSize}px`;
        swatch.style.borderRadius = "50%";
        swatch.style.flexShrink = "0";
        swatch.style.backgroundColor = RESOURCE_COLORS[i % RESOURCE_COLORS.length];

        const text = document.createElement("span");
        text.textContent = groups[i];
        text.style.whiteSpace = "nowrap";
        text.style.overflow = "hidden";
        text.style.textOverflow = "ellipsis";
        text.style.minWidth = "0";

        item.appendChild(swatch);
        item.appendChild(text);
        container.appendChild(item);
    }

    /* Measure consumed space */
    const rect = container.getBoundingClientRect();
    return { size: isRight ? rect.width : rect.height };
}
