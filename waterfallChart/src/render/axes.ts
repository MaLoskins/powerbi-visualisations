/* ═══════════════════════════════════════════════
   WaterfallChart - Axes Renderer
   X-axis (categories), Y-axis (values), gridlines
   ═══════════════════════════════════════════════ */

"use strict";

import { Selection } from "d3-selection";
import { scaleBand, scaleLinear, ScaleBand, ScaleLinear } from "d3-scale";
import { WaterfallBar, RenderConfig } from "../types";
import { CSS_PREFIX, FONT_STACK, MAX_AXIS_LABEL_CHARS, X_AXIS_LABEL_MAX_WIDTH_FRACTION } from "../constants";

type SVGSel = Selection<SVGGElement, unknown, null, undefined>;

export interface AxisScales {
    categoryScale: ScaleBand<string>;
    valueScale: ScaleLinear<number, number>;
}

/** Build d3 scales for the chart. */
export function buildScales(
    bars: WaterfallBar[],
    valueDomain: [number, number],
    plotWidth: number,
    plotHeight: number,
    cfg: RenderConfig,
): AxisScales {
    const categories = bars.map((b) => b.category);
    const isVertical = cfg.chart.orientation === "vertical";

    const categoryScale = scaleBand<string>()
        .domain(categories)
        .range(isVertical ? [0, plotWidth] : [0, plotHeight])
        .padding(1 - cfg.chart.barWidthFraction);

    const valueScale = scaleLinear()
        .domain(valueDomain)
        .range(isVertical ? [plotHeight, 0] : [0, plotWidth])
        .nice();

    return { categoryScale, valueScale };
}

/**
 * Compute a dynamic max-character limit for axis labels based on available
 * space per category and the font size. Falls back to MAX_AXIS_LABEL_CHARS
 * when the computed limit is larger.
 */
function dynamicMaxChars(bandwidth: number, fontSize: number, rotation: number): number {
    /* Approximate character width as 0.55 * fontSize for the Segoe UI stack */
    const charWidth = fontSize * 0.55;
    /* When labels are rotated the available length along the text direction grows */
    const availablePx = rotation > 0
        ? bandwidth / Math.sin((Math.min(rotation, 89) * Math.PI) / 180)
        : bandwidth;
    const computed = Math.max(3, Math.floor(availablePx / charWidth));
    return Math.min(computed, MAX_AXIS_LABEL_CHARS);
}

/** Render X-axis ticks and labels. */
export function renderXAxis(
    g: SVGSel,
    scales: AxisScales,
    plotHeight: number,
    plotWidth: number,
    cfg: RenderConfig,
): void {
    g.selectAll("*").remove();
    if (!cfg.axis.showXAxis) return;

    const isVertical = cfg.chart.orientation === "vertical";
    const categories = scales.categoryScale.domain();
    const rotation = parseInt(cfg.axis.xLabelRotation, 10);
    const bandwidth = scales.categoryScale.bandwidth();
    const maxChars = dynamicMaxChars(bandwidth, cfg.axis.axisFontSize, rotation);

    /*
     * Compute a maximum pixel width for each label to prevent overflow.
     * For rotated labels the available height constrains text length;
     * for horizontal labels the bandwidth is the constraint.
     */
    const axisDimension = isVertical ? plotWidth : plotHeight;
    const maxLabelPx = rotation > 0
        ? axisDimension * X_AXIS_LABEL_MAX_WIDTH_FRACTION
        : Math.max(bandwidth, 20);

    g.attr("transform", isVertical ? `translate(0,${plotHeight})` : `translate(0,0)`);

    for (const cat of categories) {
        const pos = (scales.categoryScale(cat) ?? 0) + bandwidth / 2;
        const tickG = g.append("g")
            .attr("class", `${CSS_PREFIX}x-tick`)
            .attr("transform", isVertical ? `translate(${pos},0)` : `translate(0,${pos})`);

        tickG.append("line")
            .attr("y2", isVertical ? 6 : 0)
            .attr("x2", isVertical ? 0 : -6)
            .attr("stroke", cfg.axis.axisFontColor);

        const displayText = truncateLabel(cat, maxChars);

        const textEl = tickG.append("text")
            .attr("dy", isVertical ? "1em" : "0.35em")
            .attr("y", isVertical ? 6 : 0)
            .attr("x", isVertical ? 0 : -8)
            .attr("text-anchor", () => {
                if (!isVertical) return "end";
                if (rotation > 0) return "end";
                return "middle";
            })
            .attr("font-size", cfg.axis.axisFontSize + "px")
            .attr("font-family", FONT_STACK)
            .attr("fill", cfg.axis.axisFontColor)
            .text(displayText);

        /* Add a <title> for the full text on hover when truncated */
        if (displayText !== cat) {
            textEl.append("title").text(cat);
        }

        if (isVertical && rotation > 0) {
            textEl.attr("transform", `rotate(-${rotation})`);
        }

        /*
         * SVG pixel-level truncation: after rendering, if the text element
         * exceeds the computed maximum width, iteratively trim characters
         * until it fits, appending an ellipsis. This catches cases where
         * dynamic char-count truncation still overflows (e.g. wide characters).
         */
        const node = textEl.node();
        if (node && typeof node.getComputedTextLength === "function") {
            let actualLen = node.getComputedTextLength();
            let txt = node.textContent ?? "";
            if (actualLen > maxLabelPx && txt.length > 1) {
                while (txt.length > 1 && actualLen > maxLabelPx) {
                    txt = txt.slice(0, -2) + "\u2026";
                    node.textContent = txt;
                    actualLen = node.getComputedTextLength();
                }
                /* Ensure tooltip exists when pixel-truncated */
                if (!textEl.select("title").node()) {
                    textEl.append("title").text(cat);
                }
            }
        }
    }
}

/** Render Y-axis ticks and labels. */
export function renderYAxis(
    g: SVGSel,
    scales: AxisScales,
    cfg: RenderConfig,
): void {
    g.selectAll("*").remove();
    if (!cfg.axis.showYAxis) return;

    const isVertical = cfg.chart.orientation === "vertical";
    const scale = scales.valueScale;
    const ticks = scale.ticks(6);

    for (const tick of ticks) {
        const pos = scale(tick);
        const tickG = g.append("g")
            .attr("class", `${CSS_PREFIX}y-tick`)
            .attr("transform", isVertical ? `translate(0,${pos})` : `translate(${pos},0)`);

        tickG.append("line")
            .attr("x2", isVertical ? -6 : 0)
            .attr("y2", isVertical ? 0 : -6)
            .attr("stroke", cfg.axis.axisFontColor);

        const tickLabel = formatAxisTick(tick);
        tickG.append("text")
            .attr("x", isVertical ? -8 : 0)
            .attr("y", isVertical ? 0 : -8)
            .attr("dy", isVertical ? "0.35em" : "0")
            .attr("text-anchor", isVertical ? "end" : "middle")
            .attr("font-size", cfg.axis.axisFontSize + "px")
            .attr("font-family", FONT_STACK)
            .attr("fill", cfg.axis.axisFontColor)
            .text(truncateLabel(tickLabel, MAX_AXIS_LABEL_CHARS));
    }
}

/** Render horizontal or vertical gridlines. */
export function renderGridlines(
    g: SVGSel,
    scales: AxisScales,
    plotWidth: number,
    plotHeight: number,
    cfg: RenderConfig,
): void {
    g.selectAll("*").remove();
    if (!cfg.axis.showGridlines) return;

    const isVertical = cfg.chart.orientation === "vertical";
    const scale = scales.valueScale;
    const ticks = scale.ticks(6);

    g.selectAll<SVGLineElement, number>(`.${CSS_PREFIX}gridline`)
        .data(ticks)
        .join("line")
        .attr("class", `${CSS_PREFIX}gridline`)
        .attr("x1", (d) => (isVertical ? 0 : scale(d)))
        .attr("x2", (d) => (isVertical ? plotWidth : scale(d)))
        .attr("y1", (d) => (isVertical ? scale(d) : 0))
        .attr("y2", (d) => (isVertical ? scale(d) : plotHeight))
        .attr("stroke", cfg.axis.gridlineColor)
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,2");
}

/** Render the zero baseline. */
export function renderBaseline(
    g: SVGSel,
    scales: AxisScales,
    plotWidth: number,
    plotHeight: number,
    cfg: RenderConfig,
): void {
    g.selectAll("*").remove();
    if (!cfg.axis.showBaselineLine) return;

    const isVertical = cfg.chart.orientation === "vertical";
    const zeroPos = scales.valueScale(0);

    g.append("line")
        .attr("class", `${CSS_PREFIX}baseline`)
        .attr("x1", isVertical ? 0 : zeroPos)
        .attr("x2", isVertical ? plotWidth : zeroPos)
        .attr("y1", isVertical ? zeroPos : 0)
        .attr("y2", isVertical ? zeroPos : plotHeight)
        .attr("stroke", cfg.axis.baselineColor)
        .attr("stroke-width", 1);
}

/** Truncate a label string to maxChars, appending ellipsis if needed. */
function truncateLabel(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1).trimEnd() + "\u2026";
}

/** Simple axis tick formatter. */
function formatAxisTick(val: number): string {
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(val);
}
