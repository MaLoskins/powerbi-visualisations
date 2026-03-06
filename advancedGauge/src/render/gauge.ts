/* ═══════════════════════════════════════════════
   Advanced Gauge – Gauge Renderer
   Arc segments, needle, ticks, target marker
   ═══════════════════════════════════════════════ */
"use strict";

import { select, Selection } from "d3-selection";
import { arc as d3Arc, Arc } from "d3-shape";
import "d3-transition"; /* side-effect: adds .transition() to Selection prototype */
import { easeCubicOut } from "d3-ease";
import type { RenderConfig, GaugeData, GaugeLayout, GaugeCallbacks } from "../types";
import { DEG_TO_RAD, GAUGE_MARGIN, CSS_PREFIX } from "../constants";
import { hexToRgba } from "../utils/color";
import { clamp } from "../utils/dom";

/**
 * Constrain an SVG text element to a maximum pixel width.
 * Compresses glyphs via SVG textLength; leaves the element untouched if already narrow enough.
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

/** Shorthand for a d3 selection rooted on an SVG group */
type GSelection = Selection<SVGGElement, unknown, null, undefined>;

/** Arc datum with only the angles (inner/outer radius set on the generator) */
interface ArcDatum { startAngle: number; endAngle: number; }

/** Shorthand for the configured arc generator */
type ArcGen = Arc<unknown, ArcDatum>;

/* ── Layout computation ── */

/**
 * Compute the gauge centre and radius to fit within the given viewport,
 * reserving space for title and min/max labels.
 */
export function computeGaugeLayout(
    width: number,
    height: number,
    cfg: RenderConfig,
): GaugeLayout {
    const startDeg = cfg.gauge.startAngle;
    const endDeg = cfg.gauge.endAngle;
    const startRad = startDeg * DEG_TO_RAD;
    const endRad = endDeg * DEG_TO_RAD;

    /* Reserve vertical space for title above and min/max labels below */
    let topReserve = GAUGE_MARGIN;
    if (cfg.labels.showTitle && cfg.labels.titleText) {
        topReserve += cfg.labels.titleFontSize + 8;
    }
    let bottomReserve = GAUGE_MARGIN;
    if (cfg.labels.showMinMaxLabels) {
        bottomReserve += cfg.labels.minMaxFontSize + 6;
    }
    if (cfg.ticks.showTickLabels) {
        bottomReserve = Math.max(bottomReserve, GAUGE_MARGIN + cfg.ticks.tickLabelFontSize + 10);
    }

    const availW = width - GAUGE_MARGIN * 2;
    const availH = height - topReserve - bottomReserve;

    /* Compute bounding box of the arc to find optimal radius.
       The arc sweeps from startRad to endRad (measuring from -Y axis, clockwise). 
       We convert to standard math angles to find extents. */
    const sampleAngles = [startRad, endRad];
    // Add cardinal directions if they fall within the sweep
    for (let a = -Math.PI; a <= Math.PI; a += Math.PI / 2) {
        if (isAngleInSweep(a, startRad, endRad)) sampleAngles.push(a);
    }

    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const a of sampleAngles) {
        const x = Math.sin(a); // SVG convention: angle measured clockwise from top
        const y = -Math.cos(a);
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
    }

    const arcW = xMax - xMin || 1;
    const arcH = yMax - yMin || 1;

    const maxRadius = Math.min(availW / arcW, availH / arcH);
    const outerRadius = Math.max(20, maxRadius);
    const innerRadius = Math.max(10, outerRadius - cfg.gauge.arcThickness);

    /* Centre the arc within available space */
    const cx = width / 2 - ((xMax + xMin) / 2) * outerRadius;
    const cy = topReserve + availH / 2 - ((yMax + yMin) / 2) * outerRadius;

    return { cx, cy, outerRadius, innerRadius, startAngleRad: startRad, endAngleRad: endRad };
}

/* ── Main render function ── */

/**
 * Render the complete gauge into the given SVG element.
 */
export function renderGauge(
    svg: SVGSVGElement,
    data: GaugeData,
    layout: GaugeLayout,
    cfg: RenderConfig,
    callbacks: GaugeCallbacks,
    isFirstRender: boolean,
): void {
    const d3svg = select(svg);
    d3svg.selectAll("*").remove();

    const { cx, cy, outerRadius, innerRadius, startAngleRad, endAngleRad } = layout;
    const totalSweep = endAngleRad - startAngleRad;

    const g = d3svg.append("g")
        .attr("transform", `translate(${cx},${cy})`)
        .attr("class", CSS_PREFIX + "main-group");

    /* ── Helper: value → angle ── */
    function valueToAngle(v: number): number {
        const range = data.maxValue - data.minValue;
        const ratio = range === 0 ? 0.5 : clamp((v - data.minValue) / range, 0, 1);
        return startAngleRad + ratio * totalSweep;
    }

    /* ── Arc generator ── */
    const arcGen: ArcGen = (d3Arc<unknown, ArcDatum>() as ArcGen)
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .cornerRadius(cfg.gauge.arcCornerRadius);

    /* ── Background arc ── */
    g.append("path")
        .attr("class", CSS_PREFIX + "bg-arc")
        .attr("d", arcGen({ startAngle: startAngleRad, endAngle: endAngleRad }) ?? "")
        .attr("fill", hexToRgba(cfg.gauge.backgroundArcColor, cfg.gauge.backgroundArcOpacity));

    /* ── Inner edge highlight for depth ── */
    const innerHighlightGen: ArcGen = (d3Arc<unknown, ArcDatum>() as ArcGen)
        .innerRadius(innerRadius)
        .outerRadius(innerRadius + 1.5)
        .cornerRadius(0);
    g.append("path")
        .attr("class", CSS_PREFIX + "inner-edge")
        .attr("d", innerHighlightGen({ startAngle: startAngleRad, endAngle: endAngleRad }) ?? "")
        .attr("fill", hexToRgba("#000000", 0.04));

    /* ── Foreground: range bands or single bar ── */
    if (data.hasRanges) {
        renderRangeBands(g, data, cfg, arcGen, startAngleRad, endAngleRad, valueToAngle);
    } else {
        // Single bar from min to value with animation
        const valueAngle = valueToAngle(data.value);
        const valuePath = g.append("path")
            .attr("class", CSS_PREFIX + "value-arc")
            .attr("fill", cfg.colors.defaultBarColor);

        if (isFirstRender && cfg.needle.animationDuration > 0) {
            // Start from zero sweep and animate to target
            valuePath
                .attr("d", arcGen({ startAngle: startAngleRad, endAngle: startAngleRad }) ?? "")
                .transition()
                .duration(cfg.needle.animationDuration)
                .ease(easeCubicOut)
                .attrTween("d", function () {
                    return function (t: number) {
                        const interpAngle = startAngleRad + (valueAngle - startAngleRad) * t;
                        return arcGen({ startAngle: startAngleRad, endAngle: interpAngle }) ?? "";
                    };
                });
        } else {
            valuePath
                .attr("d", arcGen({ startAngle: startAngleRad, endAngle: valueAngle }) ?? "");
        }
    }

    /* ── Ticks ── */
    if (cfg.ticks.showTicks) {
        renderTicks(g, data, layout, cfg, valueToAngle);
    }

    /* ── Target marker ── */
    if (cfg.target.showTarget && data.target !== null) {
        renderTargetMarker(g, data, layout, cfg, valueToAngle);
    }

    /* ── Needle ── */
    if (cfg.needle.showNeedle) {
        renderNeedle(g, data, layout, cfg, valueToAngle, isFirstRender);
    }

    /* ── Interaction overlay ── */
    g.append("path")
        .attr("class", CSS_PREFIX + "hit-area")
        .attr("d", arcGen({ startAngle: startAngleRad, endAngle: endAngleRad }) ?? "")
        .attr("fill", "transparent")
        .attr("cursor", "pointer")
        .on("click", (event: MouseEvent) => callbacks.onClick(event))
        .on("mouseover", (event: MouseEvent) => {
            const rect = svg.getBoundingClientRect();
            callbacks.onMouseOver(event, event.clientX - rect.left, event.clientY - rect.top);
        })
        .on("mousemove", (event: MouseEvent) => {
            const rect = svg.getBoundingClientRect();
            callbacks.onMouseMove(event, event.clientX - rect.left, event.clientY - rect.top);
        })
        .on("mouseout", () => callbacks.onMouseOut());
}

/* ── Range Bands ── */

function renderRangeBands(
    g: GSelection,
    data: GaugeData,
    cfg: RenderConfig,
    arcGen: ArcGen,
    startAngleRad: number,
    endAngleRad: number,
    valueToAngle: (v: number) => number,
): void {
    interface Band {
        from: number;
        to: number;
        color: string;
    }

    const bands: Band[] = [];
    let cursor = data.minValue;

    if (data.range1Max !== null && data.range1Max > cursor) {
        bands.push({ from: cursor, to: Math.min(data.range1Max, data.maxValue), color: cfg.ranges.range1Color });
        cursor = data.range1Max;
    }
    if (data.range2Max !== null && data.range2Max > cursor) {
        bands.push({ from: cursor, to: Math.min(data.range2Max, data.maxValue), color: cfg.ranges.range2Color });
        cursor = data.range2Max;
    }
    if (data.range3Max !== null && data.range3Max > cursor) {
        bands.push({ from: cursor, to: Math.min(data.range3Max, data.maxValue), color: cfg.ranges.range3Color });
        cursor = data.range3Max;
    }
    // Fill beyond last range to maxValue
    if (cursor < data.maxValue) {
        bands.push({ from: cursor, to: data.maxValue, color: cfg.ranges.rangeBeyondColor });
    }

    for (const band of bands) {
        const sa = valueToAngle(band.from);
        const ea = valueToAngle(band.to);
        if (ea <= sa) continue;
        g.append("path")
            .attr("class", CSS_PREFIX + "range-arc")
            .attr("d", arcGen({ startAngle: sa, endAngle: ea }) ?? "")
            .attr("fill", band.color);
    }
}

/* ── Ticks ── */

function renderTicks(
    g: GSelection,
    data: GaugeData,
    layout: GaugeLayout,
    cfg: RenderConfig,
    valueToAngle: (v: number) => number,
): void {
    const { outerRadius } = layout;
    const count = cfg.ticks.tickCount;

    /* Scale tick length proportionally to gauge radius (cfg value treated as reference at r=100) */
    const scaledTickLength = Math.max(3, cfg.ticks.tickLength * (outerRadius / 100));
    /* Max width for tick labels: space between adjacent ticks, approximated */
    const maxTickLabelWidth = outerRadius * 0.5;

    for (let i = 0; i <= count; i++) {
        const v = data.minValue + (data.maxValue - data.minValue) * (i / count);
        const angle = valueToAngle(v);

        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        // SVG convention: angle from top, clockwise
        const x1 = sinA * outerRadius;
        const y1 = -cosA * outerRadius;
        const x2 = sinA * (outerRadius + scaledTickLength);
        const y2 = -cosA * (outerRadius + scaledTickLength);

        g.append("line")
            .attr("class", CSS_PREFIX + "tick")
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2)
            .attr("stroke", cfg.ticks.tickColor)
            .attr("stroke-width", cfg.ticks.tickWidth);

        if (cfg.ticks.showTickLabels) {
            const labelR = outerRadius + scaledTickLength + cfg.ticks.tickLabelFontSize * 0.6;
            const lx = sinA * labelR;
            const ly = -cosA * labelR;

            g.append("text")
                .attr("class", CSS_PREFIX + "tick-label")
                .attr("x", lx).attr("y", ly)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("fill", cfg.ticks.tickLabelFontColor)
                .attr("font-size", cfg.ticks.tickLabelFontSize + "px")
                .text(formatTickValue(v))
                .each(function () { truncateText(this as SVGTextElement, maxTickLabelWidth); });
        }
    }
}

function formatTickValue(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
    if (abs >= 10_000) return (v / 1_000).toFixed(1) + "K";
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(1);
}

/* ── Target Marker ── */

function renderTargetMarker(
    g: GSelection,
    data: GaugeData,
    layout: GaugeLayout,
    cfg: RenderConfig,
    valueToAngle: (v: number) => number,
): void {
    if (data.target === null) return;

    const angle = valueToAngle(data.target);
    const { outerRadius, innerRadius } = layout;
    const thickness = outerRadius - innerRadius;
    const markerLen = thickness * cfg.target.targetMarkerLength;

    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    // Marker extends inward from the outer edge
    const x1 = sinA * outerRadius;
    const y1 = -cosA * outerRadius;
    const x2 = sinA * (outerRadius - markerLen);
    const y2 = -cosA * (outerRadius - markerLen);

    g.append("line")
        .attr("class", CSS_PREFIX + "target-marker")
        .attr("x1", x1).attr("y1", y1)
        .attr("x2", x2).attr("y2", y2)
        .attr("stroke", cfg.target.targetMarkerColor)
        .attr("stroke-width", cfg.target.targetMarkerWidth)
        .attr("stroke-linecap", "round");

    if (cfg.target.showTargetLabel) {
        const labelR = outerRadius + cfg.target.targetLabelFontSize * 0.8 + 2;
        const lx = sinA * labelR;
        const ly = -cosA * labelR;
        const maxTargetLabelWidth = outerRadius * 0.5;

        g.append("text")
            .attr("class", CSS_PREFIX + "target-label")
            .attr("x", lx).attr("y", ly)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", cfg.target.targetLabelFontColor)
            .attr("font-size", cfg.target.targetLabelFontSize + "px")
            .text(formatTickValue(data.target))
            .each(function () { truncateText(this as SVGTextElement, maxTargetLabelWidth); });
    }
}

/* ── Needle ── */

function renderNeedle(
    g: GSelection,
    data: GaugeData,
    layout: GaugeLayout,
    cfg: RenderConfig,
    valueToAngle: (v: number) => number,
    isFirstRender: boolean,
): void {
    const angle = valueToAngle(data.value);
    const needleLen = layout.outerRadius * cfg.needle.needleLength;
    const halfBase = cfg.needle.needleWidth;
    const pivot = cfg.needle.pivotRadius;

    // Smooth tapered needle with a gentle curve
    // Defined pointing straight up (0°), then rotated via transform
    const tipY = -needleLen;
    const midY = -needleLen * 0.6;
    const needlePath = [
        `M 0,${tipY}`,                         // tip (sharp point)
        `Q ${halfBase * 0.4},${midY} ${halfBase},${pivot * 0.3}`,  // right curve
        `L ${halfBase * 0.6},${pivot * 0.5}`,   // right base taper
        `A ${pivot},${pivot} 0 0 1 ${-halfBase * 0.6},${pivot * 0.5}`, // base arc
        `L ${-halfBase},${pivot * 0.3}`,        // left base taper
        `Q ${-halfBase * 0.4},${midY} 0,${tipY}`, // left curve back to tip
        "Z",
    ].join(" ");

    const needleGroup = g.append("g")
        .attr("class", CSS_PREFIX + "needle-group");

    const startAngleDeg = isFirstRender && cfg.needle.animationDuration > 0
        ? layout.startAngleRad * (180 / Math.PI)
        : angle * (180 / Math.PI);

    needleGroup.attr("transform", `rotate(${startAngleDeg})`);

    // Needle body (path instead of polygon for smoother shape)
    needleGroup.append("path")
        .attr("class", CSS_PREFIX + "needle")
        .attr("d", needlePath)
        .attr("fill", cfg.needle.needleColor);

    // Pivot outer ring (subtle depth)
    needleGroup.append("circle")
        .attr("class", CSS_PREFIX + "needle-pivot-ring")
        .attr("cx", 0).attr("cy", 0)
        .attr("r", pivot + 1)
        .attr("fill", hexToRgba(cfg.needle.pivotColor, 0.3))
        .attr("stroke", "none");

    // Pivot circle
    needleGroup.append("circle")
        .attr("class", CSS_PREFIX + "needle-pivot")
        .attr("cx", 0).attr("cy", 0)
        .attr("r", pivot)
        .attr("fill", cfg.needle.pivotColor);

    // Pivot highlight dot (professional glossy effect)
    needleGroup.append("circle")
        .attr("cx", -pivot * 0.2).attr("cy", -pivot * 0.2)
        .attr("r", pivot * 0.3)
        .attr("fill", hexToRgba("#FFFFFF", 0.35))
        .attr("pointer-events", "none");

    // Animate to target angle with easing
    if (cfg.needle.animationDuration > 0 && startAngleDeg !== angle * (180 / Math.PI)) {
        needleGroup
            .transition()
            .duration(cfg.needle.animationDuration)
            .ease(easeCubicOut)
            .attr("transform", `rotate(${angle * (180 / Math.PI)})`);
    }
}

/* ── Angle helpers ── */

/** Check whether angle a lies within the clockwise sweep from start to end. */
function isAngleInSweep(a: number, start: number, end: number): boolean {
    // Normalise angles to [0, 2π)
    const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ns = norm(start);
    const ne = norm(end);
    const na = norm(a);
    if (ns <= ne) return na >= ns && na <= ne;
    return na >= ns || na <= ne;
}
