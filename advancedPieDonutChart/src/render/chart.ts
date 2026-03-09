/*
 *  Advanced Pie / Donut Chart – Power BI Custom Visual
 *  render/chart.ts – Arc rendering, outer ring (sunburst), animation
 */
"use strict";

import { select, Selection } from "d3-selection";
import { arc as d3Arc, pie as d3Pie, PieArcDatum } from "d3-shape";
import "d3-transition";

import { PieSlice, OuterSlice, RenderConfig, ChartCallbacks } from "../types";
import { HOVER_SCALE } from "../constants";

/* ═══════════════════════════════════════════════
   Geometry (R2)
   ═══════════════════════════════════════════════ */

export interface ChartGeometry {
    cx: number;
    cy: number;
    outerRadius: number;
    innerRadius: number;
    outerRingOuterRadius: number;
    outerRingInnerRadius: number;
}

/** Compute chart geometry based on available space and config */
export function computeGeometry(
    width: number,
    height: number,
    cfg: RenderConfig,
    hasOuterRing: boolean,
): ChartGeometry {
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) / 2;

    let outerRadius: number;
    let outerRingOuterRadius = 0;
    let outerRingInnerRadius = 0;

    if (hasOuterRing && cfg.chart.showOuterRing) {
        const outerRingSpace = maxRadius * cfg.chart.outerRingThicknessFraction;
        outerRadius = maxRadius - outerRingSpace - 2;
        outerRingInnerRadius = outerRadius + 2;
        outerRingOuterRadius = maxRadius;
    } else {
        outerRadius = maxRadius;
    }

    const innerRadius = cfg.chart.chartType === "pie"
        ? 0
        : outerRadius * cfg.chart.innerRadiusFraction;

    return { cx, cy, outerRadius, innerRadius, outerRingOuterRadius, outerRingInnerRadius };
}

/* ═══════════════════════════════════════════════
   Types for arc animation storage
   ═══════════════════════════════════════════════ */

interface ArcAngles {
    startAngle: number;
    endAngle: number;
}

type SlicePathElement = SVGPathElement & { __prev?: ArcAngles };

/* ═══════════════════════════════════════════════
   Render Main Arcs
   ═══════════════════════════════════════════════ */

/** Render the main pie/donut arcs */
export function renderArcs(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    slices: PieSlice[],
    geom: ChartGeometry,
    cfg: RenderConfig,
    callbacks: ChartCallbacks,
): void {
    const g = svg.select<SVGGElement>(".apie-arcs-group");

    /* Pie layout */
    const pieGen = d3Pie<PieSlice>()
        .value((d: PieSlice) => d.value)
        .padAngle(cfg.chart.padAngle)
        .startAngle(cfg.chart.startAngle)
        .endAngle(cfg.chart.startAngle + Math.PI * 2)
        .sort(null);

    const arcGen = d3Arc<PieArcDatum<PieSlice>>()
        .innerRadius(geom.innerRadius)
        .outerRadius(geom.outerRadius)
        .cornerRadius(cfg.chart.cornerRadius);

    const pieData = pieGen(slices);

    /* Data join */
    const paths = g
        .selectAll<SVGPathElement, PieArcDatum<PieSlice>>(".apie-slice")
        .data(pieData, (d: PieArcDatum<PieSlice>) => d.data.category);

    /* Exit */
    paths.exit().remove();

    /* Enter */
    const enterPaths = paths
        .enter()
        .append("path")
        .attr("class", "apie-slice")
        .attr("data-category", (d: PieArcDatum<PieSlice>) => d.data.category)
        .each(function (this: SlicePathElement, d: PieArcDatum<PieSlice>) {
            this.__prev = { startAngle: d.startAngle, endAngle: d.startAngle };
        });

    /* Merge */
    const merged = enterPaths.merge(paths);

    if (cfg.animation.enableAnimation) {
        merged
            .transition()
            .duration(cfg.animation.animationDuration)
            .attrTween("d", function (this: SlicePathElement, d: PieArcDatum<PieSlice>): (t: number) => string {
                const prev = this.__prev || { startAngle: d.startAngle, endAngle: d.startAngle };
                const iStart = interpolateNum(prev.startAngle, d.startAngle);
                const iEnd = interpolateNum(prev.endAngle, d.endAngle);
                this.__prev = { startAngle: d.startAngle, endAngle: d.endAngle };
                return (t: number): string => {
                    const interp: PieArcDatum<PieSlice> = { ...d, startAngle: iStart(t), endAngle: iEnd(t) };
                    return arcGen(interp) || "";
                };
            })
            .attr("fill", (d: PieArcDatum<PieSlice>) => d.data.color);
    } else {
        merged
            .attr("d", (d: PieArcDatum<PieSlice>) => arcGen(d) || "")
            .attr("fill", (d: PieArcDatum<PieSlice>) => d.data.color);
        merged.each(function (this: SlicePathElement, d: PieArcDatum<PieSlice>) {
            this.__prev = { startAngle: d.startAngle, endAngle: d.endAngle };
        });
    }

    merged
        .attr("stroke", cfg.chart.arcStrokeColor)
        .attr("stroke-width", 1)
        .style("cursor", "pointer");

    /* Interaction */
    merged
        .on("click", function (this: SVGPathElement, event: MouseEvent, d: PieArcDatum<PieSlice>) {
            event.stopPropagation();
            callbacks.onSliceClick(d.data, event);
        })
        .on("mouseover", function (this: SVGPathElement, event: MouseEvent, d: PieArcDatum<PieSlice>) {
            select(this)
                .transition()
                .duration(150)
                .attr("transform", `scale(${HOVER_SCALE})`);
            callbacks.onSliceMouseOver(d.data, event);
        })
        .on("mousemove", function (this: SVGPathElement, event: MouseEvent, d: PieArcDatum<PieSlice>) {
            callbacks.onSliceMouseMove(d.data, event);
        })
        .on("mouseout", function (this: SVGPathElement) {
            select(this)
                .transition()
                .duration(150)
                .attr("transform", "scale(1)");
            callbacks.onSliceMouseOut();
        });
}

/* ═══════════════════════════════════════════════
   Render Outer Ring (Sunburst) (S2)
   ═══════════════════════════════════════════════ */

interface OuterArcDatum {
    startAngle: number;
    endAngle: number;
    data: OuterSlice;
}

export function renderOuterRing(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    slices: PieSlice[],
    geom: ChartGeometry,
    cfg: RenderConfig,
    callbacks: ChartCallbacks,
): void {
    const g = svg.select<SVGGElement>(".apie-outer-ring-group");
    g.selectAll("*").remove();

    if (!cfg.chart.showOuterRing || geom.outerRingOuterRadius <= 0) return;

    const pieGen = d3Pie<PieSlice>()
        .value((d: PieSlice) => d.value)
        .padAngle(cfg.chart.padAngle)
        .startAngle(cfg.chart.startAngle)
        .endAngle(cfg.chart.startAngle + Math.PI * 2)
        .sort(null);

    const pieData = pieGen(slices);

    const outerArcGen = d3Arc<OuterArcDatum>()
        .innerRadius(geom.outerRingInnerRadius)
        .outerRadius(geom.outerRingOuterRadius)
        .cornerRadius(Math.max(0, cfg.chart.cornerRadius - 1));

    const outerArcs: OuterArcDatum[] = [];

    for (const pd of pieData) {
        const slice = pd.data;
        if (slice.outerSlices.length === 0) continue;

        const parentAngleRange = pd.endAngle - pd.startAngle;
        const parentTotal = slice.outerSlices.reduce((sum: number, o: OuterSlice) => sum + o.value, 0);
        let curAngle = pd.startAngle;

        for (const os of slice.outerSlices) {
            const fraction = parentTotal > 0 ? os.value / parentTotal : 0;
            const endAngle = curAngle + parentAngleRange * fraction;
            outerArcs.push({ startAngle: curAngle, endAngle, data: os });
            curAngle = endAngle;
        }
    }

    g.selectAll<SVGPathElement, OuterArcDatum>(".apie-outer-slice")
        .data(outerArcs)
        .enter()
        .append("path")
        .attr("class", "apie-outer-slice")
        .attr("d", (d: OuterArcDatum) => outerArcGen(d) || "")
        .attr("fill", (d: OuterArcDatum) => d.data.color)
        .attr("stroke", cfg.chart.arcStrokeColor)
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("click", function (this: SVGPathElement, event: MouseEvent, d: OuterArcDatum) {
            event.stopPropagation();
            callbacks.onOuterSliceClick(d.data, event);
        })
        .on("mouseover", function (this: SVGPathElement, event: MouseEvent, d: OuterArcDatum) {
            callbacks.onSliceMouseOver(d.data, event);
        })
        .on("mousemove", function (this: SVGPathElement, event: MouseEvent, d: OuterArcDatum) {
            callbacks.onSliceMouseMove(d.data, event);
        })
        .on("mouseout", function (this: SVGPathElement) {
            callbacks.onSliceMouseOut();
        });
}

/* ═══════════════════════════════════════════════
   Background Click Target
   ═══════════════════════════════════════════════ */

export function renderBackground(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    width: number,
    height: number,
    callback: () => void,
): void {
    let bg = svg.select<SVGRectElement>(".apie-bg");
    if (bg.empty()) {
        bg = svg.insert("rect", ":first-child").attr("class", "apie-bg");
    }
    bg.attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("click", callback);
}

/* ═══════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════ */

function interpolateNum(a: number, b: number): (t: number) => number {
    return (t: number): number => a + (b - a) * t;
}

/** Get the pie arc data for labels (exported for use by labels.ts) */
export function getPieData(
    slices: PieSlice[],
    cfg: RenderConfig,
): PieArcDatum<PieSlice>[] {
    const pieGen = d3Pie<PieSlice>()
        .value((d: PieSlice) => d.value)
        .padAngle(cfg.chart.padAngle)
        .startAngle(cfg.chart.startAngle)
        .endAngle(cfg.chart.startAngle + Math.PI * 2)
        .sort(null);
    return pieGen(slices);
}
