/*
 *  Marimekko Chart – Power BI Custom Visual
 *  render/axes.ts — Axis rendering (X, Y, gridlines, width labels)
 */
"use strict";

import * as d3 from "d3-selection";
import { scaleLinear } from "d3-scale";

import { MekkoColumn, RenderConfig } from "../types";
import {
    Y_AXIS_TICKS,
    WIDTH_LABEL_OFFSET_Y,
    ROTATED_LABEL_EXTRA_BOTTOM,
    FONT_FAMILY,
} from "../constants";
import { formatPercent, formatCompact } from "../utils/format";
import { truncateText } from "../utils/dom";

/* ═══════════════════════════════════════════════
   Y-Axis (percentage 0–100%)
   ═══════════════════════════════════════════════ */

/** Render the Y-axis with percentage ticks and optional gridlines */
export function renderYAxis(
    svg: d3.Selection<SVGGElement, unknown, null, undefined>,
    cfg: RenderConfig["axis"],
    chartHeight: number,
    chartWidth: number,
): void {
    svg.selectAll(".marimekko-y-axis").remove();

    if (!cfg.showYAxis) return;

    const g = svg.append("g").attr("class", "marimekko-y-axis");
    const yScale = scaleLinear().domain([0, 1]).range([chartHeight, 0]);
    const ticks = yScale.ticks(Y_AXIS_TICKS);

    /* Gridlines (behind everything) */
    if (cfg.showGridlines) {
        for (const t of ticks) {
            g.append("line")
                .attr("class", "marimekko-gridline")
                .attr("x1", 0)
                .attr("x2", chartWidth)
                .attr("y1", yScale(t))
                .attr("y2", yScale(t))
                .attr("stroke", cfg.gridlineColor)
                .attr("stroke-width", 1)
                .attr("shape-rendering", "crispEdges");
        }
    }

    /* Tick labels */
    for (const t of ticks) {
        g.append("text")
            .attr("class", "marimekko-y-tick")
            .attr("x", -8)
            .attr("y", yScale(t))
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("fill", cfg.yAxisFontColor)
            .attr("font-size", cfg.yAxisFontSize + "px")
            .attr("font-family", FONT_FAMILY)
            .text(formatPercent(t, 0));
    }
}

/* ═══════════════════════════════════════════════
   X-Axis (category labels beneath columns)
   ═══════════════════════════════════════════════ */

/** Render X-axis labels centred under each column */
export function renderXAxis(
    svg: d3.Selection<SVGGElement, unknown, null, undefined>,
    columns: MekkoColumn[],
    cfg: RenderConfig["axis"],
    chartHeight: number,
): void {
    svg.selectAll(".marimekko-x-axis").remove();

    if (!cfg.showXAxis) return;

    const g = svg.append("g").attr("class", "marimekko-x-axis");
    const rotation = Number(cfg.xLabelRotation) || 0;

    /* For rotated labels, allow more text but cap at a reasonable max */
    const maxLabelWidth = rotation > 0
        ? Math.min(chartHeight * 0.5, 120)
        : undefined; /* undefined = use column width */

    for (const col of columns) {
        const cx = col.x + col.width / 2;
        const truncWidth = maxLabelWidth ?? Math.max(0, col.width - 4);
        const label = truncateText(col.xCategory, truncWidth, cfg.xAxisFontSize, FONT_FAMILY);

        const text = g.append("text")
            .attr("class", "marimekko-x-label")
            .attr("x", cx)
            .attr("y", chartHeight + 16)
            .attr("fill", cfg.xAxisFontColor)
            .attr("font-size", cfg.xAxisFontSize + "px")
            .attr("font-family", FONT_FAMILY)
            .text(label);

        if (rotation === 0) {
            text.attr("text-anchor", "middle");
        } else {
            text.attr("text-anchor", "end")
                .attr("transform", `rotate(-${rotation}, ${cx}, ${chartHeight + 16})`);
        }
    }
}

/* ═══════════════════════════════════════════════
   Width Labels (above each column)
   ═══════════════════════════════════════════════ */

/** Render absolute or percentage width labels above columns */
export function renderWidthLabels(
    svg: d3.Selection<SVGGElement, unknown, null, undefined>,
    columns: MekkoColumn[],
    cfg: RenderConfig["axis"],
): void {
    svg.selectAll(".marimekko-width-labels").remove();

    if (!cfg.showWidthLabels) return;

    const g = svg.append("g").attr("class", "marimekko-width-labels");
    const fontSize = cfg.xAxisFontSize - 1;

    for (const col of columns) {
        const cx = col.x + col.width / 2;
        const rawText = formatCompact(col.columnTotal);
        /* Truncate width labels that exceed column width */
        const labelText = truncateText(rawText, Math.max(0, col.width - 4), fontSize, FONT_FAMILY);
        if (!labelText) continue;

        g.append("text")
            .attr("class", "marimekko-width-label")
            .attr("x", cx)
            .attr("y", -WIDTH_LABEL_OFFSET_Y)
            .attr("text-anchor", "middle")
            .attr("fill", cfg.xAxisFontColor)
            .attr("font-size", fontSize + "px")
            .attr("font-family", FONT_FAMILY)
            .text(labelText);
    }
}

/** Compute extra bottom margin needed for rotated labels */
export function extraBottomForRotation(rotation: string): number {
    return ROTATED_LABEL_EXTRA_BOTTOM[rotation as keyof typeof ROTATED_LABEL_EXTRA_BOTTOM] ?? 0;
}
