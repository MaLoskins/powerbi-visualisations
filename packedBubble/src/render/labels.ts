/* ═══════════════════════════════════════════════
   Packed Bubble Chart – Label Renderer
   ═══════════════════════════════════════════════ */

"use strict";

import { Selection } from "d3-selection";
import { BubbleNode, RenderConfig, LabelContent } from "../types";
import { SimNode, SimulationContext } from "../layout/simulation";
import { CSS_PREFIX, FONT_STACK } from "../constants";
import { formatCompact } from "../utils/format";

type SVGSel = Selection<SVGSVGElement, unknown, null, undefined>;

/* ── Bubble Labels ── */

/** Build the label text for a bubble */
function labelText(node: BubbleNode, content: LabelContent): string {
    switch (content) {
        case "value": return formatCompact(node.value);
        case "nameAndValue": return `${node.category}\n${formatCompact(node.value)}`;
        default: return node.category;
    }
}

/** Shared offscreen canvas for measuring text width. */
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
    if (!_measureCtx) {
        const canvas = document.createElement("canvas");
        _measureCtx = canvas.getContext("2d")!;
    }
    return _measureCtx;
}

/** Measure the pixel width of a string at the given font size. */
function measureTextWidth(text: string, fontSize: number): number {
    const ctx = getMeasureCtx();
    ctx.font = `${fontSize}px ${FONT_STACK}`;
    return ctx.measureText(text).width;
}

/** Truncate a string with ellipsis to fit within maxWidth pixels.
 *  Uses binary search for efficiency with canvas measurement. */
function truncateToFit(text: string, fontSize: number, maxWidth: number): string {
    if (measureTextWidth(text, fontSize) <= maxWidth) return text;
    let lo = 0, hi = text.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (measureTextWidth(text.slice(0, mid) + "…", fontSize) <= maxWidth) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return lo > 0 ? text.slice(0, lo) + "…" : "…";
}

/** Word-wrap a string to fit inside a circle of given radius.
 *  Returns an array of lines. Uses canvas text measurement for accuracy. */
function wrapText(text: string, radius: number, fontSize: number): string[] {
    /* Chord width at vertical offset y from centre = 2 * sqrt(r^2 - y^2).
     * We use the chord at ~35% from centre as a practical max text width. */
    const maxWidth = 2 * Math.sqrt(radius * radius - (radius * 0.35) ** 2);

    const rawLines = text.split("\n");
    const lines: string[] = [];

    for (const raw of rawLines) {
        const words = raw.split(/\s+/);
        let current = "";
        for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (measureTextWidth(test, fontSize) > maxWidth && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        }
        if (current) lines.push(current);
    }

    /* Limit lines to fit vertically inside the circle diameter */
    const lineHeight = fontSize * 1.2;
    const usableHeight = radius * 2 * 0.8; /* 80% of diameter */
    const maxLines = Math.max(1, Math.floor(usableHeight / lineHeight));
    if (lines.length > maxLines) {
        const truncated = lines.slice(0, maxLines);
        truncated[maxLines - 1] = truncateToFit(truncated[maxLines - 1], fontSize, maxWidth);
        return truncated;
    }

    /* Truncate any individual line that still exceeds maxWidth */
    for (let i = 0; i < lines.length; i++) {
        lines[i] = truncateToFit(lines[i], fontSize, maxWidth);
    }
    return lines;
}

/** Render or update bubble labels on the label layer.
 *  Called after simulation tick. */
export function renderBubbleLabels(
    svg: SVGSel,
    nodes: SimNode[],
    cfg: RenderConfig,
): void {
    const layer = svg.select<SVGGElement>(`.${CSS_PREFIX}-labels`);

    if (!cfg.label.showLabels) {
        layer.selectAll("*").remove();
        return;
    }

    const minR = cfg.label.minRadiusForLabel;
    const visible = nodes.filter((n) => n.radius >= minR);

    const groups = layer
        .selectAll<SVGGElement, SimNode>(`.${CSS_PREFIX}-label`)
        .data(visible, (d) => String(d.id));

    groups.exit().remove();

    const entered = groups.enter()
        .append("g")
        .attr("class", `${CSS_PREFIX}-label`);

    const merged = entered.merge(groups);

    merged.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);

    /* Rebuild text on every tick (positional) */
    merged.each(function (d) {
        const g = this as SVGGElement;
        while (g.firstChild) g.removeChild(g.firstChild);

        const raw = labelText(d, cfg.label.labelContent);
        const maxWidth = 2 * Math.sqrt(d.radius * d.radius - (d.radius * 0.35) ** 2);
        const lines = cfg.label.wrapLabels
            ? wrapText(raw, d.radius, cfg.label.fontSize)
            : [truncateToFit(raw, cfg.label.fontSize, maxWidth)];

        const lineHeight = cfg.label.fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const startY = -totalHeight / 2 + lineHeight * 0.75;

        const ns = "http://www.w3.org/2000/svg";
        for (let i = 0; i < lines.length; i++) {
            const tspan = document.createElementNS(ns, "text");
            tspan.setAttribute("text-anchor", "middle");
            tspan.setAttribute("x", "0");
            tspan.setAttribute("y", String(startY + i * lineHeight));
            tspan.setAttribute("fill", cfg.label.fontColor);
            tspan.setAttribute("font-size", `${cfg.label.fontSize}px`);
            tspan.setAttribute("font-family", FONT_STACK);
            tspan.setAttribute("pointer-events", "none");
            tspan.textContent = lines[i];
            g.appendChild(tspan);
        }
    });
}

/* ── Group Labels ── */

/** Render group labels centred above each cluster.
 *  Only shown when splitGroups is on and groups exist. */
export function renderGroupLabels(
    svg: SVGSel,
    ctx: SimulationContext | null,
    groups: string[],
    cfg: RenderConfig,
): void {
    const layer = svg.select<SVGGElement>(`.${CSS_PREFIX}-group-labels`);

    if (!cfg.groupLabel.showGroupLabels || !ctx || !cfg.force.splitGroups || groups.length <= 1) {
        layer.selectAll("*").remove();
        return;
    }

    const data = groups.map((g) => ({
        name: g,
        x: ctx.groupCentres.get(g)?.x ?? 0,
        y: ctx.groupCentres.get(g)?.y ?? 0,
    }));

    /* Find the topmost bubble in each group to position label above */
    const groupMinY = new Map<string, number>();
    for (const node of ctx.nodes) {
        if (node.group == null) continue;
        const top = (node.y ?? 0) - node.radius;
        const current = groupMinY.get(node.group);
        if (current === undefined || top < current) {
            groupMinY.set(node.group, top);
        }
    }

    const labels = layer
        .selectAll<SVGTextElement, { name: string }>(`.${CSS_PREFIX}-group-label`)
        .data(data, (d) => d.name);

    labels.exit().remove();

    const entered = labels.enter()
        .append("text")
        .attr("class", `${CSS_PREFIX}-group-label`);

    entered.merge(labels)
        .attr("x", (d) => d.x)
        .attr("y", (d) => {
            const minY = groupMinY.get(d.name);
            /* Position label above the topmost bubble with a gap proportional to font size */
            return (minY ?? d.y) - cfg.groupLabel.fontSize * 0.6;
        })
        .attr("text-anchor", "middle")
        .attr("fill", cfg.groupLabel.fontColor)
        .attr("font-size", `${cfg.groupLabel.fontSize}px`)
        .attr("font-family", FONT_STACK)
        .attr("font-weight", "600")
        .text((d) => d.name);
}
