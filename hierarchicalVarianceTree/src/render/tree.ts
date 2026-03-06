/* ═══════════════════════════════════════════════
   render/tree.ts – Tree Layout & Full Render
   Uses d3-hierarchy for layout computation
   ═══════════════════════════════════════════════ */

"use strict";

import { Selection } from "d3-selection";
import { hierarchy, tree, HierarchyPointNode } from "d3-hierarchy";

import { VarianceNode, RenderConfig, TreeCallbacks } from "../types";
import { renderNode } from "./node";
import { renderConnector, computeConnectorEndpoints } from "./connectors";
import { CSS_PREFIX } from "../constants";

type SVGSel = Selection<SVGSVGElement, unknown, null, undefined>;

interface TreeSize {
    width: number;
    height: number;
}

/** Resolved pixel position for a node. */
interface NodePos {
    px: number;
    py: number;
}

/**
 * Build a d3-hierarchy-compatible tree of only the visible (expanded) portion
 * and render it into the SVG. Returns the computed tree dimensions. (R1)
 */
export function renderTree(
    svg: SVGSel,
    root: VarianceNode,
    cfg: RenderConfig,
    callbacks: TreeCallbacks,
): TreeSize {
    /* Clear previous render */
    svg.selectAll("*").remove();

    /* ── Build d3 hierarchy from visible nodes only ── */
    const visibleRoot = hierarchy<VarianceNode>(root, (d) =>
        d.isExpanded ? d.children : [],
    );

    const nodeCount = visibleRoot.descendants().length;
    if (nodeCount === 0) return { width: 0, height: 0 };

    const { nodeWidth, nodeHeight, levelSpacing, siblingSpacing, orientation } = cfg.layout;

    /* ── Configure d3.tree layout ── */
    const treeLayout = tree<VarianceNode>();

    /* nodeSize sets [breadth, depth] per node.
       topDown:   breadth = horizontal, depth = vertical
       leftRight: we swap breadth/depth post-layout */
    const hSep = nodeWidth + siblingSpacing;
    const vSep = nodeHeight + levelSpacing;

    treeLayout.nodeSize(
        orientation === "topDown"
            ? [hSep, vSep]
            : [vSep, hSep],
    );

    treeLayout.separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    /* ── Run layout ── */
    const laid = treeLayout(visibleRoot);
    const points = laid.descendants();
    const links = laid.links();

    /* ── Compute final pixel positions ── */
    const posMap = new Map<HierarchyPointNode<VarianceNode>, NodePos>();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
        /* d3.tree: p.x = breadth, p.y = depth.
           For leftRight we swap so depth runs horizontally. */
        const px = orientation === "topDown" ? p.x : p.y;
        const py = orientation === "topDown" ? p.y : p.x;

        posMap.set(p, { px, py });

        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px + nodeWidth > maxX) maxX = px + nodeWidth;
        if (py + nodeHeight > maxY) maxY = py + nodeHeight;
    }

    /* Shift so all positions are positive with padding.
       Padding scales with node size so the tree doesn't feel cramped at
       larger node dimensions or waste space at smaller ones. */
    const pad = Math.max(12, Math.round(Math.min(nodeWidth, nodeHeight) * 0.15));
    const shiftX = -minX + pad;
    const shiftY = -minY + pad;

    const totalWidth = maxX - minX + pad * 2;
    const totalHeight = maxY - minY + pad * 2;

    /* ── Set SVG size ── */
    svg.attr("width", totalWidth).attr("height", totalHeight);

    /* ── Render group ── */
    const gRoot = svg.append("g").attr("class", CSS_PREFIX + "tree-root");

    /* Background click to clear selection.
       Node clicks call stopPropagation, so any click reaching here is on the background. */
    svg.on("click", () => {
        callbacks.onBackgroundClick();
    });

    /* ── Draw connectors first (behind nodes) ── */
    const gConnectors = gRoot.append("g").attr("class", CSS_PREFIX + "connectors");

    for (const link of links) {
        const sPos = posMap.get(link.source);
        const tPos = posMap.get(link.target);
        if (!sPos || !tPos) continue;

        const endpoints = computeConnectorEndpoints(
            sPos.px + shiftX,
            sPos.py + shiftY,
            tPos.px + shiftX,
            tPos.py + shiftY,
            nodeWidth,
            nodeHeight,
            orientation,
        );

        renderConnector(gConnectors, endpoints, cfg);
    }

    /* ── Draw nodes ── */
    const gNodes = gRoot.append("g").attr("class", CSS_PREFIX + "nodes");

    for (const p of points) {
        const pos = posMap.get(p);
        if (!pos) continue;

        const finalX = pos.px + shiftX;
        const finalY = pos.py + shiftY;

        const nodeGroup = renderNode(gNodes, p.data, cfg, callbacks);
        nodeGroup.attr("transform", `translate(${finalX},${finalY})`);
    }

    return { width: totalWidth, height: totalHeight };
}
