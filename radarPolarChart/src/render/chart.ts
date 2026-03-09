/* ═══════════════════════════════════════════════
   Chart Renderer – data polygons & dots
   ═══════════════════════════════════════════════ */

"use strict";

import { Selection } from "d3-selection";
import { lineRadial, curveLinearClosed, curveCardinalClosed } from "d3-shape";
import {
    RadarData, RadarLayout, RenderConfig,
    RadarSeries, RadarDataPoint, ChartCallbacks,
} from "../types";
import { computeAxisMinMax, normaliseValue } from "../layout/radarScale";

type SVGSel = Selection<SVGGElement, unknown, null, undefined>;

/* ── Coordinate helpers ── */

interface PointXY { x: number; y: number; point: RadarDataPoint }

function computeSeriesCoords(
    series: RadarSeries,
    layout: RadarLayout,
    cfg: RenderConfig,
    axisMinMax: { min: number; max: number }[] | null,
): PointXY[] {
    const { cx, cy, spokeAngles, radialScale } = layout;
    const isPercentage = cfg.scale.scaleType === "percentage";
    const coords: PointXY[] = [];

    for (const p of series.points) {
        const angle = spokeAngles[p.axisIndex];
        let normVal: number;
        if (isPercentage && axisMinMax) {
            normVal = normaliseValue(p.value, axisMinMax[p.axisIndex]);
        } else {
            normVal = p.value;
        }
        const r = radialScale(normVal);
        coords.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            point: p,
        });
    }

    return coords;
}

/* ═══════════════════════════════════════════════
   Main render function
   ═══════════════════════════════════════════════ */

export function renderChart(
    gPolygons: SVGSel,
    gDots: SVGSel,
    data: RadarData,
    layout: RadarLayout,
    cfg: RenderConfig,
    callbacks: ChartCallbacks,
): void {
    gPolygons.selectAll("*").remove();
    gDots.selectAll("*").remove();

    if (!data.hasData) return;

    const axisMinMax = cfg.scale.scaleType === "percentage"
        ? computeAxisMinMax(data)
        : null;

    const allCoords: { series: RadarSeries; coords: PointXY[] }[] = [];

    for (const s of data.series) {
        const coords = computeSeriesCoords(s, layout, cfg, axisMinMax);
        allCoords.push({ series: s, coords });
    }

    const { spokeAngles, radialScale } = layout;
    const isPercentage = cfg.scale.scaleType === "percentage";
    const useCurve = cfg.chart.smoothCurve;

    /* ── Draw polygons ── */
    for (const { series, coords } of allCoords) {
        if (useCurve) {
            /* Use d3.lineRadial with cardinal closed curve */
            const radialData: [number, number][] = series.points.map((p, i) => {
                let normVal: number;
                if (isPercentage && axisMinMax) {
                    normVal = normaliseValue(p.value, axisMinMax[p.axisIndex]);
                } else {
                    normVal = p.value;
                }
                const r = radialScale(normVal);
                return [spokeAngles[i], r];
            });

            const gen = lineRadial<[number, number]>()
                .angle((d) => d[0])
                .radius((d) => d[1])
                .curve(curveCardinalClosed);

            const pathD = gen(radialData);

            gPolygons.append("path")
                .attr("class", "radar-polygon")
                .attr("d", pathD)
                .attr("transform", `translate(${layout.cx},${layout.cy})`)
                .attr("fill", series.color)
                .attr("fill-opacity", cfg.chart.fillOpacity)
                .attr("stroke", series.color)
                .attr("stroke-width", cfg.chart.strokeWidth)
                .attr("data-series-index", series.index)
                .on("click", (event: MouseEvent) => {
                    event.stopPropagation();
                    callbacks.onPolygonClick(series, event);
                });
        } else {
            /* Straight-edged polygon */
            const points = coords
                .map((c) => `${c.x},${c.y}`)
                .join(" ");

            gPolygons.append("polygon")
                .attr("class", "radar-polygon")
                .attr("points", points)
                .attr("fill", series.color)
                .attr("fill-opacity", cfg.chart.fillOpacity)
                .attr("stroke", series.color)
                .attr("stroke-width", cfg.chart.strokeWidth)
                .attr("data-series-index", series.index)
                .on("click", (event: MouseEvent) => {
                    event.stopPropagation();
                    callbacks.onPolygonClick(series, event);
                });
        }
    }

    /* ── Draw dots ── */
    if (cfg.chart.showDots && cfg.chart.dotRadius > 0) {
        for (const { series, coords } of allCoords) {
            for (const c of coords) {
                gDots.append("circle")
                    .attr("class", "radar-dot")
                    .attr("cx", c.x)
                    .attr("cy", c.y)
                    .attr("r", cfg.chart.dotRadius)
                    .attr("fill", series.color)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", Math.max(1, cfg.chart.dotRadius * 0.4))
                    .attr("data-series-index", series.index)
                    .attr("data-axis-index", c.point.axisIndex)
                    .on("click", (event: MouseEvent) => {
                        event.stopPropagation();
                        callbacks.onDotClick(c.point, event);
                    })
                    .on("mouseover", (event: MouseEvent) => {
                        callbacks.onMouseOver(c.point, event.pageX, event.pageY);
                    })
                    .on("mousemove", (event: MouseEvent) => {
                        callbacks.onMouseMove(c.point, event.pageX, event.pageY);
                    })
                    .on("mouseout", () => {
                        callbacks.onMouseOut();
                    });
            }
        }
    }
}
