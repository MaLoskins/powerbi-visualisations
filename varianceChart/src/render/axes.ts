/* ═══════════════════════════════════════════════
   render/axes.ts - X/Y axis and gridline rendering
   ═══════════════════════════════════════════════ */
"use strict";

import { select, Selection } from "d3-selection";
import { ScaleBand, ScaleLinear } from "d3-scale";
import { RenderConfig } from "../types";

type SVGSel = Selection<SVGGElement, unknown, null, undefined>;

/* ── Render Y-axis (value axis for vertical, category for horizontal) ── */

export function renderYAxis(
    g: SVGSel,
    scale: ScaleLinear<number, number> | ScaleBand<string>,
    cfg: RenderConfig["axis"],
    innerHeight: number,
    isCategoryAxis: boolean,
): void {
    g.selectAll("*").remove();
    if (isCategoryAxis) {
        const band = scale as ScaleBand<string>;
        const ticks = band.domain();
        /* Allow roughly 8 characters proportional to font size for Y category labels */
        const maxYLabelWidth = cfg.axisFontSize * 8 * 0.6;
        for (const t of ticks) {
            const y = (band(t) ?? 0) + band.bandwidth() / 2;
            g.append("text")
                .attr("class", "variance-axis-label")
                .attr("x", -8)
                .attr("y", y)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .attr("font-size", cfg.axisFontSize + "px")
                .attr("fill", cfg.axisFontColor)
                .text(truncateLabel(t, maxYLabelWidth, cfg.axisFontSize));
        }
    } else {
        const linear = scale as ScaleLinear<number, number>;
        const ticks = linear.ticks(5);
        for (const t of ticks) {
            const y = linear(t);
            g.append("text")
                .attr("class", "variance-axis-label")
                .attr("x", -8)
                .attr("y", y)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .attr("font-size", cfg.axisFontSize + "px")
                .attr("fill", cfg.axisFontColor)
                .text(formatAxisTick(t));
        }
        /* Axis line */
        g.append("line")
            .attr("x1", 0).attr("x2", 0)
            .attr("y1", 0).attr("y2", innerHeight)
            .attr("stroke", cfg.axisFontColor)
            .attr("stroke-width", 0.5);
    }
}

/* ── Render X-axis (category axis for vertical, value for horizontal) ── */

export function renderXAxis(
    g: SVGSel,
    scale: ScaleBand<string> | ScaleLinear<number, number>,
    cfg: RenderConfig["axis"],
    innerWidth: number,
    isCategoryAxis: boolean,
): void {
    g.selectAll("*").remove();
    const rotation = parseInt(cfg.xLabelRotation, 10);

    if (isCategoryAxis) {
        const band = scale as ScaleBand<string>;
        const ticks = band.domain();
        for (const t of ticks) {
            const x = (band(t) ?? 0) + band.bandwidth() / 2;
            const label = g.append("text")
                .attr("class", "variance-axis-label")
                .attr("x", x)
                .attr("y", 12)
                .attr("font-size", cfg.axisFontSize + "px")
                .attr("fill", cfg.axisFontColor)
                .text(truncateLabel(t, band.bandwidth(), cfg.axisFontSize));

            if (rotation === 0) {
                label.attr("text-anchor", "middle");
            } else {
                label
                    .attr("text-anchor", "end")
                    .attr("transform", `rotate(-${rotation},${x},12)`);
            }
        }
    } else {
        const linear = scale as ScaleLinear<number, number>;
        const ticks = linear.ticks(5);
        for (const t of ticks) {
            g.append("text")
                .attr("class", "variance-axis-label")
                .attr("x", linear(t))
                .attr("y", 12)
                .attr("text-anchor", "middle")
                .attr("font-size", cfg.axisFontSize + "px")
                .attr("fill", cfg.axisFontColor)
                .text(formatAxisTick(t));
        }
    }

    /* Axis line */
    g.append("line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", 0).attr("y2", 0)
        .attr("stroke", cfg.axisFontColor)
        .attr("stroke-width", 0.5);
}

/* ── Render gridlines ── */

export function renderGridlines(
    g: SVGSel,
    valueScale: ScaleLinear<number, number>,
    cfg: RenderConfig["axis"],
    innerWidth: number,
    innerHeight: number,
    isVertical: boolean,
): void {
    g.selectAll("*").remove();
    if (!cfg.showGridlines) return;

    const ticks = valueScale.ticks(5);
    for (const t of ticks) {
        const pos = valueScale(t);
        if (isVertical) {
            g.append("line")
                .attr("x1", 0).attr("x2", innerWidth)
                .attr("y1", pos).attr("y2", pos)
                .attr("stroke", cfg.gridlineColor)
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "2,2");
        } else {
            g.append("line")
                .attr("x1", pos).attr("x2", pos)
                .attr("y1", 0).attr("y2", innerHeight)
                .attr("stroke", cfg.gridlineColor)
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "2,2");
        }
    }
}

/* ── Helpers ── */

function formatAxisTick(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return (value / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return (value / 1e3).toFixed(1) + "K";
    return value.toString();
}

function truncateLabel(text: string, maxWidth: number, fontSize: number = 10): string {
    const approxChars = Math.floor(maxWidth / (fontSize * 0.6));
    if (text.length <= approxChars) return text;
    return text.slice(0, Math.max(2, approxChars - 1)) + "...";
}
