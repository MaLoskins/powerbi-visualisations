/* ═══════════════════════════════════════════════
   Advanced Trellis – Chart Renderers
   Bar / Line / Area / Lollipop
   ═══════════════════════════════════════════════ */

"use strict";

import { select, type Selection } from "d3-selection";
import { scaleBand, scaleLinear, type ScaleBand, type ScaleLinear } from "d3-scale";
import { line as d3Line, area as d3Area, curveMonotoneX, curveLinear } from "d3-shape";
import type {
    TrellisPanel,
    TrellisDataPoint,
    RenderConfig,
    PanelCallbacks,
} from "../types";
import { hexToRgba } from "../utils/color";
import { formatAxisTick, formatValue, truncate } from "../utils/format";
import {
    PANEL_MARGIN,
    X_AXIS_HEIGHT,
    Y_AXIS_WIDTH,
    MIN_BAR_WIDTH,
    BAR_HOVER_OPACITY,
    DOT_HOVER_SCALE,
    LOLLIPOP_STEM_WIDTH,
    Y_GRIDLINE_TICK_COUNT,
    Y_AXIS_TICK_COUNT,
    DATA_LABEL_OFFSET_Y,
    Y_TICK_LABEL_OFFSET,
    X_TICK_LABEL_OFFSET,
    X_LABEL_MAX_CHARS,
    X_LABEL_ROTATE_90_MARGIN,
    X_LABEL_ROTATE_45_MARGIN,
} from "../constants";

/* ── Scale type aliases ── */
type XScale = ScaleBand<string>;
type YScale = ScaleLinear<number, number>;
type GSelection = Selection<SVGGElement, unknown, null, undefined>;

/* ── Clip path ID prefix ── */
const CLIP_ID_PREFIX = "trellis-clip-";

/* ── Public API ── */

/** Render chart content into a panel's SVG element */
export function renderChart(
    svg: SVGSVGElement,
    panel: TrellisPanel,
    width: number,
    height: number,
    yMin: number,
    yMax: number,
    cfg: RenderConfig,
    callbacks: PanelCallbacks,
): void {
    const d3svg = select(svg);
    d3svg.selectAll("*").remove();

    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    /* Empty panel */
    if (panel.dataPoints.length === 0) {
        d3svg
            .append("text")
            .attr("class", "trellis-no-data")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", cfg.axis.axisFontColor)
            .attr("font-size", `${cfg.axis.axisFontSize}px`)
            .text("No data");
        return;
    }

    /* ── Compute margins ── */
    const ml = cfg.axis.showYAxis ? Y_AXIS_WIDTH + PANEL_MARGIN.left : PANEL_MARGIN.left;
    const mr = PANEL_MARGIN.right;
    const mt = PANEL_MARGIN.top;
    const mb = cfg.axis.showXAxis ? X_AXIS_HEIGHT + PANEL_MARGIN.bottom : PANEL_MARGIN.bottom;

    const xLabelRotation = Number(cfg.axis.xLabelRotation);
    const extraXMargin = xLabelRotation === 90 ? X_LABEL_ROTATE_90_MARGIN
        : xLabelRotation === 45 ? X_LABEL_ROTATE_45_MARGIN : 0;
    const plotW = Math.max(10, width - ml - mr);
    const plotH = Math.max(10, height - mt - mb - extraXMargin);

    /* ── Scales ── */
    const xScale: XScale = scaleBand<string>()
        .domain(panel.categories as string[])
        .range([0, plotW])
        .padding(0.15);

    const yScale: YScale = scaleLinear()
        .domain([yMin, yMax])
        .range([plotH, 0])
        .nice();

    /* ── Clip path to prevent content overflow ── */
    /* Extend clip rect upward by the data-label font size so labels
       positioned just above the top bar are not cut off, while still
       preventing them from bleeding into the title bar. */
    const labelOverflow = cfg.labels.showDataLabels
        ? cfg.labels.dataLabelFontSize + DATA_LABEL_OFFSET_Y
        : 0;
    const clipId = `${CLIP_ID_PREFIX}${panel.trellisValue.replace(/\s+/g, "-")}`;
    d3svg.append("defs")
        .append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", 0)
        .attr("y", -labelOverflow)
        .attr("width", plotW)
        .attr("height", plotH + labelOverflow);

    /* ── Chart group ── */
    const g = d3svg
        .append("g")
        .attr("transform", `translate(${ml},${mt})`);

    /* ── Plot content group (clipped) ── */
    const plotG = g.append("g")
        .attr("clip-path", `url(#${clipId})`);

    /* ── Gridlines ── */
    if (cfg.axis.showYGridlines) {
        const ticks = yScale.ticks(Y_GRIDLINE_TICK_COUNT);
        plotG.selectAll<SVGLineElement, number>(".trellis-ygrid")
            .data(ticks)
            .join("line")
            .attr("class", "trellis-ygrid")
            .attr("x1", 0)
            .attr("x2", plotW)
            .attr("y1", d => yScale(d))
            .attr("y2", d => yScale(d))
            .attr("stroke", cfg.axis.gridlineColor)
            .attr("stroke-width", 0.5);
    }

    if (cfg.axis.showXGridlines) {
        plotG.selectAll<SVGLineElement, string>(".trellis-xgrid")
            .data(panel.categories as string[])
            .join("line")
            .attr("class", "trellis-xgrid")
            .attr("x1", cat => (xScale(cat) ?? 0) + xScale.bandwidth() / 2)
            .attr("x2", cat => (xScale(cat) ?? 0) + xScale.bandwidth() / 2)
            .attr("y1", 0)
            .attr("y2", plotH)
            .attr("stroke", cfg.axis.gridlineColor)
            .attr("stroke-width", 0.5);
    }

    /* ── Render chart type ── */
    const chartType = cfg.chart.chartType;
    if (chartType === "bar") {
        renderBars(plotG, panel, xScale, yScale, cfg, callbacks);
    } else if (chartType === "line") {
        renderLines(plotG, panel, xScale, yScale, cfg, callbacks);
    } else if (chartType === "area") {
        renderAreas(plotG, panel, xScale, yScale, cfg, callbacks);
    } else if (chartType === "lollipop") {
        renderLollipops(plotG, panel, xScale, yScale, cfg, callbacks);
    }

    /* ── Data labels (rendered inside clipped group to prevent overflow) ── */
    if (cfg.labels.showDataLabels) {
        renderDataLabels(plotG, panel, xScale, yScale, plotH, plotW, cfg);
    }

    /* ── Axes ── */
    if (cfg.axis.showXAxis) {
        renderXAxis(g, panel.categories as string[], xScale, plotH, cfg);
    }

    if (cfg.axis.showYAxis) {
        renderYAxis(g, yScale, cfg);
    }
}

/* ── Bar Renderer ── */

function renderBars(
    g: GSelection,
    panel: TrellisPanel,
    xScale: XScale,
    yScale: YScale,
    cfg: RenderConfig,
    callbacks: PanelCallbacks,
): void {
    const hasSeries = panel.seriesNames.length > 0;
    const seriesKeys = hasSeries
        ? Array.from(panel.seriesBuckets.keys())
        : ["__default__"];
    const seriesCount = seriesKeys.length;
    const bandwidth = xScale.bandwidth();
    const barWidth = Math.max(MIN_BAR_WIDTH, bandwidth / seriesCount);

    for (let si = 0; si < seriesKeys.length; si++) {
        const sKey = seriesKeys[si];
        const points = panel.seriesBuckets.get(sKey) ?? [];

        for (const pt of points) {
            const x0 = xScale(pt.categoryValue) ?? 0;
            const xPos = x0 + si * barWidth;
            const yPos = yScale(Math.max(0, pt.value));
            const barH = Math.abs(yScale(pt.value) - yScale(0));

            g.append("rect")
                .attr("class", "trellis-bar")
                .attr("x", xPos)
                .attr("y", yPos)
                .attr("width", Math.max(MIN_BAR_WIDTH, barWidth - 1))
                .attr("height", Math.max(0, barH))
                .attr("rx", cfg.chart.barCornerRadius)
                .attr("ry", cfg.chart.barCornerRadius)
                .attr("fill", pt.color)
                .attr("data-sid", pt.selectionId.getKey() as string)
                .style("cursor", "pointer")
                .on("click", (event: MouseEvent) => callbacks.onClick(pt, event))
                .on("mouseover", function (event: MouseEvent) {
                    select(this).attr("opacity", BAR_HOVER_OPACITY);
                    const rect = (event.target as Element).getBoundingClientRect();
                    callbacks.onMouseOver(pt, rect.left + rect.width / 2, rect.top, event);
                })
                .on("mousemove", function (event: MouseEvent) {
                    const rect = (event.target as Element).getBoundingClientRect();
                    callbacks.onMouseMove(pt, rect.left + rect.width / 2, rect.top, event);
                })
                .on("mouseout", function () {
                    select(this).attr("opacity", 1);
                    callbacks.onMouseOut();
                });
        }
    }
}

/* ── Line Renderer ── */

function renderLines(
    g: GSelection,
    panel: TrellisPanel,
    xScale: XScale,
    yScale: YScale,
    cfg: RenderConfig,
    callbacks: PanelCallbacks,
): void {
    const curveType = cfg.chart.lineSmoothing ? curveMonotoneX : curveLinear;
    const seriesKeys = panel.seriesBuckets.size > 0
        ? Array.from(panel.seriesBuckets.keys())
        : ["__default__"];

    for (const sKey of seriesKeys) {
        const points = panel.seriesBuckets.get(sKey) ?? [];
        if (points.length === 0) continue;

        const lineColor = points[0].color;

        const lineGen = d3Line<TrellisDataPoint>()
            .x(d => (xScale(d.categoryValue) ?? 0) + xScale.bandwidth() / 2)
            .y(d => yScale(d.value))
            .curve(curveType);

        /* Sort points by category order */
        const sorted = [...points].sort(
            (a, b) => panel.categories.indexOf(a.categoryValue) - panel.categories.indexOf(b.categoryValue),
        );

        g.append("path")
            .attr("class", "trellis-line")
            .attr("d", lineGen(sorted) ?? "")
            .attr("fill", "none")
            .attr("stroke", lineColor)
            .attr("stroke-width", cfg.chart.lineWidth);

        /* Dots */
        if (cfg.chart.dotRadius > 0) {
            renderDots(g, sorted, xScale, yScale, lineColor, cfg, callbacks);
        }
    }
}

/* ── Area Renderer ── */

function renderAreas(
    g: GSelection,
    panel: TrellisPanel,
    xScale: XScale,
    yScale: YScale,
    cfg: RenderConfig,
    callbacks: PanelCallbacks,
): void {
    const curveType = cfg.chart.lineSmoothing ? curveMonotoneX : curveLinear;
    const seriesKeys = panel.seriesBuckets.size > 0
        ? Array.from(panel.seriesBuckets.keys())
        : ["__default__"];

    for (const sKey of seriesKeys) {
        const points = panel.seriesBuckets.get(sKey) ?? [];
        if (points.length === 0) continue;

        const areaColor = points[0].color;

        const sorted = [...points].sort(
            (a, b) => panel.categories.indexOf(a.categoryValue) - panel.categories.indexOf(b.categoryValue),
        );

        /* Area fill */
        const areaGen = d3Area<TrellisDataPoint>()
            .x(d => (xScale(d.categoryValue) ?? 0) + xScale.bandwidth() / 2)
            .y0(yScale(0))
            .y1(d => yScale(d.value))
            .curve(curveType);

        g.append("path")
            .attr("class", "trellis-area")
            .attr("d", areaGen(sorted) ?? "")
            .attr("fill", hexToRgba(areaColor, cfg.chart.areaOpacity))
            .attr("stroke", "none");

        /* Stroke line on top */
        const lineGen = d3Line<TrellisDataPoint>()
            .x(d => (xScale(d.categoryValue) ?? 0) + xScale.bandwidth() / 2)
            .y(d => yScale(d.value))
            .curve(curveType);

        g.append("path")
            .attr("class", "trellis-area-line")
            .attr("d", lineGen(sorted) ?? "")
            .attr("fill", "none")
            .attr("stroke", areaColor)
            .attr("stroke-width", cfg.chart.lineWidth);

        /* Dots */
        if (cfg.chart.dotRadius > 0) {
            renderDots(g, sorted, xScale, yScale, areaColor, cfg, callbacks);
        }
    }
}

/* ── Lollipop Renderer ── */

function renderLollipops(
    g: GSelection,
    panel: TrellisPanel,
    xScale: XScale,
    yScale: YScale,
    cfg: RenderConfig,
    callbacks: PanelCallbacks,
): void {
    const hasSeries = panel.seriesNames.length > 0;
    const seriesKeys = hasSeries
        ? Array.from(panel.seriesBuckets.keys())
        : ["__default__"];
    const seriesCount = seriesKeys.length;
    const bandwidth = xScale.bandwidth();
    const stemSpacing = bandwidth / seriesCount;

    for (let si = 0; si < seriesKeys.length; si++) {
        const sKey = seriesKeys[si];
        const points = panel.seriesBuckets.get(sKey) ?? [];

        for (const pt of points) {
            const x0 = xScale(pt.categoryValue) ?? 0;
            const cx = x0 + si * stemSpacing + stemSpacing / 2;
            const cy = yScale(pt.value);
            const yBase = yScale(0);

            /* Stem */
            g.append("line")
                .attr("class", "trellis-lollipop-stem")
                .attr("x1", cx)
                .attr("x2", cx)
                .attr("y1", yBase)
                .attr("y2", cy)
                .attr("stroke", pt.color)
                .attr("stroke-width", LOLLIPOP_STEM_WIDTH);

            /* Dot */
            g.append("circle")
                .attr("class", "trellis-lollipop-dot")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", cfg.chart.dotRadius)
                .attr("fill", pt.color)
                .attr("data-sid", pt.selectionId.getKey() as string)
                .style("cursor", "pointer")
                .on("click", (event: MouseEvent) => callbacks.onClick(pt, event))
                .on("mouseover", function (event: MouseEvent) {
                    select(this).attr("r", cfg.chart.dotRadius * DOT_HOVER_SCALE);
                    const rect = (event.target as Element).getBoundingClientRect();
                    callbacks.onMouseOver(pt, rect.left + rect.width / 2, rect.top, event);
                })
                .on("mousemove", function (event: MouseEvent) {
                    const rect = (event.target as Element).getBoundingClientRect();
                    callbacks.onMouseMove(pt, rect.left + rect.width / 2, rect.top, event);
                })
                .on("mouseout", function () {
                    select(this).attr("r", cfg.chart.dotRadius);
                    callbacks.onMouseOut();
                });
        }
    }

}

/* ── Shared Dot Renderer (Line / Area) ── */

function renderDots(
    g: GSelection,
    points: TrellisDataPoint[],
    xScale: XScale,
    yScale: YScale,
    dotColor: string,
    cfg: RenderConfig,
    callbacks: PanelCallbacks,
): void {
    for (const pt of points) {
        const cx = (xScale(pt.categoryValue) ?? 0) + xScale.bandwidth() / 2;
        const cy = yScale(pt.value);
        g.append("circle")
            .attr("class", "trellis-dot")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", cfg.chart.dotRadius)
            .attr("fill", dotColor)
            .attr("data-sid", pt.selectionId.getKey() as string)
            .style("cursor", "pointer")
            .on("click", (event: MouseEvent) => callbacks.onClick(pt, event))
            .on("mouseover", function (event: MouseEvent) {
                select(this).attr("r", cfg.chart.dotRadius * DOT_HOVER_SCALE);
                const rect = (event.target as Element).getBoundingClientRect();
                callbacks.onMouseOver(pt, rect.left + rect.width / 2, rect.top, event);
            })
            .on("mousemove", function (event: MouseEvent) {
                const rect = (event.target as Element).getBoundingClientRect();
                callbacks.onMouseMove(pt, rect.left + rect.width / 2, rect.top, event);
            })
            .on("mouseout", function () {
                select(this).attr("r", cfg.chart.dotRadius);
                callbacks.onMouseOut();
            });
    }
}

/* ── Data Labels ── */

function renderDataLabels(
    g: GSelection,
    panel: TrellisPanel,
    xScale: XScale,
    yScale: YScale,
    plotH: number,
    plotW: number,
    cfg: RenderConfig,
): void {
    const fontSize = cfg.labels.dataLabelFontSize;
    /* Approximate half-width of a label for horizontal clamping */
    const estHalfWidth = fontSize * 2;

    for (const pt of panel.dataPoints) {
        const rawX = (xScale(pt.categoryValue) ?? 0) + xScale.bandwidth() / 2;
        /* Clamp label within the plot area horizontally */
        const cx = Math.max(estHalfWidth, Math.min(rawX, plotW - estHalfWidth));
        /* Clamp label within the plot area vertically */
        const rawY = yScale(pt.value) - DATA_LABEL_OFFSET_Y;
        const cy = Math.max(fontSize, Math.min(rawY, plotH - DATA_LABEL_OFFSET_Y));

        g.append("text")
            .attr("class", "trellis-data-label")
            .attr("x", cx)
            .attr("y", cy)
            .attr("text-anchor", "middle")
            .attr("fill", cfg.labels.dataLabelFontColor)
            .attr("font-size", `${fontSize}px`)
            .text(formatValue(pt.value));
    }
}

/* ── X Axis ── */

function renderXAxis(
    g: GSelection,
    categories: string[],
    xScale: XScale,
    plotH: number,
    cfg: RenderConfig,
): void {
    const rotation = Number(cfg.axis.xLabelRotation);
    const axisG = g.append("g")
        .attr("class", "trellis-x-axis")
        .attr("transform", `translate(0,${plotH})`);

    /* Axis line */
    axisG.append("line")
        .attr("x1", 0)
        .attr("x2", xScale.range()[1])
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", cfg.axis.gridlineColor);

    for (const cat of categories) {
        const cx = (xScale(cat) ?? 0) + xScale.bandwidth() / 2;
        const label = axisG.append("text")
            .attr("x", cx)
            .attr("y", X_TICK_LABEL_OFFSET)
            .attr("fill", cfg.axis.axisFontColor)
            .attr("font-size", `${cfg.axis.axisFontSize}px`)
            .attr("text-anchor", rotation === 0 ? "middle" : "end")
            .attr("dominant-baseline", "central")
            .text(truncate(cat, X_LABEL_MAX_CHARS));

        if (rotation !== 0) {
            label.attr("transform", `rotate(-${rotation}, ${cx}, ${X_TICK_LABEL_OFFSET})`);
        }
    }
}

/* ── Y Axis ── */

function renderYAxis(
    g: GSelection,
    yScale: YScale,
    cfg: RenderConfig,
): void {
    const ticks = yScale.ticks(Y_AXIS_TICK_COUNT);
    const axisG = g.append("g").attr("class", "trellis-y-axis");

    /* Axis line */
    axisG.append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", yScale.range()[0])
        .attr("y2", yScale.range()[1])
        .attr("stroke", cfg.axis.gridlineColor);

    for (const t of ticks) {
        const y = yScale(t);
        axisG.append("text")
            .attr("x", -Y_TICK_LABEL_OFFSET)
            .attr("y", y)
            .attr("fill", cfg.axis.axisFontColor)
            .attr("font-size", `${cfg.axis.axisFontSize}px`)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .text(formatAxisTick(t));
    }
}
