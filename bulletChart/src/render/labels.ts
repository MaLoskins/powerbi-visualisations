/*
 *  Bullet Chart – Power BI Custom Visual
 *  src/render/labels.ts
 *
 *  Renders value labels and target labels on bullet items.
 */
"use strict";

import { BulletItem, RenderConfig } from "../types";
import { formatValue } from "../utils/format";
import { SVG_NS } from "../utils/dom";
import { FONT_STACK as FONT_FAMILY } from "../constants";

/* ═══════════════════════════════════════════════
   Horizontal Labels
   ═══════════════════════════════════════════════ */

/** Render value (and optional target) labels for horizontal bullets. */
export function renderLabelsHorizontal(
    svg: SVGSVGElement,
    items: BulletItem[],
    globalMax: number,
    chartWidth: number,
    cfg: RenderConfig,
): void {
    const { bulletHeight, bulletSpacing } = cfg.layout;
    const { showValueLabel, valueLabelPosition, valueFontSize, valueFontColor, showTargetLabel } = cfg.label;
    const scaleMax = globalMax > 0 ? globalMax : 1;
    const scale = (v: number) => (v / scaleMax) * chartWidth;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const yCenter = i * (bulletHeight + bulletSpacing) + bulletHeight / 2;

        /* ── Value label ── */
        if (showValueLabel) {
            const barEnd = scale(item.actual);
            const labelPad = Math.max(3, Math.round(valueFontSize * 0.45));
            let x: number;
            let anchor: string;

            if (valueLabelPosition === "right") {
                x = barEnd + labelPad;
                anchor = "start";
            } else if (valueLabelPosition === "left") {
                x = -labelPad;
                anchor = "end";
            } else {
                // inside
                x = Math.max(barEnd - labelPad, labelPad);
                anchor = "end";
            }

            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("class", "bullet-value-label");
            text.setAttribute("x", String(x));
            text.setAttribute("y", String(yCenter + valueFontSize * 0.35));
            text.setAttribute("text-anchor", anchor);
            text.setAttribute("fill", valueLabelPosition === "inside" ? "#FFFFFF" : valueFontColor);
            text.setAttribute("font-size", valueFontSize + "px");
            text.setAttribute("font-weight", "600");
            text.setAttribute("font-family", FONT_FAMILY);
            text.textContent = formatValue(item.actual);
            svg.appendChild(text);
        }

        /* ── Target label ── */
        if (showTargetLabel && item.target !== null) {
            const tx = scale(item.target);
            const targetLabelPad = Math.max(2, Math.round(valueFontSize * 0.2));
            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("class", "bullet-target-label");
            text.setAttribute("x", String(tx));
            text.setAttribute("y", String(i * (bulletHeight + bulletSpacing) - targetLabelPad));
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", cfg.target.targetColor);
            text.setAttribute("font-size", (valueFontSize - 1) + "px");
            text.setAttribute("font-family", FONT_FAMILY);
            text.textContent = formatValue(item.target);
            svg.appendChild(text);
        }
    }
}

/* ═══════════════════════════════════════════════
   Vertical Labels
   ═══════════════════════════════════════════════ */

/** Render value (and optional target) labels for vertical bullets. */
export function renderLabelsVertical(
    svg: SVGSVGElement,
    items: BulletItem[],
    globalMax: number,
    chartHeight: number,
    cfg: RenderConfig,
): void {
    const { bulletHeight: bulletWidth, bulletSpacing } = cfg.layout;
    const { showValueLabel, valueFontSize, valueFontColor, showTargetLabel } = cfg.label;
    const scaleMax = globalMax > 0 ? globalMax : 1;
    const scale = (v: number) => chartHeight - (v / scaleMax) * chartHeight;

    const labelPad = Math.max(3, Math.round(valueFontSize * 0.4));

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const xCenter = i * (bulletWidth + bulletSpacing) + bulletWidth / 2;

        /* ── Value label (above the bar top) ── */
        if (showValueLabel) {
            const barTopY = scale(item.actual);
            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("class", "bullet-value-label");
            text.setAttribute("x", String(xCenter));
            text.setAttribute("y", String(barTopY - labelPad));
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", valueFontColor);
            text.setAttribute("font-size", valueFontSize + "px");
            text.setAttribute("font-weight", "600");
            text.setAttribute("font-family", FONT_FAMILY);
            text.textContent = formatValue(item.actual);
            svg.appendChild(text);
        }

        /* ── Target label ── */
        if (showTargetLabel && item.target !== null) {
            const ty = scale(item.target);
            const text = document.createElementNS(SVG_NS, "text");
            text.setAttribute("class", "bullet-target-label");
            text.setAttribute("x", String(i * (bulletWidth + bulletSpacing) + bulletWidth + labelPad));
            text.setAttribute("y", String(ty + valueFontSize * 0.35));
            text.setAttribute("text-anchor", "start");
            text.setAttribute("fill", cfg.target.targetColor);
            text.setAttribute("font-size", (valueFontSize - 1) + "px");
            text.setAttribute("font-family", FONT_FAMILY);
            text.textContent = formatValue(item.target);
            svg.appendChild(text);
        }
    }
}
