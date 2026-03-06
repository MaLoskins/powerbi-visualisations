/* ═══════════════════════════════════════════════
   Legend Rendering
   ═══════════════════════════════════════════════ */
"use strict";

import { Selection } from "d3-selection";
import type { RenderConfig, ChartLayout, ChartType } from "../types";

type SvgSel = Selection<SVGGElement, unknown, null, undefined>;

/** Truncate a string to fit within a max character count, appending "..." if needed. */
function truncateLegendLabel(label: string, maxChars: number): string {
    if (maxChars < 4) maxChars = 4;
    if (label.length <= maxChars) return label;
    return label.slice(0, maxChars - 3) + "...";
}

/** Render the legend showing one entry per active measure.
 *  Clips entries that would exceed the available chart width. */
export function renderLegend(
    g: SvgSel,
    measureNames: string[],
    measureCount: number,
    cfg: RenderConfig,
    layout: ChartLayout,
): void {
    g.selectAll("*").remove();
    if (!cfg.legend.showLegend) return;

    const isTop = cfg.legend.legendPosition === "top";
    const baseY = isTop ? 14 : layout.totalHeight - 10;

    let xCursor = layout.chartLeft;
    const fontSize = cfg.legend.legendFontSize;
    const gap = Math.max(10, Math.min(24, fontSize * 1.6));
    const iconSize = Math.max(8, Math.min(16, fontSize * 1.2));
    const avgCharWidth = fontSize * 0.55;

    // Available width for legend items
    const maxX = layout.chartLeft + layout.chartWidth;

    for (let m = 0; m < measureCount; m++) {
        const s = cfg.series[m];
        if (s.chartType === "none") continue;

        // Check if there is room for at least an icon + a few characters
        const minEntryWidth = iconSize + 4 + avgCharWidth * 4;
        if (xCursor + minEntryWidth > maxX) break; // stop rendering legend items

        /* ── Icon ── */
        renderLegendIcon(g, s.chartType, xCursor, baseY - iconSize / 2, iconSize, s.color);
        xCursor += iconSize + 4;

        /* ── Label (truncate to fit remaining space) ── */
        const remainingPx = maxX - xCursor - gap;
        const maxChars = Math.max(4, Math.floor(remainingPx / avgCharWidth));
        const displayText = truncateLegendLabel(measureNames[m], maxChars);

        g.append("text")
            .attr("class", "maxes-legend-label")
            .attr("x", xCursor)
            .attr("y", baseY)
            .attr("dominant-baseline", "central")
            .attr("fill", cfg.legend.legendFontColor)
            .attr("font-size", fontSize + "px")
            .text(displayText);

        const textWidth = displayText.length * avgCharWidth;
        xCursor += textWidth + gap;
    }
}

/** Draw a small icon in the legend representing the chart type. */
function renderLegendIcon(
    g: SvgSel,
    chartType: ChartType,
    x: number,
    y: number,
    size: number,
    color: string,
): void {
    if (chartType === "bar") {
        // Small bar icon
        g.append("rect")
            .attr("class", "maxes-legend-icon")
            .attr("x", x)
            .attr("y", y + 2)
            .attr("width", size)
            .attr("height", size - 2)
            .attr("rx", 1)
            .attr("fill", color);
    } else if (chartType === "line") {
        // Small line icon
        g.append("line")
            .attr("class", "maxes-legend-icon")
            .attr("x1", x)
            .attr("x2", x + size)
            .attr("y1", y + size / 2)
            .attr("y2", y + size / 2)
            .attr("stroke", color)
            .attr("stroke-width", 2);
        g.append("circle")
            .attr("cx", x + size / 2)
            .attr("cy", y + size / 2)
            .attr("r", 2.5)
            .attr("fill", color);
    } else if (chartType === "area") {
        // Small area icon
        const pts = `${x},${y + size} ${x + size * 0.3},${y + 3} ${x + size * 0.7},${y + 6} ${x + size},${y + 1} ${x + size},${y + size}`;
        g.append("polygon")
            .attr("class", "maxes-legend-icon")
            .attr("points", pts)
            .attr("fill", color)
            .attr("opacity", 0.5);
        g.append("polyline")
            .attr("points", `${x},${y + size} ${x + size * 0.3},${y + 3} ${x + size * 0.7},${y + 6} ${x + size},${y + 1}`)
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("fill", "none");
    }
}
