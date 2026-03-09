/* ═══════════════════════════════════════════════
   Linear Gauge – Axis Utilities
   Compute required layout dimensions for labels
   ═══════════════════════════════════════════════ */
"use strict";

import { GaugeItem, RenderConfig } from "../types";
import { formatValue } from "../utils/format";
import { estimateLabelWidth } from "../utils/format";
import { LABEL_PADDING_H, MIN_MAX_LABEL_PADDING } from "../constants";

/**
 * Compute the space needed to the right of the bar area
 * for "right"-position value labels.
 */
export function computeRightLabelWidth(
    items: GaugeItem[],
    cfg: RenderConfig,
): number {
    if (!cfg.label.showValueLabel || cfg.label.valueLabelPosition !== "right") {
        return 0;
    }
    let maxW = 0;
    for (const item of items) {
        const text = formatValue(item.value, cfg.label.valueFormat);
        const w = estimateLabelWidth(text, cfg.label.valueFontSize);
        if (w > maxW) maxW = w;
    }
    return maxW + LABEL_PADDING_H;
}

/**
 * Compute the space needed to the left of the bar area
 * for "left"-position value labels.
 */
export function computeLeftLabelWidth(
    items: GaugeItem[],
    cfg: RenderConfig,
): number {
    if (!cfg.label.showValueLabel || cfg.label.valueLabelPosition !== "left") {
        return 0;
    }
    let maxW = 0;
    for (const item of items) {
        const text = formatValue(item.value, cfg.label.valueFormat);
        const w = estimateLabelWidth(text, cfg.label.valueFontSize);
        if (w > maxW) maxW = w;
    }
    return maxW + LABEL_PADDING_H;
}

/**
 * Compute the extra height needed below gauges for min/max labels.
 */
export function computeMinMaxLabelHeight(cfg: RenderConfig): number {
    if (!cfg.label.showMinMax) return 0;
    return Math.max(cfg.label.valueFontSize - 2, 7) + MIN_MAX_LABEL_PADDING + 2;
}

/**
 * Compute extra height above gauges for "above" labels or target labels.
 */
export function computeTopLabelHeight(cfg: RenderConfig): number {
    let h = 0;
    if (cfg.label.showValueLabel && cfg.label.valueLabelPosition === "above") {
        h = Math.max(h, cfg.label.valueFontSize + Math.max(2, Math.round(cfg.label.valueFontSize * 0.35)));
    }
    if (cfg.label.showTargetLabel && cfg.target.showTarget) {
        h = Math.max(h, cfg.label.valueFontSize + Math.max(2, Math.round(cfg.label.valueFontSize * 0.2)));
    }
    return h;
}

/**
 * Compute extra height below vertical gauges for category labels.
 */
export function computeVerticalCategoryHeight(cfg: RenderConfig): number {
    if (!cfg.layout.showCategoryLabels || cfg.layout.orientation !== "vertical") return 0;
    return cfg.layout.categoryFontSize + Math.max(4, Math.round(cfg.layout.categoryFontSize * 0.6));
}
