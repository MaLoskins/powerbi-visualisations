/*
 *  Bullet Chart – Power BI Custom Visual
 *  src/render/axis.ts
 *
 *  Renders the shared value axis and optional gridlines.
 */
"use strict";

import { RenderConfig, BulletItem } from "../types";
import { niceTickValues, formatValue } from "../utils/format";
import { SVG_NS } from "../utils/dom";
import { AXIS_AREA_SIZE, MIN_TICK_SPACING, FONT_STACK } from "../constants";

/* ═══════════════════════════════════════════════
   Horizontal Axis (bottom)
   ═══════════════════════════════════════════════ */

/** Render a horizontal value axis along the bottom of the chart area. */
export function renderHorizontalAxis(
    svg: SVGSVGElement,
    globalMax: number,
    chartWidth: number,
    chartAreaHeight: number,
    cfg: RenderConfig,
): void {
    if (!cfg.axis.showAxis && !cfg.axis.showGridlines) return;

    const maxTicks = Math.max(2, Math.floor(chartWidth / MIN_TICK_SPACING));
    const ticks = niceTickValues(globalMax, maxTicks);
    const scaleMax = globalMax > 0 ? globalMax : 1;
    const scale = (v: number) => (v / scaleMax) * chartWidth;

    /* ── Gridlines ── */
    if (cfg.axis.showGridlines) {
        for (const t of ticks) {
            const x = scale(t);
            if (x < 0 || x > chartWidth) continue;
            const line = document.createElementNS(SVG_NS, "line");
            line.setAttribute("class", "bullet-gridline");
            line.setAttribute("x1", String(x));
            line.setAttribute("x2", String(x));
            line.setAttribute("y1", "0");
            line.setAttribute("y2", String(chartAreaHeight));
            line.setAttribute("stroke", cfg.axis.gridlineColor);
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "2,2");
            svg.appendChild(line);
        }
    }

    /* ── Tick labels ── */
    if (cfg.axis.showAxis) {
        for (const t of ticks) {
            const x = scale(t);
            if (x < 0 || x > chartWidth) continue;
            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("class", "bullet-axis-tick");
            text.setAttribute("x", String(x));
            text.setAttribute("y", String(chartAreaHeight + AXIS_AREA_SIZE * 0.65));
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", cfg.axis.axisFontColor);
            text.setAttribute("font-size", cfg.axis.axisFontSize + "px");
            text.setAttribute("font-family", FONT_STACK);
            text.textContent = formatValue(t);
            svg.appendChild(text);
        }
    }
}

/* ═══════════════════════════════════════════════
   Vertical Axis (left)
   ═══════════════════════════════════════════════ */

/** Render a vertical value axis along the left of the chart area. */
export function renderVerticalAxis(
    svg: SVGSVGElement,
    globalMax: number,
    chartHeight: number,
    chartAreaWidth: number,
    axisAreaWidth: number,
    cfg: RenderConfig,
): void {
    if (!cfg.axis.showAxis && !cfg.axis.showGridlines) return;

    const maxTicks = Math.max(2, Math.floor(chartHeight / MIN_TICK_SPACING));
    const ticks = niceTickValues(globalMax, maxTicks);
    const scaleMax = globalMax > 0 ? globalMax : 1;
    const scale = (v: number) => chartHeight - (v / scaleMax) * chartHeight;

    /* ── Gridlines ── */
    if (cfg.axis.showGridlines) {
        for (const t of ticks) {
            const y = scale(t);
            if (y < 0 || y > chartHeight) continue;
            const line = document.createElementNS(SVG_NS, "line");
            line.setAttribute("class", "bullet-gridline");
            line.setAttribute("x1", String(axisAreaWidth));
            line.setAttribute("x2", String(axisAreaWidth + chartAreaWidth));
            line.setAttribute("y1", String(y));
            line.setAttribute("y2", String(y));
            line.setAttribute("stroke", cfg.axis.gridlineColor);
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "2,2");
            svg.appendChild(line);
        }
    }

    /* ── Tick labels ── */
    if (cfg.axis.showAxis) {
        for (const t of ticks) {
            const y = scale(t);
            if (y < 0 || y > chartHeight) continue;
            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("class", "bullet-axis-tick");
            text.setAttribute("x", String(axisAreaWidth - Math.max(3, Math.round(cfg.axis.axisFontSize * 0.4))));
            text.setAttribute("y", String(y + cfg.axis.axisFontSize * 0.35));
            text.setAttribute("text-anchor", "end");
            text.setAttribute("fill", cfg.axis.axisFontColor);
            text.setAttribute("font-size", cfg.axis.axisFontSize + "px");
            text.setAttribute("font-family", FONT_STACK);
            text.textContent = formatValue(t);
            svg.appendChild(text);
        }
    }
}

/* ═══════════════════════════════════════════════
   Vertical Category Labels (bottom, for vertical mode)
   ═══════════════════════════════════════════════ */

/** Render category labels below vertical bullets. */
export function renderVerticalCategoryLabels(
    svg: SVGSVGElement,
    items: BulletItem[],
    chartHeight: number,
    cfg: RenderConfig,
): void {
    if (!cfg.layout.showCategoryLabels) return;

    const { bulletHeight: bulletWidth, bulletSpacing, categoryFontSize } = cfg.layout;
    const labelOffsetY = Math.round(categoryFontSize * 1.3);

    for (let i = 0; i < items.length; i++) {
        const xCenter = i * (bulletWidth + bulletSpacing) + bulletWidth / 2;
        const estimatedTextWidth = items[i].category.length * categoryFontSize * 0.6;
        const needsRotation = estimatedTextWidth > bulletWidth;

        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("class", "bullet-cat-label-v");
        text.setAttribute("x", String(xCenter));
        text.setAttribute("y", String(chartHeight + labelOffsetY));
        text.setAttribute("text-anchor", needsRotation ? "end" : "middle");
        text.setAttribute("fill", cfg.layout.categoryFontColor);
        text.setAttribute("font-size", categoryFontSize + "px");
        text.setAttribute("font-family", FONT_STACK);

        /* Truncate long labels that would overflow even when rotated */
        const maxChars = needsRotation
            ? Math.floor(bulletWidth * 2 / (categoryFontSize * 0.6))
            : Math.floor(bulletWidth / (categoryFontSize * 0.6));
        const label = items[i].category;
        text.textContent = label.length > maxChars ? label.slice(0, maxChars - 1) + "\u2026" : label;

        if (needsRotation) {
            text.setAttribute("transform", `rotate(-45, ${xCenter}, ${chartHeight + labelOffsetY})`);
        }

        svg.appendChild(text);
    }
}
