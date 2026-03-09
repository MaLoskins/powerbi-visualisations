/* ═══════════════════════════════════════════════
   Axes Renderer
   Create and update X/Y axes with d3 scales
   ═══════════════════════════════════════════════ */

"use strict";

import { scaleLinear, scaleLog, ScaleLinear, ScaleLogarithmic } from "d3-scale";
import { select, Selection } from "d3-selection";

import {
    ChartDimensions,
    RenderConfig,
    ScatterDataPoint,
} from "../types";
import {
    LOG_CLAMP_VALUE,
    DASH_ARRAYS,
    AXIS_TICK_SIZE,
    AXIS_TICK_LABEL_OFFSET,
    AXIS_LABEL_Y_OFFSET,
    AXIS_X_TICK_SPACING,
    AXIS_Y_TICK_SPACING,
} from "../constants";
import { formatNumber } from "../utils/format";

export type NumericScale = ScaleLinear<number, number> | ScaleLogarithmic<number, number>;

export interface AxisResult {
    xScale: NumericScale;
    yScale: NumericScale;
}

/* ── Scale Construction ── */

/**
 * Build x and y scales from data + config. Handles log-scale clamping.
 * Returns scale objects for use by all renderers.
 */
export function buildScales(
    points: ScatterDataPoint[],
    dims: ChartDimensions,
    cfg: RenderConfig["axis"],
): AxisResult {
    /* ── Gather raw extents ── */
    let xVals = points.map((p) => p.x);
    let yVals = points.map((p) => p.y);

    /* ── Log-scale clamping (before domain calculation) ── */
    if (cfg.xAxisScale === "log") {
        xVals = xVals.map((v) => {
            if (v <= 0) {
                console.warn(`[bscatter] Log X axis: clamping value ${v} to ${LOG_CLAMP_VALUE}`);
                return LOG_CLAMP_VALUE;
            }
            return v;
        });
    }
    if (cfg.yAxisScale === "log") {
        yVals = yVals.map((v) => {
            if (v <= 0) {
                console.warn(`[bscatter] Log Y axis: clamping value ${v} to ${LOG_CLAMP_VALUE}`);
                return LOG_CLAMP_VALUE;
            }
            return v;
        });
    }

    /* ── Compute domains with optional user overrides ── */
    const xMin = cfg.xAxisMin ?? (xVals.length ? Math.min(...xVals) : 0);
    const xMax = cfg.xAxisMax ?? (xVals.length ? Math.max(...xVals) : 1);
    const yMin = cfg.yAxisMin ?? (yVals.length ? Math.min(...yVals) : 0);
    const yMax = cfg.yAxisMax ?? (yVals.length ? Math.max(...yVals) : 1);

    /* ── Pad domains by 5% for breathing room ── */
    const xPad = (xMax - xMin) * 0.05 || 0.5;
    const yPad = (yMax - yMin) * 0.05 || 0.5;

    const xDomain: [number, number] = [
        cfg.xAxisMin ?? xMin - xPad,
        cfg.xAxisMax ?? xMax + xPad,
    ];
    const yDomain: [number, number] = [
        cfg.yAxisMin ?? yMin - yPad,
        cfg.yAxisMax ?? yMax + yPad,
    ];

    /* ── Ensure log domain is positive ── */
    if (cfg.xAxisScale === "log") {
        xDomain[0] = Math.max(xDomain[0], LOG_CLAMP_VALUE);
        xDomain[1] = Math.max(xDomain[1], LOG_CLAMP_VALUE * 10);
    }
    if (cfg.yAxisScale === "log") {
        yDomain[0] = Math.max(yDomain[0], LOG_CLAMP_VALUE);
        yDomain[1] = Math.max(yDomain[1], LOG_CLAMP_VALUE * 10);
    }

    /* ── Create scales ── */
    const xScale: NumericScale =
        cfg.xAxisScale === "log"
            ? scaleLog().domain(xDomain).range([0, dims.plotWidth]).clamp(true)
            : scaleLinear().domain(xDomain).range([0, dims.plotWidth]).nice();

    const yScale: NumericScale =
        cfg.yAxisScale === "log"
            ? scaleLog().domain(yDomain).range([dims.plotHeight, 0]).clamp(true)
            : scaleLinear().domain(yDomain).range([dims.plotHeight, 0]).nice();

    return { xScale, yScale };
}

/* ── Axis Rendering ── */

/**
 * Render X and Y axes, grid lines, and axis labels into the SVG group.
 * Uses .join() for correct enter/update/exit on all tick and gridline elements.
 */
export function renderAxes(
    axisGroup: Selection<SVGGElement, unknown, null, undefined>,
    xScale: NumericScale,
    yScale: NumericScale,
    dims: ChartDimensions,
    cfg: RenderConfig["axis"],
): void {
    axisGroup.selectAll("*").remove();

    const tickCountX = Math.max(3, Math.floor(dims.plotWidth / AXIS_X_TICK_SPACING));
    const tickCountY = Math.max(3, Math.floor(dims.plotHeight / AXIS_Y_TICK_SPACING));

    const xTicks = xScale.ticks(tickCountX);
    const yTicks = yScale.ticks(tickCountY);

    /* ── Grid lines ── */
    if (cfg.showGridlines) {
        const gridG = axisGroup.append("g").attr("class", "bscatter-gridlines");

        // Vertical grid lines — use join() for correct enter/update/exit
        gridG
            .selectAll<SVGLineElement, number>(".bscatter-gridline-x")
            .data(xTicks)
            .join("line")
            .attr("class", "bscatter-gridline-x")
            .attr("x1", (d) => xScale(d) ?? 0)
            .attr("x2", (d) => xScale(d) ?? 0)
            .attr("y1", 0)
            .attr("y2", dims.plotHeight)
            .attr("stroke", cfg.gridlineColor)
            .attr("stroke-width", 0.5)
            .attr("shape-rendering", "crispEdges");

        // Horizontal grid lines
        gridG
            .selectAll<SVGLineElement, number>(".bscatter-gridline-y")
            .data(yTicks)
            .join("line")
            .attr("class", "bscatter-gridline-y")
            .attr("x1", 0)
            .attr("x2", dims.plotWidth)
            .attr("y1", (d) => yScale(d) ?? 0)
            .attr("y2", (d) => yScale(d) ?? 0)
            .attr("stroke", cfg.gridlineColor)
            .attr("stroke-width", 0.5)
            .attr("shape-rendering", "crispEdges");
    }

    /* ── X Axis ── */
    const xAxisG = axisGroup
        .append("g")
        .attr("class", "bscatter-x-axis")
        .attr("transform", `translate(0,${dims.plotHeight})`);

    // Axis line
    xAxisG
        .append("line")
        .attr("x1", 0)
        .attr("x2", dims.plotWidth)
        .attr("stroke", cfg.axisLineColor)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");

    // Tick marks and labels
    xAxisG
        .selectAll<SVGGElement, number>(".bscatter-x-tick")
        .data(xTicks)
        .join("g")
        .attr("class", "bscatter-x-tick")
        .attr("transform", (d) => `translate(${xScale(d) ?? 0},0)`)
        .each(function (d) {
            const g = select(this);
            g.append("line")
                .attr("y2", AXIS_TICK_SIZE)
                .attr("stroke", cfg.axisLineColor)
                .attr("shape-rendering", "crispEdges");
            g.append("text")
                .attr("y", AXIS_TICK_LABEL_OFFSET)
                .attr("dy", "0.71em")
                .attr("text-anchor", "middle")
                .attr("fill", cfg.axisFontColor)
                .attr("font-size", `${cfg.axisFontSize}px`)
                .text(formatNumber(Number(d)));
        });

    // X axis label
    if (cfg.xAxisLabel) {
        xAxisG
            .append("text")
            .attr("class", "bscatter-axis-label")
            .attr("x", dims.plotWidth / 2)
            .attr("y", AXIS_LABEL_Y_OFFSET)
            .attr("text-anchor", "middle")
            .attr("fill", cfg.axisFontColor)
            .attr("font-size", `${cfg.axisFontSize + 1}px`)
            .text(cfg.xAxisLabel);
    }

    /* ── Y Axis ── */
    const yAxisG = axisGroup
        .append("g")
        .attr("class", "bscatter-y-axis");

    // Axis line
    yAxisG
        .append("line")
        .attr("y1", 0)
        .attr("y2", dims.plotHeight)
        .attr("stroke", cfg.axisLineColor)
        .attr("stroke-width", 1)
        .attr("shape-rendering", "crispEdges");

    // Tick marks and labels
    yAxisG
        .selectAll<SVGGElement, number>(".bscatter-y-tick")
        .data(yTicks)
        .join("g")
        .attr("class", "bscatter-y-tick")
        .attr("transform", (d) => `translate(0,${yScale(d) ?? 0})`)
        .each(function (d) {
            const g = select(this);
            g.append("line")
                .attr("x2", -AXIS_TICK_SIZE)
                .attr("stroke", cfg.axisLineColor)
                .attr("shape-rendering", "crispEdges");
            g.append("text")
                .attr("x", -AXIS_TICK_LABEL_OFFSET)
                .attr("dy", "0.32em")
                .attr("text-anchor", "end")
                .attr("fill", cfg.axisFontColor)
                .attr("font-size", `${cfg.axisFontSize}px`)
                .text(formatNumber(Number(d)));
        });

    // Y axis label
    if (cfg.yAxisLabel) {
        yAxisG
            .append("text")
            .attr("class", "bscatter-axis-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -dims.plotHeight / 2)
            .attr("y", -dims.margins.left + 14)
            .attr("text-anchor", "middle")
            .attr("fill", cfg.axisFontColor)
            .attr("font-size", `${cfg.axisFontSize + 1}px`)
            .text(cfg.yAxisLabel);
    }
}

// Re-export DASH_ARRAYS so render modules that previously imported it from axes.ts continue to compile
export { DASH_ARRAYS };
