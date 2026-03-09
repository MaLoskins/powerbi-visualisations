/* ═══════════════════════════════════════════════
   Advanced Gauge – Label Renderer
   Value label, min/max labels, title
   ═══════════════════════════════════════════════ */
"use strict";

import { select } from "d3-selection";
import type { RenderConfig, GaugeData, GaugeLayout } from "../types";
import { CSS_PREFIX } from "../constants";
import { formatValue, formatMinMax } from "../utils/format";

/**
 * Constrain an SVG text element to a maximum pixel width.
 * Uses SVG's textLength attribute to compress glyphs; if the text is already
 * narrower than maxWidth the element is left untouched.
 */
function truncateText(node: SVGTextElement, maxWidth: number): void {
    if (maxWidth <= 0) return;
    try {
        const len = node.getComputedTextLength();
        if (len > maxWidth) {
            node.setAttribute("textLength", String(maxWidth));
            node.setAttribute("lengthAdjust", "spacingAndGlyphs");
        }
    } catch {
        /* getComputedTextLength may throw if the element is not yet in the DOM */
    }
}

/**
 * Determine the color for the value label based on which range the value falls in.
 * Returns the configured font color if no ranges, or the matching range color.
 */
function resolveValueLabelColor(data: GaugeData, cfg: RenderConfig): string {
    if (!data.hasRanges) return cfg.labels.valueFontColor;

    const v = data.value;
    if (data.range1Max !== null && v <= data.range1Max) return cfg.ranges.range1Color;
    if (data.range2Max !== null && v <= data.range2Max) return cfg.ranges.range2Color;
    if (data.range3Max !== null && v <= data.range3Max) return cfg.ranges.range3Color;
    return cfg.ranges.rangeBeyondColor;
}

/**
 * Render all text labels for the gauge.
 * Appends to the same SVG as the gauge arcs — positions are absolute (not relative to gauge group).
 */
export function renderLabels(
    svg: SVGSVGElement,
    data: GaugeData,
    layout: GaugeLayout,
    cfg: RenderConfig,
    locale: string,
): void {
    const d3svg = select(svg);
    const { cx, cy, outerRadius, innerRadius, startAngleRad, endAngleRad } = layout;

    /* ── Responsive font scaling: scale down if gauge is small ── */
    const gaugeSize = Math.min(outerRadius * 2, innerRadius * 3);
    const scaleFactor = Math.min(1, Math.max(0.5, gaugeSize / 200));

    /* ── Value Label (centred inside the arc) ── */
    if (cfg.labels.showValueLabel) {
        const formattedValue = formatValue(
            data.value,
            cfg.labels.valueFormat,
            data.minValue,
            data.maxValue,
            data.valueFormatString,
            locale,
        );

        /* Position value label in the center of the arc opening.
           For gauges with a bottom gap (typical 270° gauge), move label
           slightly upward so it sits visually centered in the arc bowl. */
        const midAngle = (startAngleRad + endAngleRad) / 2;
        const gapAngle = 2 * Math.PI - (endAngleRad - startAngleRad);
        const hasBottomGap = gapAngle > 0.3 && Math.abs(midAngle) < 0.1;
        const yOffset = hasBottomGap
            ? innerRadius * 0.35
            : 0;

        const effectiveFontSize = Math.round(cfg.labels.valueFontSize * scaleFactor);
        const valueColor = resolveValueLabelColor(data, cfg);

        /* Constrain value label width to inner diameter so it doesn't overflow */
        const maxValueWidth = innerRadius * 1.8;

        d3svg.append("text")
            .attr("class", CSS_PREFIX + "value-label")
            .attr("x", cx)
            .attr("y", cy + yOffset)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", valueColor)
            .attr("font-size", effectiveFontSize + "px")
            .attr("font-weight", "600")
            .attr("letter-spacing", "-0.01em")
            .text(formattedValue)
            .each(function () { truncateText(this as SVGTextElement, maxValueWidth); });
    }

    /* ── Min / Max Labels (at arc endpoints) ── */
    if (cfg.labels.showMinMaxLabels) {
        /* Proportional offset: ~5% of outer radius, clamped to a sensible range */
        const labelOffset = Math.max(4, Math.min(16, outerRadius * 0.05));
        const effectiveMinMaxSize = Math.round(cfg.labels.minMaxFontSize * scaleFactor);
        /* Max width for min/max labels: roughly half the gauge width */
        const maxMinMaxWidth = outerRadius * 0.7;

        // Min label (at start angle endpoint)
        const minSin = Math.sin(startAngleRad);
        const minCos = Math.cos(startAngleRad);
        const minX = cx + minSin * (outerRadius + labelOffset);
        const minY = cy - minCos * (outerRadius + labelOffset);

        // Anchor based on position relative to center
        const minAnchor = minSin < -0.1 ? "end" : minSin > 0.1 ? "start" : "middle";

        d3svg.append("text")
            .attr("class", CSS_PREFIX + "min-label")
            .attr("x", minX)
            .attr("y", minY + effectiveMinMaxSize * 0.5)
            .attr("text-anchor", minAnchor)
            .attr("fill", cfg.labels.minMaxFontColor)
            .attr("font-size", effectiveMinMaxSize + "px")
            .text(formatMinMax(data.minValue, locale))
            .each(function () { truncateText(this as SVGTextElement, maxMinMaxWidth); });

        // Max label (at end angle endpoint)
        const maxSin = Math.sin(endAngleRad);
        const maxCos = Math.cos(endAngleRad);
        const maxX = cx + maxSin * (outerRadius + labelOffset);
        const maxY = cy - maxCos * (outerRadius + labelOffset);

        const maxAnchor = maxSin > 0.1 ? "end" : maxSin < -0.1 ? "start" : "middle";

        d3svg.append("text")
            .attr("class", CSS_PREFIX + "max-label")
            .attr("x", maxX)
            .attr("y", maxY + effectiveMinMaxSize * 0.5)
            .attr("text-anchor", maxAnchor)
            .attr("fill", cfg.labels.minMaxFontColor)
            .attr("font-size", effectiveMinMaxSize + "px")
            .text(formatMinMax(data.maxValue, locale))
            .each(function () { truncateText(this as SVGTextElement, maxMinMaxWidth); });
    }

    /* ── Title (above the gauge) ── */
    if (cfg.labels.showTitle && cfg.labels.titleText) {
        const effectiveTitleSize = Math.round(cfg.labels.titleFontSize * scaleFactor);
        /* Constrain title to SVG viewport width minus some breathing room */
        const svgWidth = parseFloat(svg.getAttribute("width") || "0");
        const maxTitleWidth = Math.max(40, (svgWidth || outerRadius * 2) * 0.9);

        d3svg.append("text")
            .attr("class", CSS_PREFIX + "title")
            .attr("x", cx)
            .attr("y", effectiveTitleSize + 6)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "auto")
            .attr("fill", cfg.labels.titleFontColor)
            .attr("font-size", effectiveTitleSize + "px")
            .attr("font-weight", "600")
            .text(cfg.labels.titleText)
            .each(function () { truncateText(this as SVGTextElement, maxTitleWidth); });
    }
}
