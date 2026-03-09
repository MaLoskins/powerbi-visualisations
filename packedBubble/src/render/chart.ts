/* ═══════════════════════════════════════════════
   Packed Bubble Chart – Chart Renderer
   Uses d3-selection. No Power BI imports.
   ═══════════════════════════════════════════════ */

"use strict";

import { select, Selection } from "d3-selection";
import { BubbleNode, RenderConfig, ChartCallbacks } from "../types";
import { SimNode } from "../layout/simulation";
import { CSS_PREFIX } from "../constants";

type SVGSel = Selection<SVGSVGElement, unknown, null, undefined>;
type GGroupSel = Selection<SVGGElement, SimNode, SVGGElement, unknown>;

/** Initial render: create SVG groups for each bubble.
 *  Returns the bubble <g> selection for tick updates. */
export function renderBubbles(
    svg: SVGSel,
    nodes: SimNode[],
    cfg: RenderConfig,
    callbacks: ChartCallbacks,
): void {
    const container = svg.select<SVGGElement>(`.${CSS_PREFIX}-bubbles`);

    /* ── Data join ── */
    const groups: GGroupSel = container
        .selectAll<SVGGElement, SimNode>(`.${CSS_PREFIX}-bubble`)
        .data(nodes, (d) => String(d.id));

    /* ── Exit ── */
    groups.exit().remove();

    /* ── Enter ── */
    const entered = groups.enter()
        .append("g")
        .attr("class", `${CSS_PREFIX}-bubble`)
        .attr("data-row", (d) => d.id);

    entered.append("circle")
        .attr("class", `${CSS_PREFIX}-circle`);

    /* ── Enter + Update merge ── */
    const merged = entered.merge(groups);

    merged.select<SVGCircleElement>(`.${CSS_PREFIX}-circle`)
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.fill)
        .attr("fill-opacity", cfg.bubble.opacity)
        .attr("stroke", cfg.bubble.borderColor)
        .attr("stroke-width", cfg.bubble.borderWidth);

    /* ── Events ── */
    merged
        .on("click", function (_event: MouseEvent, d: SimNode) {
            _event.stopPropagation();
            callbacks.onClick(d, _event);
        })
        .on("mouseover", function (_event: MouseEvent, d: SimNode) {
            callbacks.onMouseOver(d, _event);
        })
        .on("mousemove", function (_event: MouseEvent, d: SimNode) {
            callbacks.onMouseMove(d, _event);
        })
        .on("mouseout", function () {
            callbacks.onMouseOut();
        });
}

/** Update bubble positions on every simulation tick */
export function tickBubbles(svg: SVGSel): void {
    svg.select<SVGGElement>(`.${CSS_PREFIX}-bubbles`)
        .selectAll<SVGGElement, SimNode>(`.${CSS_PREFIX}-bubble`)
        .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
}

/** Update bubble styles (fill, opacity) without re-creating elements */
export function updateBubbleStyles(svg: SVGSel, cfg: RenderConfig): void {
    svg.select<SVGGElement>(`.${CSS_PREFIX}-bubbles`)
        .selectAll<SVGGElement, SimNode>(`.${CSS_PREFIX}-bubble`)
        .select<SVGCircleElement>(`.${CSS_PREFIX}-circle`)
        .attr("fill", (d) => d.fill)
        .attr("fill-opacity", cfg.bubble.opacity)
        .attr("stroke", cfg.bubble.borderColor)
        .attr("stroke-width", cfg.bubble.borderWidth);
}

/** Set up the background click handler for deselection */
export function bindBackgroundClick(svg: SVGSel, callback: () => void): void {
    svg.select(`.${CSS_PREFIX}-bg`)
        .on("click", () => callback());
}

/** Build the static SVG scaffold: background rect + bubble group */
export function scaffoldSVG(
    svgEl: SVGSVGElement,
    width: number,
    height: number,
): SVGSel {
    const svg = select(svgEl);
    svg.selectAll("*").remove();

    /* Transparent background for click-to-deselect */
    svg.append("rect")
        .attr("class", `${CSS_PREFIX}-bg`)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent");

    /* Group label layer (below bubbles) */
    svg.append("g").attr("class", `${CSS_PREFIX}-group-labels`);

    /* Bubble container */
    svg.append("g").attr("class", `${CSS_PREFIX}-bubbles`);

    /* Label layer (above bubbles) */
    svg.append("g").attr("class", `${CSS_PREFIX}-labels`);

    return svg;
}

/** Resize the SVG and background rect */
export function resizeSVG(svg: SVGSel, width: number, height: number): void {
    svg.select(`.${CSS_PREFIX}-bg`)
        .attr("width", width)
        .attr("height", height);
}
