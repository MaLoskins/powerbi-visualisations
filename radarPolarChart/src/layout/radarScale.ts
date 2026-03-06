/* ═══════════════════════════════════════════════
   Radar Scale – spoke angles & radial scale
   ═══════════════════════════════════════════════ */

"use strict";

import { scaleLinear } from "d3-scale";
import { RadarData, RadarLayout, RenderConfig } from "../types";

/**
 * Compute the radar layout: centre point, radius, spoke angles,
 * and the radial scale function.
 */
export function computeRadarLayout(
    data: RadarData,
    width: number,
    height: number,
    cfg: RenderConfig,
): RadarLayout {
    const numAxes = data.axes.length;

    /* ── Determine available radius ── */
    const minDim = Math.min(width, height);

    /* Legend reservation scales with viewport so it doesn't eat too much
       space in small visuals or look tiny in large ones. */
    const legendReserve = cfg.legend.showLegend
        ? (cfg.legend.legendPosition === "right"
            ? Math.max(60, Math.min(minDim * 0.15, 120))
            : Math.max(20, Math.min(minDim * 0.07, 40)))
        : 0;

    /* Label reservation: font size + padding, proportional minimum */
    const labelReserve = cfg.axisLabel.showAxisLabels
        ? cfg.axisLabel.axisFontSize + cfg.axisLabel.labelPadding + Math.max(4, minDim * 0.02)
        : Math.max(6, minDim * 0.02);

    const hPad = cfg.legend.showLegend && cfg.legend.legendPosition === "right"
        ? legendReserve + labelReserve
        : labelReserve * 2;
    const vPad = cfg.legend.showLegend && cfg.legend.legendPosition !== "right"
        ? legendReserve + labelReserve * 2
        : labelReserve * 2;

    const availW = Math.max(width - hPad, 40);
    const availH = Math.max(height - vPad, 40);
    const radius = Math.min(availW, availH) / 2;

    /* ── Centre point ── */
    let cx = width / 2;
    let cy = height / 2;
    if (cfg.legend.showLegend) {
        if (cfg.legend.legendPosition === "top")    cy += legendReserve / 2;
        if (cfg.legend.legendPosition === "bottom") cy -= legendReserve / 2;
        if (cfg.legend.legendPosition === "right")  cx -= legendReserve / 2;
    }

    /* ── Spoke angles (radians, from startAngle) ── */
    const startRad = (cfg.chart.startAngle * Math.PI) / 180;
    const spokeAngles: number[] = [];
    for (let i = 0; i < numAxes; i++) {
        spokeAngles.push(startRad + (2 * Math.PI * i) / numAxes);
    }

    /* ── Scale bounds ── */
    const { scaleMin: cfgMin, scaleMax: cfgMax, scaleType } = cfg.scale;

    let dataMin = Infinity;
    let dataMax = -Infinity;
    for (const s of data.series) {
        for (const p of s.points) {
            if (p.value < dataMin) dataMin = p.value;
            if (p.value > dataMax) dataMax = p.value;
        }
    }
    if (!isFinite(dataMin)) dataMin = 0;
    if (!isFinite(dataMax)) dataMax = 1;

    let scaleMin: number;
    let scaleMax: number;

    if (scaleType === "percentage") {
        /* Percentage mode: 0..1 representing each axis independently –
           but we still need a single radial scale for the grid.
           Actual per-axis normalisation is done during rendering. */
        scaleMin = 0;
        scaleMax = 1;
    } else {
        /* Linear mode */
        scaleMin = cfgMin === -1 ? dataMin : cfgMin;
        scaleMax = cfgMax === 0 ? dataMax : cfgMax;
        if (scaleMax <= scaleMin) scaleMax = scaleMin + 1;
    }

    const radialScale = scaleLinear()
        .domain([scaleMin, scaleMax])
        .range([0, radius])
        .clamp(true);

    return { cx, cy, radius, spokeAngles, radialScale, scaleMin, scaleMax };
}

/**
 * For percentage mode: compute per-axis min/max for independent normalisation.
 */
export function computeAxisMinMax(data: RadarData): { min: number; max: number }[] {
    const result: { min: number; max: number }[] = [];
    for (let ai = 0; ai < data.axes.length; ai++) {
        let min = Infinity;
        let max = -Infinity;
        for (const s of data.series) {
            const p = s.points[ai];
            if (p) {
                if (p.value < min) min = p.value;
                if (p.value > max) max = p.value;
            }
        }
        if (!isFinite(min)) min = 0;
        if (!isFinite(max)) max = 1;
        if (max === min) max = min + 1;
        result.push({ min, max });
    }
    return result;
}

/** Convert a data value to a normalised 0-1 value for percentage mode */
export function normaliseValue(
    value: number,
    axisMinMax: { min: number; max: number },
): number {
    const range = axisMinMax.max - axisMinMax.min;
    if (range === 0) return 0;
    return (value - axisMinMax.min) / range;
}
