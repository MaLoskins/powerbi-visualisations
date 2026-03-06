/* ═══════════════════════════════════════════════
   render/labels.ts - Data labels for bars
   ═══════════════════════════════════════════════ */
"use strict";

import { Selection } from "d3-selection";
import { ScaleBand, ScaleLinear } from "d3-scale";
import { VarianceItem, RenderConfig } from "../types";
import { varianceColor } from "../utils/color";
import { formatCompact, formatVariance, formatPercent } from "../utils/format";

type SVGSel = Selection<SVGGElement, unknown, null, undefined>;

/** Truncate text to fit within a pixel width based on font size */
function truncateText(text: string, maxWidthPx: number, fontSize: number): string {
    const approxChars = Math.floor(maxWidthPx / (fontSize * 0.6));
    if (approxChars <= 0) return "";
    if (text.length <= approxChars) return text;
    return text.slice(0, Math.max(2, approxChars - 1)) + "...";
}

/** Render value labels above or beside bars */
export function renderLabels(
    g: SVGSel,
    items: VarianceItem[],
    bandScale: ScaleBand<string>,
    valueScale: ScaleLinear<number, number>,
    cfg: RenderConfig,
    isVertical: boolean,
): void {
    g.selectAll("*").remove();
    if (!cfg.labels.showValueLabels) return;

    const labelFontSize = cfg.labels.labelFontSize;

    for (const item of items) {
        const bandPos = bandScale(item.category) ?? 0;
        const bandW = bandScale.bandwidth();
        const rawText = buildLabelText(item, cfg);
        const vColor = varianceColor(
            item.variance,
            cfg.colors.favourableColor,
            cfg.colors.unfavourableColor,
        );

        if (isVertical) {
            const x = bandPos + bandW / 2;
            const topY = valueScale(Math.max(item.actual, item.budget));
            const text = truncateText(rawText, bandW * 1.5, labelFontSize);
            g.append("text")
                .attr("class", "variance-label")
                .attr("x", x)
                .attr("y", topY - 4)
                .attr("text-anchor", "middle")
                .attr("font-size", labelFontSize + "px")
                .attr("fill", cfg.labels.labelContent === "actual" ? cfg.labels.labelFontColor : vColor)
                .text(text);
        } else {
            const y = bandPos + bandW / 2;
            const rightX = valueScale(Math.max(item.actual, item.budget));
            const range = valueScale.range();
            const availableWidth = Math.max(0, (range[1] || 0) - rightX - 8);
            const text = truncateText(rawText, availableWidth, labelFontSize);
            g.append("text")
                .attr("class", "variance-label")
                .attr("x", rightX + 4)
                .attr("y", y)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .attr("font-size", labelFontSize + "px")
                .attr("fill", cfg.labels.labelContent === "actual" ? cfg.labels.labelFontColor : vColor)
                .text(text);
        }
    }
}

/* ── Build label text based on content mode ── */

function buildLabelText(item: VarianceItem, cfg: RenderConfig): string {
    const content = cfg.labels.labelContent;
    const showPct = cfg.labels.showVariancePercent;

    switch (content) {
        case "actual":
            return formatCompact(item.actual);
        case "variance": {
            let text = formatVariance(item.variance);
            if (showPct) text += ` (${formatPercent(item.variancePercent)})`;
            return text;
        }
        case "both": {
            let text = formatCompact(item.actual) + " | " + formatVariance(item.variance);
            if (showPct) text += ` (${formatPercent(item.variancePercent)})`;
            return text;
        }
        case "percent":
            return formatPercent(item.variancePercent);
        default:
            return formatVariance(item.variance);
    }
}
