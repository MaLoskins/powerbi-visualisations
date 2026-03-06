/* ═══════════════════════════════════════════════
   Layout — compute chart margins and dimensions
   ═══════════════════════════════════════════════ */
"use strict";

import type { RenderConfig, ChartLayout, SeriesConfig } from "../types";
import {
    MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT,
    Y_AXIS_WIDTH_BASE, X_AXIS_BASE_HEIGHT, LEGEND_HEIGHT_BASE, AXIS_LABEL_PAD_BASE,
    MIN_CHART_SIZE, proportional,
} from "../constants";

/** Determine which axes are active (have at least one non-"none" series assigned). */
export function resolveActiveAxes(
    seriesConfigs: SeriesConfig[],
    measureCount: number,
): { hasLeftPrimary: boolean; hasLeftSecondary: boolean; hasRight: boolean } {
    let hasLeftPrimary = false;
    let hasLeftSecondary = false;
    let hasRight = false;

    for (let i = 0; i < measureCount; i++) {
        const s = seriesConfigs[i];
        if (s.chartType === "none") continue;
        if (s.axis === "leftPrimary") hasLeftPrimary = true;
        if (s.axis === "leftSecondary") hasLeftSecondary = true;
        if (s.axis === "right") hasRight = true;
    }

    return { hasLeftPrimary, hasLeftSecondary, hasRight };
}

/** Compute the chart layout rectangle given the viewport and config. */
export function computeLayout(
    viewportWidth: number,
    viewportHeight: number,
    cfg: RenderConfig,
    measureCount: number,
): ChartLayout {
    const axes = resolveActiveAxes(cfg.series, measureCount);

    /* ── Proportional layout values based on viewport ── */
    const avgDim = (viewportWidth + viewportHeight) / 2;
    const marginTop = proportional(MARGIN_TOP, avgDim, 4, 16);
    const marginBottom = proportional(MARGIN_BOTTOM, avgDim, 4, 16);
    const marginLeft = proportional(MARGIN_LEFT, avgDim, 4, 16);
    const marginRight = proportional(MARGIN_RIGHT, avgDim, 4, 16);
    const yAxisWidth = proportional(Y_AXIS_WIDTH_BASE, viewportWidth, 30, 80);
    const axisLabelPad = proportional(AXIS_LABEL_PAD_BASE, viewportWidth, 8, 28);

    /* ── Legend ── */
    const legendHeight = cfg.legend.showLegend
        ? proportional(LEGEND_HEIGHT_BASE, viewportHeight, 20, 40) : 0;
    const legendIsTop = cfg.legend.legendPosition === "top";

    /* ── Y-axis widths ── */
    const leftPrimaryWidth = axes.hasLeftPrimary && cfg.yAxisLeft.showAxis ? yAxisWidth : 0;
    const leftSecondaryWidth = axes.hasLeftSecondary && cfg.yAxisLeftSecondary.showAxis ? yAxisWidth : 0;
    const rightWidth = axes.hasRight && cfg.yAxisRight.showAxis ? yAxisWidth : 0;

    /* ── Axis label padding ── */
    const leftPrimaryLabelPad = leftPrimaryWidth > 0 && cfg.yAxisLeft.axisLabel ? axisLabelPad : 0;
    const leftSecondaryLabelPad = leftSecondaryWidth > 0 && cfg.yAxisLeftSecondary.axisLabel ? axisLabelPad : 0;
    const rightLabelPad = rightWidth > 0 && cfg.yAxisRight.axisLabel ? axisLabelPad : 0;

    /* ── X-axis height ── */
    let xAxisHeight = 0;
    if (cfg.xAxis.showXAxis) {
        const baseXHeight = proportional(X_AXIS_BASE_HEIGHT, viewportHeight, 20, 44);
        xAxisHeight = baseXHeight;
        if (cfg.xAxis.xLabelRotation === "45") xAxisHeight += proportional(10, viewportHeight, 6, 18);
        if (cfg.xAxis.xLabelRotation === "90") xAxisHeight += proportional(20, viewportHeight, 12, 36);
    }

    /* ── Chart area ── */
    const chartLeft = marginLeft + leftSecondaryWidth + leftSecondaryLabelPad + leftPrimaryWidth + leftPrimaryLabelPad;
    const chartTop = marginTop + (legendIsTop ? legendHeight : 0);
    const chartWidth = Math.max(MIN_CHART_SIZE,
        viewportWidth - chartLeft - marginRight - rightWidth - rightLabelPad);
    const chartHeight = Math.max(MIN_CHART_SIZE,
        viewportHeight - chartTop - marginBottom - xAxisHeight - (!legendIsTop ? legendHeight : 0));

    return {
        chartLeft,
        chartTop,
        chartWidth,
        chartHeight,
        leftPrimaryAxisWidth: leftPrimaryWidth + leftPrimaryLabelPad,
        leftSecondaryAxisWidth: leftSecondaryWidth + leftSecondaryLabelPad,
        rightAxisWidth: rightWidth + rightLabelPad,
        legendHeight,
        xAxisHeight,
        totalWidth: viewportWidth,
        totalHeight: viewportHeight,
        hasLeftPrimary: axes.hasLeftPrimary,
        hasLeftSecondary: axes.hasLeftSecondary,
        hasRight: axes.hasRight,
    };
}
