/* ═══════════════════════════════════════════════
   Data Labels Renderer
   Text labels displayed above/near bubbles
   ═══════════════════════════════════════════════ */

"use strict";

import { Selection } from "d3-selection";

import { ChartDimensions, RenderConfig, ScatterDataPoint } from "../types";
import { LOG_CLAMP_VALUE } from "../constants";
import { formatNumber } from "../utils/format";
import { NumericScale } from "./axes";

/**
 * Render data labels next to each bubble.
 * Uses .join() for correct enter/update/exit handling.
 */
export function renderDataLabels(
    labelGroup: Selection<SVGGElement, unknown, null, undefined>,
    points: ScatterDataPoint[],
    xScale: NumericScale,
    yScale: NumericScale,
    cfg: RenderConfig["label"],
    axisCfg: RenderConfig["axis"],
    bubbleRadius: number,
    dims?: ChartDimensions,
): void {
    labelGroup.selectAll("*").remove();

    if (!cfg.showDataLabels || points.length === 0) return;

    const minY = cfg.labelFontSize; // leave room for at least one line of text
    const maxY = dims ? dims.plotHeight : Infinity;

    labelGroup
        .selectAll<SVGTextElement, ScatterDataPoint>(".bscatter-data-label")
        .data(points, (d) => d.id)
        .join("text")
        .attr("class", "bscatter-data-label")
        .attr("x", (d) => xScale(clampForScale(d.x, axisCfg.xAxisScale)) ?? 0)
        .attr("y", (d) => {
            const raw = (yScale(clampForScale(d.y, axisCfg.yAxisScale)) ?? 0) - bubbleRadius - 4;
            return Math.max(minY, Math.min(raw, maxY));
        })
        .attr("text-anchor", "middle")
        .attr("fill", cfg.labelFontColor)
        .attr("font-size", `${cfg.labelFontSize}px`)
        .style("pointer-events", "none")
        .text((d) => getLabelText(d, cfg.labelContent));
}

/* ── Helpers ── */

function getLabelText(
    point: ScatterDataPoint,
    content: string,
): string {
    switch (content) {
        case "category":
            return point.category;
        case "value":
            return `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
        case "both":
            return `${point.category} (${formatNumber(point.x)}, ${formatNumber(point.y)})`;
        default:
            return point.category;
    }
}

function clampForScale(value: number, scaleType: string): number {
    if (scaleType === "log" && value <= 0) return LOG_CLAMP_VALUE;
    return value;
}
