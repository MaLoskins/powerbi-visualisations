/* ═══════════════════════════════════════════════
   render/node.ts – Individual Node Rendering
   ═══════════════════════════════════════════════ */

"use strict";

import { select, Selection } from "d3-selection";
import { VarianceNode, RenderConfig, TreeCallbacks } from "../types";
import { varianceColor } from "../utils/color";
import { formatCompact, formatPercent } from "../utils/format";
import { CSS_PREFIX } from "../constants";

type SVGGroup = Selection<SVGGElement, unknown, null, undefined>;

/**
 * Render a single node as an SVG group.
 * Returns the group for the caller to position.
 */
export function renderNode(
    parent: SVGGroup,
    node: VarianceNode,
    cfg: RenderConfig,
    callbacks: TreeCallbacks,
): SVGGroup {
    const g = parent.append("g")
        .attr("class", CSS_PREFIX + "node")
        .attr("data-node-id", node.id)
        .style("cursor", "pointer");

    const { nodeWidth: w, nodeHeight: h, nodeCornerRadius: r } = cfg.layout;
    const hasChildren = node.children.length > 0;

    /* ── Clip path to prevent text overflow beyond node bounds ── */
    const clipId = CSS_PREFIX + "clip-" + node.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const defs = g.append("defs");
    defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("width", w)
        .attr("height", h)
        .attr("rx", r)
        .attr("ry", r);

    /* ── Background rect ── */
    g.append("rect")
        .attr("class", CSS_PREFIX + "node-bg")
        .attr("width", w)
        .attr("height", h)
        .attr("rx", r)
        .attr("ry", r)
        .attr("fill", cfg.node.nodeBackground)
        .attr("stroke", cfg.node.nodeBorderColor)
        .attr("stroke-width", cfg.node.nodeBorderWidth);

    /* ── Clipped content group for text elements ── */
    const clipped = g.append("g").attr("clip-path", `url(#${clipId})`);

    /* ── Category label ── */
    const labelY = cfg.node.showVarianceBar
        ? h * 0.22
        : h * 0.35;

    clipped.append("text")
        .attr("class", CSS_PREFIX + "node-label")
        .attr("x", w / 2)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", cfg.node.nodeFontSize + "px")
        .attr("font-weight", "600")
        .attr("fill", cfg.node.nodeFontColor)
        .text(truncateLabel(node.label, w, cfg.node.nodeFontSize, hasChildren));

    /* ── Variance value line ── */
    const vColor = varianceColor(
        node.variance,
        cfg.colors.favourableColor,
        cfg.colors.unfavourableColor,
        cfg.colors.neutralColor,
    );

    let valueY = labelY + cfg.node.nodeFontSize + Math.round(h * 0.04);
    const valueParts: string[] = [];

    if (cfg.node.showAbsoluteValue) {
        valueParts.push(formatCompact(node.variance));
    }
    if (cfg.node.showPercentage && isFinite(node.variancePct)) {
        valueParts.push(formatPercent(node.variancePct));
    }

    if (valueParts.length > 0) {
        clipped.append("text")
            .attr("class", CSS_PREFIX + "node-value")
            .attr("x", w / 2)
            .attr("y", valueY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", cfg.node.valueFontSize + "px")
            .attr("font-weight", "500")
            .attr("fill", vColor)
            .text(valueParts.join("  "));

        valueY += cfg.node.valueFontSize + Math.round(h * 0.03);
    }

    /* ── Variance bar ── */
    if (cfg.node.showVarianceBar && node.budget !== 0) {
        const barPadding = Math.round(w * 0.06);
        const barW = w - barPadding * 2;
        const barH = cfg.node.barHeight;
        const barY = h - barH - Math.round(h * 0.08);

        /* Background track */
        g.append("rect")
            .attr("class", CSS_PREFIX + "bar-track")
            .attr("x", barPadding)
            .attr("y", barY)
            .attr("width", barW)
            .attr("height", barH)
            .attr("rx", barH / 2)
            .attr("fill", cfg.colors.neutralColor)
            .attr("opacity", 0.2);

        /* Filled portion: clamp pct to 0–1 range for bar width */
        const absPct = Math.min(Math.abs(node.variancePct), 1);
        const fillW = barW * absPct;

        g.append("rect")
            .attr("class", CSS_PREFIX + "bar-fill")
            .attr("x", barPadding)
            .attr("y", barY)
            .attr("width", Math.max(fillW, 2))
            .attr("height", barH)
            .attr("rx", barH / 2)
            .attr("fill", vColor)
            .attr("opacity", 0.85);
    }

    /* ── Expand/collapse indicator ── */
    if (hasChildren) {
        const indicatorSize = Math.round(Math.min(w, h) * 0.14);
        const indicatorMargin = Math.round(Math.min(w, h) * 0.08);
        const ix = w - indicatorSize - indicatorMargin;
        const iy = indicatorMargin;

        g.append("text")
            .attr("class", CSS_PREFIX + "node-toggle")
            .attr("x", ix + indicatorSize / 2)
            .attr("y", iy + indicatorSize / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", Math.max(9, Math.round(cfg.node.nodeFontSize * 0.85)) + "px")
            .attr("fill", cfg.node.nodeFontColor)
            .attr("opacity", 0.5)
            .text(node.isExpanded ? "-" : "+");
    }

    /* ── Event handlers ── */
    g.on("click", (event: MouseEvent) => {
        event.stopPropagation();
        if (hasChildren) {
            callbacks.onNodeToggle(node);
        }
        callbacks.onNodeClick(node, event);
    });

    g.on("mouseover", (event: MouseEvent) => {
        callbacks.onNodeMouseOver(node, event);
    });

    g.on("mousemove", (event: MouseEvent) => {
        callbacks.onNodeMouseMove(node, event);
    });

    g.on("mouseout", () => {
        callbacks.onNodeMouseOut();
    });

    return g;
}

/**
 * Apply selection styling to all node groups.
 */
export function applyNodeSelectionStyles(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    selectedIds: Set<string>,
    hasSelection: boolean,
    cfg: RenderConfig,
): void {
    svg.selectAll<SVGGElement, unknown>("." + CSS_PREFIX + "node").each(function () {
        const g = select(this);
        const nodeId = g.attr("data-node-id") ?? "";
        const isSelected = selectedIds.has(nodeId);
        const dimmed = hasSelection && !isSelected;

        g.select("." + CSS_PREFIX + "node-bg")
            .attr("stroke", isSelected ? cfg.colors.selectedNodeBorder : cfg.node.nodeBorderColor)
            .attr("stroke-width", isSelected ? 2 : cfg.node.nodeBorderWidth);

        g.attr("opacity", dimmed ? 0.35 : 1);
    });
}

/* ── Helpers ── */

/**
 * Truncate a label to fit within available pixel width.
 * Accounts for horizontal padding and optional toggle indicator space.
 * Toggle space and padding scale proportionally with node dimensions.
 * Uses 0.55em as average character width for proportional fonts.
 */
function truncateLabel(label: string, nodeWidth: number, fontSize: number, hasChildren: boolean = false): string {
    const hPadding = fontSize * 1.2;                     // ~0.6em padding each side
    const toggleSpace = hasChildren ? Math.round(nodeWidth * 0.12) : 0;
    const availableWidth = nodeWidth - hPadding - toggleSpace;
    const avgCharWidth = fontSize * 0.55;
    const approxChars = Math.max(3, Math.floor(availableWidth / avgCharWidth));
    if (label.length <= approxChars) return label;
    return label.slice(0, approxChars - 1) + "\u2026";
}
