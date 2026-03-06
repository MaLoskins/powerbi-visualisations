/* ═══════════════════════════════════════════════
   Axes Rendering — X, Y-Left, Y-Left-Secondary,
   Y-Right axis ticks, labels, gridlines
   ═══════════════════════════════════════════════ */
"use strict";

import { select, Selection } from "d3-selection";
import { ScaleLinear, ScaleBand } from "d3-scale";
import type { RenderConfig, YAxisConfig, ChartLayout, LabelRotation } from "../types";
import { TICK_COUNT, SLATE, Y_AXIS_WIDTH_BASE } from "../constants";
import { formatAxisValue } from "../utils/format";

/** Estimate the max number of characters that fit in a given pixel width at a given font size. */
function maxCharsForWidth(availablePx: number, fontSize: number): number {
    // Average character width is roughly 0.55 * fontSize for Segoe UI
    const avgCharWidth = fontSize * 0.55;
    return Math.max(4, Math.floor(availablePx / avgCharWidth));
}

type SvgSel = Selection<SVGGElement, unknown, null, undefined>;

/* ── Y-Axis Rendering ── */

export function renderYAxis(
    g: SvgSel,
    scale: ScaleLinear<number, number>,
    cfg: YAxisConfig,
    layout: ChartLayout,
    side: "left" | "leftSecondary" | "right",
): void {
    g.selectAll("*").remove();
    if (!cfg.showAxis) return;

    const ticks = scale.ticks(TICK_COUNT);
    const isRight = side === "right";
    const xPos = isRight
        ? layout.chartLeft + layout.chartWidth
        : side === "leftSecondary"
            ? layout.chartLeft - layout.leftPrimaryAxisWidth - layout.leftSecondaryAxisWidth + layout.leftSecondaryAxisWidth
            : layout.chartLeft;

    const textAnchor = isRight ? "start" : "end";
    const textDx = isRight ? 8 : -8;

    /* ── Axis line ── */
    g.append("line")
        .attr("class", "maxes-axis-line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", layout.chartTop)
        .attr("y2", layout.chartTop + layout.chartHeight)
        .attr("stroke", cfg.axisFontColor)
        .attr("stroke-width", 1);

    /* ── Ticks + labels ── */
    for (const t of ticks) {
        const y = scale(t);

        g.append("line")
            .attr("class", "maxes-axis-tick")
            .attr("x1", xPos - (isRight ? 0 : 4))
            .attr("x2", xPos + (isRight ? 4 : 0))
            .attr("y1", y)
            .attr("y2", y)
            .attr("stroke", cfg.axisFontColor)
            .attr("stroke-width", 1);

        g.append("text")
            .attr("class", "maxes-axis-label")
            .attr("x", xPos + textDx)
            .attr("y", y)
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .attr("fill", cfg.axisFontColor)
            .attr("font-size", cfg.axisFontSize + "px")
            .text(formatAxisValue(t));
    }

    /* ── Gridlines ── */
    if (cfg.showGridlines) {
        for (const t of ticks) {
            const y = scale(t);
            g.append("line")
                .attr("class", "maxes-gridline")
                .attr("x1", layout.chartLeft)
                .attr("x2", layout.chartLeft + layout.chartWidth)
                .attr("y1", y)
                .attr("y2", y)
                .attr("stroke", SLATE[200])
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "3,3");
        }
    }

    /* ── Axis label (rotated text) ── */
    if (cfg.axisLabel) {
        // Proportional offset: 80% of the axis width, clamped between 24px and the axis width
        const axisWidth = isRight ? layout.rightAxisWidth : layout.leftPrimaryAxisWidth || Y_AXIS_WIDTH_BASE;
        const labelOffset = Math.max(24, Math.min(axisWidth, axisWidth * 0.8));
        const labelX = isRight
            ? xPos + labelOffset
            : xPos - labelOffset;
        const labelY = layout.chartTop + layout.chartHeight / 2;

        // Truncate axis title if it would overflow the chart height
        const maxTitleChars = maxCharsForWidth(layout.chartHeight, cfg.axisFontSize + 1);
        const titleText = truncateLabel(cfg.axisLabel, maxTitleChars);

        g.append("text")
            .attr("class", "maxes-axis-title")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("transform", `rotate(-90, ${labelX}, ${labelY})`)
            .attr("fill", cfg.axisFontColor)
            .attr("font-size", (cfg.axisFontSize + 1) + "px")
            .attr("font-weight", "600")
            .text(titleText);
    }
}

/* ── X-Axis Rendering ── */

export function renderXAxis(
    g: SvgSel,
    xScale: ScaleBand<string>,
    cfg: RenderConfig["xAxis"],
    layout: ChartLayout,
): void {
    g.selectAll("*").remove();
    if (!cfg.showXAxis) return;

    const categories = xScale.domain();
    const bandwidth = xScale.bandwidth();
    const y = layout.chartTop + layout.chartHeight;

    /* ── Axis line ── */
    g.append("line")
        .attr("class", "maxes-x-axis-line")
        .attr("x1", layout.chartLeft)
        .attr("x2", layout.chartLeft + layout.chartWidth)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", cfg.xAxisFontColor)
        .attr("stroke-width", 1);

    /* ── Tick labels ── */
    const rotation = parseInt(cfg.xLabelRotation, 10) || 0;

    // Dynamic truncation limit: compute max chars that fit within the bandwidth
    // For rotated labels, allow more characters since they occupy vertical space
    const availableWidth = rotation === 0
        ? bandwidth
        : rotation === 45
            ? bandwidth * 1.8
            : layout.xAxisHeight * 1.5;
    const dynamicMaxChars = maxCharsForWidth(availableWidth, cfg.xAxisFontSize);

    for (const cat of categories) {
        const x = (xScale(cat) ?? 0) + bandwidth / 2;

        const label = g.append("text")
            .attr("class", "maxes-x-label")
            .attr("x", x)
            .attr("y", y + 14)
            .attr("fill", cfg.xAxisFontColor)
            .attr("font-size", cfg.xAxisFontSize + "px")
            .text(truncateLabel(cat, dynamicMaxChars));

        if (rotation === 0) {
            label.attr("text-anchor", "middle");
        } else {
            label.attr("text-anchor", "end")
                .attr("transform", `rotate(-${rotation}, ${x}, ${y + 14})`);
        }
    }

    /* ── X gridlines ── */
    if (cfg.showXGridlines) {
        for (const cat of categories) {
            const x = (xScale(cat) ?? 0) + bandwidth / 2;
            g.append("line")
                .attr("class", "maxes-x-gridline")
                .attr("x1", x)
                .attr("x2", x)
                .attr("y1", layout.chartTop)
                .attr("y2", layout.chartTop + layout.chartHeight)
                .attr("stroke", cfg.gridlineColor)
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "3,3");
        }
    }
}

/** Truncate a label for axis display.
 *  Uses "..." (three ASCII dots) for maximum font/rendering compatibility. */
function truncateLabel(label: string, maxLen: number): string {
    if (maxLen < 4) maxLen = 4; // minimum meaningful truncation
    if (label.length <= maxLen) return label;
    return label.slice(0, maxLen - 3) + "...";
}
