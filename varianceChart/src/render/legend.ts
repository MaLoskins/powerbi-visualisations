/* ═══════════════════════════════════════════════
   render/legend.ts - Legend rendering
   ═══════════════════════════════════════════════ */
"use strict";

import { Selection } from "d3-selection";
import { RenderConfig } from "../types";

type SVGSel = Selection<SVGGElement, unknown, null, undefined>;

/** Truncate legend label text to fit available width */
function truncateLegendLabel(text: string, maxWidthPx: number, fontSize: number): string {
    const approxChars = Math.floor(maxWidthPx / (fontSize * 0.6));
    if (approxChars <= 0) return "";
    if (text.length <= approxChars) return text;
    return text.slice(0, Math.max(2, approxChars - 2)) + "...";
}

/** Render the legend with Actual, Budget, Favourable, Unfavourable entries */
export function renderLegend(
    g: SVGSel,
    cfg: RenderConfig,
    totalWidth: number,
): void {
    g.selectAll("*").remove();
    if (!cfg.legend.showLegend) {
        g.attr("display", "none");
        return;
    }
    g.attr("display", null);

    const entries = [
        { label: "Actual", color: cfg.colors.actualColor },
        { label: "Budget", color: cfg.colors.budgetColor },
        { label: "Favourable", color: cfg.colors.favourableColor },
        { label: "Unfavourable", color: cfg.colors.unfavourableColor },
    ];

    const fontSize = cfg.legend.legendFontSize;
    const swatchSize = fontSize;
    const spacing = Math.max(8, fontSize * 1.2);
    const swatchGap = Math.max(3, fontSize * 0.4);

    /* Calculate max label width per entry when total exceeds available space */
    const fixedPerEntry = swatchSize + swatchGap + spacing;
    const totalFixed = fixedPerEntry * entries.length;
    const availableForLabels = totalWidth - totalFixed;
    const maxLabelWidth = Math.max(fontSize * 2, availableForLabels / entries.length);

    /* Approximate total width for centering */
    let totalLegendWidth = 0;
    const truncatedLabels: string[] = [];
    for (const entry of entries) {
        const truncated = truncateLegendLabel(entry.label, maxLabelWidth, fontSize);
        truncatedLabels.push(truncated);
        totalLegendWidth += swatchSize + swatchGap + truncated.length * fontSize * 0.6 + spacing;
    }

    let x = Math.max(0, (totalWidth - totalLegendWidth) / 2);

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const displayLabel = truncatedLabels[i];

        /* Swatch */
        g.append("rect")
            .attr("class", "variance-legend-swatch")
            .attr("x", x)
            .attr("y", -swatchSize / 2)
            .attr("width", swatchSize)
            .attr("height", swatchSize)
            .attr("rx", 2)
            .attr("fill", entry.color);

        x += swatchSize + swatchGap;

        /* Label */
        g.append("text")
            .attr("class", "variance-legend-label")
            .attr("x", x)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("font-size", fontSize + "px")
            .attr("fill", cfg.legend.legendFontColor)
            .text(displayLabel);

        x += displayLabel.length * fontSize * 0.6 + spacing;
    }
}
