/*
 *  Marimekko Chart – Power BI Custom Visual
 *  render/labels.ts — Segment data labels
 */
"use strict";

import * as d3 from "d3-selection";

import { MekkoColumn, RenderConfig } from "../types";
import { MIN_LABEL_HEIGHT_FACTOR, LABEL_PADDING_PX, FONT_FAMILY } from "../constants";
import { buildSegmentLabelText } from "../utils/format";
import { truncateText } from "../utils/dom";

/* ═══════════════════════════════════════════════
   Segment Labels
   ═══════════════════════════════════════════════ */

/** Render labels inside segment rects where they fit.
 *  Each label is clipped to its segment bounds via a <clipPath>. */
export function renderSegmentLabels(
    svg: d3.Selection<SVGGElement, unknown, null, undefined>,
    columns: MekkoColumn[],
    cfg: RenderConfig,
): void {
    svg.selectAll(".marimekko-segment-labels").remove();
    svg.selectAll(".marimekko-segment-label-clips").remove();

    if (!cfg.label.showSegmentLabels) return;

    /* Create a defs group for clip paths */
    const defs = svg.append("defs").attr("class", "marimekko-segment-label-clips");
    const g = svg.append("g").attr("class", "marimekko-segment-labels");
    const fontSize = cfg.label.segmentLabelFontSize;
    const minHeight = fontSize * MIN_LABEL_HEIGHT_FACTOR;
    const thresholdFraction = cfg.chart.percentThreshold / 100;

    let clipIndex = 0;

    for (const col of columns) {
        for (const seg of col.segments) {
            /* Skip if segment too small */
            if (seg.fractionOfColumn < thresholdFraction) continue;
            if (seg.height < minHeight) continue;

            const maxTextWidth = col.width - LABEL_PADDING_PX * 2;
            if (maxTextWidth <= 0) continue;

            const rawText = buildSegmentLabelText(
                cfg.label.segmentLabelContent,
                seg.segmentCategory,
                seg.fractionOfColumn,
                seg.value,
            );

            const labelText = truncateText(rawText, maxTextWidth, fontSize, FONT_FAMILY);
            if (!labelText || labelText === "\u2026") continue;

            /* Create a clip path matching the segment rect */
            const clipId = `marimekko-seg-clip-${clipIndex++}`;
            defs.append("clipPath")
                .attr("id", clipId)
                .append("rect")
                .attr("x", col.x + LABEL_PADDING_PX)
                .attr("y", seg.y)
                .attr("width", Math.max(0, col.width - LABEL_PADDING_PX * 2))
                .attr("height", seg.height);

            const cx = col.x + col.width / 2;
            const cy = seg.y + seg.height / 2;

            g.append("text")
                .attr("class", "marimekko-segment-label")
                .attr("x", cx)
                .attr("y", cy)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .attr("fill", cfg.label.segmentLabelFontColor)
                .attr("font-size", fontSize + "px")
                .attr("font-family", FONT_FAMILY)
                .attr("pointer-events", "none")
                .attr("clip-path", `url(#${clipId})`)
                .text(labelText);
        }
    }
}
