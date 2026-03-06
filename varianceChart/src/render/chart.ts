/* ═══════════════════════════════════════════════
   render/chart.ts - Primary chart rendering (actual + budget bars)
   ═══════════════════════════════════════════════ */
"use strict";

import { select, Selection } from "d3-selection";
import { scaleBand, scaleLinear, ScaleBand, ScaleLinear } from "d3-scale";
import { VarianceItem, RenderConfig, ChartCallbacks } from "../types";
import { LEGEND_HEIGHT, MARGIN } from "../constants";
import { renderXAxis, renderYAxis, renderGridlines } from "./axes";
import { renderVarianceIndicators } from "./varianceIndicator";
import { renderVariancePanel } from "./variancePanel";
import { renderLabels } from "./labels";
import { renderLegend } from "./legend";

/** Main chart layout and render orchestration */
export function renderChart(
    svg: SVGSVGElement,
    items: VarianceItem[],
    cfg: RenderConfig,
    width: number,
    height: number,
    callbacks: ChartCallbacks,
): void {
    const d3svg = select(svg);
    d3svg.selectAll("*").remove();

    if (items.length === 0) return;

    const isVertical = cfg.chart.orientation === "vertical";

    /* ── Compute margins (proportional to viewport) ── */
    const fontSize = cfg.axis.axisFontSize;
    const legendH = cfg.legend.showLegend
        ? Math.max(LEGEND_HEIGHT, cfg.legend.legendFontSize * 2.5)
        : 0;
    const legendAtTop = cfg.legend.legendPosition === "top";
    const xRotation = parseInt(cfg.axis.xLabelRotation, 10);
    const xAxisExtra = cfg.axis.showXAxis
        ? (xRotation > 0 ? Math.max(40, fontSize * 4) : Math.max(24, fontSize * 2.4))
        : 0;
    const yAxisExtra = cfg.axis.showYAxis ? Math.max(40, fontSize * 5) : Math.max(8, height * 0.02);

    const marginTop = Math.max(MARGIN.top, height * 0.02) + (legendAtTop ? legendH : 0);
    const marginBottom = Math.max(MARGIN.bottom, height * 0.04) + (!legendAtTop ? legendH : 0) + (isVertical ? xAxisExtra : 0);
    const marginLeft = Math.max(MARGIN.left, width * 0.04) + (isVertical ? 0 : yAxisExtra);
    const marginRight = Math.max(MARGIN.right, width * 0.02);

    /* Panel allocation */
    const panelAlloc = cfg.variancePanel.showVariancePanel && isVertical
        ? Math.round(width * cfg.variancePanel.panelWidth)
        : 0;

    const innerWidth = Math.max(10, width - marginLeft - marginRight - panelAlloc);
    const innerHeight = Math.max(10, height - marginTop - marginBottom);

    /* ── Set SVG dimensions ── */
    d3svg.attr("width", width).attr("height", height);

    /* ── Clip path for chart area (prevents axis label overflow) ── */
    const clipId = "variance-clip-" + Math.random().toString(36).slice(2, 9);
    const defs = d3svg.append("defs");
    defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", -marginLeft)
        .attr("y", -marginTop)
        .attr("width", width)
        .attr("height", height);

    /* ── Root group ── */
    const root = d3svg.append("g")
        .attr("class", "variance-root")
        .attr("transform", `translate(${marginLeft},${marginTop})`)
        .attr("clip-path", `url(#${clipId})`);

    /* ── Scales ── */
    const categories = items.map((d) => d.category);
    const allValues = items.flatMap((d) => [d.actual, d.budget, 0]);
    const valueMin = Math.min(...allValues);
    const valueMax = Math.max(...allValues);
    const valuePad = (valueMax - valueMin) * 0.1 || 1;

    let bandScale: ScaleBand<string>;
    let valueScale: ScaleLinear<number, number>;

    if (isVertical) {
        bandScale = scaleBand<string>()
            .domain(categories)
            .range([0, innerWidth])
            .padding(0.15);

        valueScale = scaleLinear()
            .domain([valueMin - valuePad, valueMax + valuePad])
            .range([innerHeight, 0])
            .nice();
    } else {
        bandScale = scaleBand<string>()
            .domain(categories)
            .range([0, innerHeight])
            .padding(0.15);

        valueScale = scaleLinear()
            .domain([valueMin - valuePad, valueMax + valuePad])
            .range([0, innerWidth])
            .nice();
    }

    /* ── Gridlines ── */
    const gridG = root.append("g").attr("class", "variance-gridlines");
    renderGridlines(gridG, valueScale, cfg.axis, innerWidth, innerHeight, isVertical);

    /* ── Draw bars ── */
    const barsG = root.append("g").attr("class", "variance-bars");
    renderBars(barsG, items, bandScale, valueScale, cfg, isVertical, callbacks);

    /* ── Variance indicators ── */
    const indicatorG = root.append("g").attr("class", "variance-indicators");
    renderVarianceIndicators(indicatorG, items, bandScale, valueScale, cfg, isVertical);

    /* ── Data labels ── */
    const labelsG = root.append("g").attr("class", "variance-labels");
    renderLabels(labelsG, items, bandScale, valueScale, cfg, isVertical);

    /* ── Axes ── */
    if (cfg.axis.showXAxis) {
        const xAxisG = root.append("g")
            .attr("class", "variance-x-axis")
            .attr("transform", isVertical ? `translate(0,${innerHeight})` : `translate(0,${innerHeight})`);
        renderXAxis(xAxisG, isVertical ? bandScale : valueScale, cfg.axis, innerWidth, isVertical);
    }

    if (cfg.axis.showYAxis) {
        const yAxisG = root.append("g").attr("class", "variance-y-axis");
        renderYAxis(yAxisG, isVertical ? valueScale : bandScale, cfg.axis, innerHeight, !isVertical);
    }

    /* ── Variance panel ── */
    if (panelAlloc > 0) {
        const panelGap = Math.max(4, width * 0.01);
        const panelG = root.append("g")
            .attr("class", "variance-panel")
            .attr("transform", `translate(${innerWidth + panelGap},0)`);
        renderVariancePanel(
            panelG, items, bandScale,
            cfg, panelAlloc - panelGap, innerHeight, isVertical,
        );
    }

    /* ── Legend ── */
    const legendPad = Math.max(4, legendH * 0.2);
    const legendY = legendAtTop ? -legendH + legendPad : innerHeight + xAxisExtra + legendPad;
    const legendG = root.append("g")
        .attr("class", "variance-legend")
        .attr("transform", `translate(0,${legendY})`);
    renderLegend(legendG, cfg, innerWidth);

    /* ── Background click to clear selection ── */
    d3svg.on("click", (e: MouseEvent) => {
        if (e.target === svg) {
            callbacks.onClick(null, e);
        }
    });
}

/* ═══════════════════════════════════════════════
   Bar rendering (actual + budget)
   ═══════════════════════════════════════════════ */

function renderBars(
    g: Selection<SVGGElement, unknown, null, undefined>,
    items: VarianceItem[],
    bandScale: ScaleBand<string>,
    valueScale: ScaleLinear<number, number>,
    cfg: RenderConfig,
    isVertical: boolean,
    callbacks: ChartCallbacks,
): void {
    const barFraction = cfg.chart.barWidth;
    const budgetFraction = cfg.chart.budgetWidth;
    const gap = cfg.chart.barGap;
    const radius = cfg.chart.barCornerRadius;

    for (const item of items) {
        const bandPos = bandScale(item.category) ?? 0;
        const bandW = bandScale.bandwidth();

        const actualBarSize = bandW * barFraction;
        const budgetBarSize = bandW * budgetFraction;

        const group = g.append("g")
            .attr("class", "variance-bar-group")
            .attr("data-row", item.rowIndex)
            .style("cursor", "pointer");

        if (isVertical) {
            /* Budget bar (behind, centered) */
            const budgetX = bandPos + (bandW - budgetBarSize) / 2;
            const budgetTop = valueScale(Math.max(item.budget, 0));
            const budgetBottom = valueScale(Math.min(item.budget, 0));

            group.append("rect")
                .attr("class", "variance-budget-bar")
                .attr("x", budgetX)
                .attr("y", budgetTop)
                .attr("width", budgetBarSize)
                .attr("height", Math.max(1, budgetBottom - budgetTop))
                .attr("fill", cfg.colors.budgetColor)
                .attr("rx", radius);

            /* Actual bar (in front, centered but offset by gap) */
            const actualX = bandPos + (bandW - actualBarSize) / 2 - gap;
            const actualTop = valueScale(Math.max(item.actual, 0));
            const actualBottom = valueScale(Math.min(item.actual, 0));

            group.append("rect")
                .attr("class", "variance-actual-bar")
                .attr("x", actualX)
                .attr("y", actualTop)
                .attr("width", actualBarSize)
                .attr("height", Math.max(1, actualBottom - actualTop))
                .attr("fill", cfg.colors.actualColor)
                .attr("rx", radius);
        } else {
            /* Horizontal bars */
            const zeroX = valueScale(0);

            /* Budget bar */
            const budgetY = bandPos + (bandW - budgetBarSize) / 2;
            const budgetLeft = valueScale(Math.min(item.budget, 0));
            const budgetRight = valueScale(Math.max(item.budget, 0));

            group.append("rect")
                .attr("class", "variance-budget-bar")
                .attr("x", budgetLeft)
                .attr("y", budgetY)
                .attr("width", Math.max(1, budgetRight - budgetLeft))
                .attr("height", budgetBarSize)
                .attr("fill", cfg.colors.budgetColor)
                .attr("rx", radius);

            /* Actual bar */
            const actualY = bandPos + (bandW - actualBarSize) / 2 - gap;
            const actualLeft = valueScale(Math.min(item.actual, 0));
            const actualRight = valueScale(Math.max(item.actual, 0));

            group.append("rect")
                .attr("class", "variance-actual-bar")
                .attr("x", actualLeft)
                .attr("y", actualY)
                .attr("width", Math.max(1, actualRight - actualLeft))
                .attr("height", actualBarSize)
                .attr("fill", cfg.colors.actualColor)
                .attr("rx", radius);
        }

        /* ── Interaction handlers ── */
        group
            .on("click", (e: MouseEvent) => {
                e.stopPropagation();
                callbacks.onClick(item, e);
            })
            .on("mouseover", (e: MouseEvent) => callbacks.onMouseOver(item, e))
            .on("mousemove", (e: MouseEvent) => callbacks.onMouseMove(item, e))
            .on("mouseout", () => callbacks.onMouseOut());
    }
}
