/*
 *  Performance Flow -- render/labels.ts
 *  Node label and value text rendering
 *
 *  Uses D3 join instead of remove-all + re-append.
 *  Provides updateLabelPositions() for drag.
 *
 *  FIX: Label offsets are now proportional to node width instead of
 *       hardcoded 6px. Long names are truncated with ellipsis based
 *       on available space. The inside-label threshold scales with
 *       font size rather than using a fixed 30px cutoff.
 */
"use strict";

import { select } from "d3-selection";
import { SankeyNode, RenderConfig } from "../types";
import { CSS_PREFIX } from "../constants";
import { formatCompact } from "../utils/format";

/* -----------------------------------------------
   Constants
   ----------------------------------------------- */

/** Label gap as a fraction of node width (used for outside labels). */
const LABEL_GAP_RATIO = 0.4;

/** Minimum label gap in px so labels never sit right on the node edge. */
const MIN_LABEL_GAP = 4;

/** Maximum label gap so wide nodes don't push labels too far out. */
const MAX_LABEL_GAP = 12;

/**
 * Minimum node width (in px) to place labels inside. Scales with font
 * size: a node must be at least ~3 characters wide for inside labels
 * to be readable.
 */
function minInsideWidth(fontSize: number): number {
    return fontSize * 2.5;
}

/* -----------------------------------------------
   Internal helpers
   ----------------------------------------------- */

/** Compute the proportional gap between node edge and outside label. */
function labelGap(nodeWidth: number): number {
    const proportional = Math.round(nodeWidth * LABEL_GAP_RATIO);
    return Math.max(MIN_LABEL_GAP, Math.min(MAX_LABEL_GAP, proportional));
}

/**
 * Estimate the maximum number of characters that fit in `availablePx`
 * at the given font size. Uses a conservative average character width
 * of 0.55 em (Segoe UI is a proportional font).
 */
function maxCharsForWidth(availablePx: number, fontSize: number): number {
    const avgCharWidth = fontSize * 0.55;
    return Math.max(3, Math.floor(availablePx / avgCharWidth));
}

/** Truncate text to fit within `maxChars`, adding ellipsis if needed. */
function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    if (maxChars <= 3) return text.slice(0, maxChars);
    return text.slice(0, maxChars - 1) + "\u2026";
}

function computeLabelAttrs(
    node: SankeyNode,
    cfg: RenderConfig,
    maxDepth: number,
    chartWidth: number,
): { textX: number; textAnchor: string; textY: number; maxWidth: number } {
    const nodeHeight = node.y1 - node.y0;
    const nodeWidth = node.x1 - node.x0;
    const isRightColumn = node.depth === maxDepth;
    const gap = labelGap(nodeWidth);

    let textX: number;
    let textAnchor: string;
    let maxWidth: number;

    if (cfg.label.position === "inside" && nodeWidth > minInsideWidth(cfg.label.fontSize)) {
        textX = node.x0 + nodeWidth / 2;
        textAnchor = "middle";
        maxWidth = nodeWidth - 4; // small inset
    } else if (isRightColumn) {
        textX = node.x0 - gap;
        textAnchor = "end";
        maxWidth = node.x0 - gap;
    } else {
        textX = node.x1 + gap;
        textAnchor = "start";
        maxWidth = chartWidth - node.x1 - gap;
    }

    // Ensure maxWidth is at least enough for a few characters
    maxWidth = Math.max(maxWidth, cfg.label.fontSize * 2);

    const textY = node.y0 + nodeHeight / 2;
    return { textX, textAnchor, textY, maxWidth };
}

/* -----------------------------------------------
   Public API
   ----------------------------------------------- */

/** Render node labels and optional value text */
export function renderLabels(
    container: SVGGElement,
    nodes: SankeyNode[],
    cfg: RenderConfig,
    chartWidth: number,
): void {
    const g = select(container);

    if (!cfg.label.showNodeLabels) {
        g.selectAll("*").remove();
        return;
    }

    const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
    const nameClass = CSS_PREFIX + "label";
    const valClass = CSS_PREFIX + "value-label";

    /* -- Name labels (join) -- */
    const nameSel = g.selectAll<SVGTextElement, SankeyNode>(`.${nameClass}`)
        .data(nodes, (d: SankeyNode) => d.id);

    nameSel.exit().remove();

    const nameEnter = nameSel.enter()
        .append("text")
        .attr("class", nameClass);

    nameEnter.merge(nameSel).each(function (d) {
        const { textX, textAnchor, textY, maxWidth } = computeLabelAttrs(d, cfg, maxDepth, chartWidth);
        const maxChars = maxCharsForWidth(maxWidth, cfg.label.fontSize);
        const el = select(this);
        el.attr("x", textX)
            .attr("y", textY)
            .attr("dy", cfg.label.showValues ? "-0.15em" : "0.35em")
            .attr("text-anchor", textAnchor)
            .attr("font-size", cfg.label.fontSize + "px")
            .attr("fill", cfg.label.fontColor)
            .text(truncate(d.name, maxChars));
    });

    /* -- Value sub-labels (join) -- */
    if (cfg.label.showValues) {
        const valSel = g.selectAll<SVGTextElement, SankeyNode>(`.${valClass}`)
            .data(nodes, (d: SankeyNode) => d.id);

        valSel.exit().remove();

        const valEnter = valSel.enter()
            .append("text")
            .attr("class", valClass);

        valEnter.merge(valSel).each(function (d) {
            const { textX, textAnchor, textY } = computeLabelAttrs(d, cfg, maxDepth, chartWidth);
            const el = select(this);
            el.attr("x", textX)
                .attr("y", textY)
                .attr("dy", "1em")
                .attr("text-anchor", textAnchor)
                .attr("font-size", cfg.label.valueFontSize + "px")
                .attr("fill", cfg.label.fontColor)
                .attr("opacity", 0.7)
                .text(formatCompact(d.value));
        });
    } else {
        g.selectAll(`.${valClass}`).remove();
    }
}

/** Lightweight position-only update for drag */
export function updateLabelPositions(
    container: SVGGElement,
    nodes: SankeyNode[],
    cfg: RenderConfig,
    chartWidth?: number,
): void {
    if (!cfg.label.showNodeLabels) return;

    const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
    const cw = chartWidth ?? 0;

    select(container)
        .selectAll<SVGTextElement, SankeyNode>(`.${CSS_PREFIX}label`)
        .each(function (d) {
            const { textX, textY } = computeLabelAttrs(d, cfg, maxDepth, cw);
            select(this).attr("x", textX).attr("y", textY);
        });

    if (cfg.label.showValues) {
        select(container)
            .selectAll<SVGTextElement, SankeyNode>(`.${CSS_PREFIX}value-label`)
            .each(function (d) {
                const { textX, textY } = computeLabelAttrs(d, cfg, maxDepth, cw);
                select(this).attr("x", textX).attr("y", textY);
            });
    }
}
