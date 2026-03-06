/* ═══════════════════════════════════════════════
   Quadrant Renderer
   Crossing lines + corner labels
   ═══════════════════════════════════════════════ */

"use strict";

import { Selection } from "d3-selection";

import { ChartDimensions, RenderConfig } from "../types";
import { DASH_ARRAYS, QUADRANT_LABEL_PAD, QUADRANT_LABEL_FONT_SIZE } from "../constants";
import { NumericScale } from "./axes";

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

/**
 * Render quadrant dividing lines and optional labels.
 */
export function renderQuadrants(
    quadrantGroup: Selection<SVGGElement, unknown, null, undefined>,
    xScale: NumericScale,
    yScale: NumericScale,
    dims: ChartDimensions,
    cfg: RenderConfig["quadrant"],
): void {
    quadrantGroup.selectAll("*").remove();

    if (!cfg.showQuadrants) return;

    const cx = xScale(cfg.quadrantXValue) ?? 0;
    const cy = yScale(cfg.quadrantYValue) ?? 0;

    const dashArray = DASH_ARRAYS[cfg.quadrantLineStyle] ?? "none";

    /* ── Vertical line (X = quadrantXValue) ── */
    if (cx >= 0 && cx <= dims.plotWidth) {
        quadrantGroup
            .append("line")
            .attr("class", "bscatter-quadrant-line")
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("y1", 0)
            .attr("y2", dims.plotHeight)
            .attr("stroke", cfg.quadrantLineColor)
            .attr("stroke-width", cfg.quadrantLineWidth)
            .attr("stroke-dasharray", dashArray)
            .attr("shape-rendering", "crispEdges")
            .style("pointer-events", "none");
    }

    /* ── Horizontal line (Y = quadrantYValue) ── */
    if (cy >= 0 && cy <= dims.plotHeight) {
        quadrantGroup
            .append("line")
            .attr("class", "bscatter-quadrant-line")
            .attr("x1", 0)
            .attr("x2", dims.plotWidth)
            .attr("y1", cy)
            .attr("y2", cy)
            .attr("stroke", cfg.quadrantLineColor)
            .attr("stroke-width", cfg.quadrantLineWidth)
            .attr("stroke-dasharray", dashArray)
            .attr("shape-rendering", "crispEdges")
            .style("pointer-events", "none");
    }

    /* ── Quadrant labels ── */
    if (!cfg.showQuadrantLabels) return;

    const labelColor = cfg.quadrantLineColor;
    const pad = QUADRANT_LABEL_PAD;
    const fs = QUADRANT_LABEL_FONT_SIZE;

    // Clamped positions for label x/y in each half
    const xRight = clamp(cx + pad, pad, dims.plotWidth - pad);
    const xLeft  = clamp(cx - pad, pad, dims.plotWidth - pad);
    const yTop   = clamp(cy - pad, pad + fs, dims.plotHeight - pad);
    const yBot   = clamp(cy + pad + fs, pad + fs, dims.plotHeight - pad);

    const anchorRight = cx + pad < dims.plotWidth / 2 ? "start" : "end";
    const anchorLeft  = cx - pad > dims.plotWidth / 2 ? "end" : "start";

    const labels: Array<{ x: number; y: number; anchor: string; text: string }> = [
        { x: xRight, y: yTop, anchor: anchorRight, text: cfg.q1Label }, // Q1: top-right
        { x: xLeft,  y: yTop, anchor: anchorLeft,  text: cfg.q2Label }, // Q2: top-left
        { x: xLeft,  y: yBot, anchor: anchorLeft,  text: cfg.q3Label }, // Q3: bottom-left
        { x: xRight, y: yBot, anchor: anchorRight, text: cfg.q4Label }, // Q4: bottom-right
    ];

    for (const lbl of labels) {
        quadrantGroup
            .append("text")
            .attr("class", "bscatter-quadrant-label")
            .attr("x", lbl.x)
            .attr("y", lbl.y)
            .attr("text-anchor", lbl.anchor)
            .attr("fill", labelColor)
            .attr("font-size", `${fs}px`)
            .attr("opacity", 0.6)
            .style("pointer-events", "none")
            .text(lbl.text);
    }
}
