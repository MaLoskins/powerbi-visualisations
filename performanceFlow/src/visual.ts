/*
 *  Performance Flow (Sankey Diagram) — Power BI Custom Visual
 *  visual.ts — Entry point / orchestrator
 *
 *  PERFORMANCE FIXES:
 *    1. Drag uses lightweight position-only updates (updateLinkPaths/updateLabelPositions)
 *       instead of destroying and recreating all DOM elements.
 *    2. Drag updates are batched via requestAnimationFrame to avoid layout thrashing.
 *    3. Callbacks are built once and reused (not recreated per render).
 *    4. Resize-only path skips data pipeline entirely.
 *    5. Update gating properly distinguishes data vs. resize vs. format changes.
 *
 *  VIEWPORT FIXES:
 *    6. chartHeight is passed to renderNodes so drag is clamped to viewport bounds.
 *    7. Layout algorithm now uses adaptive padding + min node height (see sankey.ts).
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import DataViewTable = powerbi.DataViewTable;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import {
    RenderConfig,
    SankeyNode,
    SankeyLink,
    SankeyLayout,
    SankeyGraph,
    NodeCallbacks,
    LinkCallbacks,
} from "./types";
import {
    getResponsiveMargin,
    MIN_CHART_WIDTH,
    MIN_CHART_HEIGHT,
    CSS_PREFIX,
} from "./constants";

/* Model */
import { resolveColumns } from "./model/columns";
import { parseFlowRows, ParseResult } from "./model/parser";
import { buildGraph } from "./model/graphBuilder";

/* Layout */
import { computeSankeyLayout, SankeyLayoutOptions } from "./layout/sankey";

/* Render */
import { renderNodes } from "./render/nodes";
import { renderLinks, updateLinkPaths } from "./render/links";
import { renderLabels, updateLabelPositions } from "./render/labels";

/* Interactions */
import {
    handleNodeClick,
    handleLinkClick,
    handleBackgroundClick,
    applySelectionStyles,
    applyHoverHighlight,
} from "./interactions/selection";

/* Utils */
import { el, pfx } from "./utils/dom";
import { formatNumber, formatPercent } from "./utils/format";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {
    /* ── Power BI references ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettings!: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    /* ── DOM skeleton (created once in constructor) ── */
    private container: HTMLDivElement;
    private errorOverlay: HTMLDivElement;
    private svgRoot: SVGSVGElement;
    private defs: SVGDefsElement;
    private linkGroup: SVGGElement;
    private nodeGroup: SVGGElement;
    private labelGroup: SVGGElement;

    /* ── State ── */
    private currentLayout: SankeyLayout | null = null;
    private currentGraph: SankeyGraph | null = null;
    private renderConfig: RenderConfig | null = null;
    private hasRenderedOnce: boolean = false;

    /** Current inner chart dimensions (viewport minus margins). Used for drag clamping and label truncation. */
    private chartHeight: number = 0;
    private chartWidth: number = 0;

    /* ── Drag RAF debounce ── */
    private dragRafId: number = 0;
    private dragPending: boolean = false;

    /* ── Cached callbacks (built once) ── */
    private nodeCallbacks: NodeCallbacks;
    private linkCallbacks: LinkCallbacks;

    /* ═══════════════════════════════════════════════
       Constructor — DOM scaffolding (built once)
       ═══════════════════════════════════════════════ */

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();

        /* Root container */
        this.container = el("div", pfx("container")) as HTMLDivElement;
        options.element.appendChild(this.container);

        /* Error overlay (hidden by default) */
        this.errorOverlay = el("div", pfx("error")) as HTMLDivElement;
        this.errorOverlay.style.display = "none";
        this.container.appendChild(this.errorOverlay);

        /* SVG root */
        const svgNS = "http://www.w3.org/2000/svg";
        this.svgRoot = document.createElementNS(svgNS, "svg") as SVGSVGElement;
        this.svgRoot.setAttribute("class", pfx("svg"));
        this.container.appendChild(this.svgRoot);

        /* SVG defs for gradients */
        this.defs = document.createElementNS(svgNS, "defs") as SVGDefsElement;
        this.svgRoot.appendChild(this.defs);

        /* Render groups — order matters (links behind nodes behind labels) */
        this.linkGroup = document.createElementNS(svgNS, "g") as SVGGElement;
        this.linkGroup.setAttribute("class", pfx("links"));
        this.svgRoot.appendChild(this.linkGroup);

        this.nodeGroup = document.createElementNS(svgNS, "g") as SVGGElement;
        this.nodeGroup.setAttribute("class", pfx("nodes"));
        this.svgRoot.appendChild(this.nodeGroup);

        this.labelGroup = document.createElementNS(svgNS, "g") as SVGGElement;
        this.labelGroup.setAttribute("class", pfx("labels"));
        this.svgRoot.appendChild(this.labelGroup);

        /* Build callbacks once */
        this.nodeCallbacks = this.buildNodeCallbacks();
        this.linkCallbacks = this.buildLinkCallbacks();

        /* Background click clears selection */
        this.svgRoot.addEventListener("click", (e: MouseEvent) => {
            if (e.target === this.svgRoot) {
                handleBackgroundClick(this.selectionManager);
                this.applySelection();
            }
        });

        /* Selection manager callback for cross-visual filtering */
        this.selectionManager.registerOnSelectCallback(() => {
            this.applySelection();
        });
    }

    /* ═══════════════════════════════════════════════
       Update — Data pipeline + render orchestration
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            /* ── Update type gating ── */
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0;
            const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;

            /* Always rebuild render config from current dataView */
            const dataView = options.dataViews?.[0];
            if (dataView) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);
                this.renderConfig = buildRenderConfig(this.formattingSettings);
            }

            /* Viewport sizing */
            const vw = options.viewport.width;
            const vh = options.viewport.height;
            this.svgRoot.setAttribute("width", String(vw));
            this.svgRoot.setAttribute("height", String(vh));

            if (vw < MIN_CHART_WIDTH || vh < MIN_CHART_HEIGHT) {
                this.showError("Visual area too small.");
                return;
            }

            /* Resize-only: re-layout with existing graph (skip data pipeline) */
            if (isResizeOnly && this.currentGraph && this.hasRenderedOnce) {
                this.layoutAndRender(vw, vh);
                return;
            }

            /* ── Data pipeline ── */
            if (!dataView?.table) {
                this.showError("Required fields missing.\nAdd Source, Destination, and Value fields.");
                return;
            }

            const table = dataView.table;
            const cols = resolveColumns(table.columns as { roles?: Record<string, boolean> }[]);
            if (!cols) {
                this.showError("Required fields missing.\nAdd Source, Destination, and Value fields.");
                return;
            }

            const parsed = parseFlowRows(table, cols, this.host);
            if (parsed.rows.length === 0) {
                this.showError("No valid flow data.\nEnsure Source, Destination, and Value fields have data.");
                return;
            }

            /* Build graph */
            const cfg = this.renderConfig;
            if (!cfg) return;

            const graph = buildGraph(
                parsed.rows,
                cfg.node.color,
                cfg.color.colorByNode,
            );

            /* Store for resize-only updates */
            this.currentGraph = graph;
            this.hideError();
            this.layoutAndRender(vw, vh);

        } catch (err) {
            this.showError("An error occurred rendering the visual.");
            console.error("PerformanceFlow error:", err);
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render
       ═══════════════════════════════════════════════ */

    private layoutAndRender(viewportWidth: number, viewportHeight: number): void {
        if (!this.renderConfig || !this.currentGraph) return;

        const cfg = this.renderConfig;
        const m = getResponsiveMargin(viewportWidth, viewportHeight);
        const w = viewportWidth - m.left - m.right;
        const h = viewportHeight - m.top - m.bottom;

        if (w <= 0 || h <= 0) return;

        /* Store chart dimensions for drag clamping and label truncation */
        this.chartHeight = h;
        this.chartWidth = w;

        /* Compute Sankey layout */
        const layoutOpts: SankeyLayoutOptions = {
            width: w,
            height: h,
            nodeWidth: cfg.node.width,
            nodePadding: cfg.node.padding,
            iterations: cfg.layout.iterations,
            align: cfg.node.align,
            sortNodes: cfg.layout.sortNodes,
        };

        const layout = computeSankeyLayout(this.currentGraph, layoutOpts);
        this.currentLayout = layout;

        /* Offset groups by margin */
        const transform = `translate(${m.left},${m.top})`;
        this.linkGroup.setAttribute("transform", transform);
        this.nodeGroup.setAttribute("transform", transform);
        this.labelGroup.setAttribute("transform", transform);

        /* ── Render ── */
        this.renderAll(layout, cfg, w);
        this.hasRenderedOnce = true;
    }

    private renderAll(layout: SankeyLayout, cfg: RenderConfig, chartWidth: number): void {
        renderLinks(this.linkGroup, this.defs, layout.links, cfg, this.linkCallbacks);
        renderNodes(this.nodeGroup, layout.nodes, cfg, this.nodeCallbacks, this.chartHeight);
        renderLabels(this.labelGroup, layout.nodes, cfg, chartWidth);

        this.applySelection();
    }

    /* ═══════════════════════════════════════════════
       Interaction Callbacks (built once in constructor)
       ═══════════════════════════════════════════════ */

    private buildNodeCallbacks(): NodeCallbacks {
        return {
            onClick: (node: SankeyNode, e: MouseEvent) => {
                handleNodeClick(node, e, this.selectionManager);
                this.applySelection();
            },
            onMouseOver: (node: SankeyNode, e: MouseEvent) => {
                if (this.currentLayout && this.renderConfig) {
                    applyHoverHighlight(
                        this.svgRoot, node, null,
                        this.renderConfig.node.opacity,
                        this.renderConfig.link.opacity,
                        this.renderConfig.link.hoverOpacity,
                    );
                }
                this.showTooltipForNode(node, e);
            },
            onMouseMove: (node: SankeyNode, e: MouseEvent) => {
                this.showTooltipForNode(node, e);
            },
            onMouseOut: () => {
                if (this.renderConfig) {
                    applyHoverHighlight(
                        this.svgRoot, null, null,
                        this.renderConfig.node.opacity,
                        this.renderConfig.link.opacity,
                        this.renderConfig.link.hoverOpacity,
                    );
                }
                this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
            },
            onDrag: (_node: SankeyNode, _dy: number) => {
                /*
                 * FIX: Instead of re-rendering ALL links and labels (destroying
                 * and recreating every DOM element), schedule a lightweight
                 * position-only update batched via requestAnimationFrame.
                 */
                this.scheduleDragUpdate();
            },
        };
    }

    private buildLinkCallbacks(): LinkCallbacks {
        return {
            onClick: (link: SankeyLink, e: MouseEvent) => {
                handleLinkClick(link, e, this.selectionManager);
                this.applySelection();
            },
            onMouseOver: (link: SankeyLink, e: MouseEvent) => {
                if (this.renderConfig) {
                    applyHoverHighlight(
                        this.svgRoot, null, link,
                        this.renderConfig.node.opacity,
                        this.renderConfig.link.opacity,
                        this.renderConfig.link.hoverOpacity,
                    );
                }
                this.showTooltipForLink(link, e);
            },
            onMouseMove: (link: SankeyLink, e: MouseEvent) => {
                this.showTooltipForLink(link, e);
            },
            onMouseOut: () => {
                if (this.renderConfig) {
                    applyHoverHighlight(
                        this.svgRoot, null, null,
                        this.renderConfig.node.opacity,
                        this.renderConfig.link.opacity,
                        this.renderConfig.link.hoverOpacity,
                    );
                }
                this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
            },
        };
    }

    /* ═══════════════════════════════════════════════
       Drag — Lightweight, RAF-batched
       ═══════════════════════════════════════════════ */

    /**
     * Schedule a lightweight drag update. Multiple drag events within
     * the same animation frame are coalesced into a single DOM update.
     */
    private scheduleDragUpdate(): void {
        if (this.dragPending) return;
        this.dragPending = true;

        this.dragRafId = requestAnimationFrame(() => {
            this.dragPending = false;
            this.performDragUpdate();
        });
    }

    /**
     * FIX: Only recompute link y-offsets from the already-updated node positions,
     * then update the SVG path `d` attributes and label positions in-place.
     * No DOM destruction/creation. ~100× faster than full re-render.
     */
    private performDragUpdate(): void {
        if (!this.currentLayout || !this.renderConfig) return;

        /* Recompute link y0/y1 from current node positions */
        this.recomputeLinkYPositions(this.currentLayout.nodes);

        /* Update only the path `d` attributes (no event re-binding, no gradient rebuild) */
        updateLinkPaths(this.linkGroup, this.renderConfig.link.curvature);

        /* Update label positions (no text re-creation) */
        updateLabelPositions(this.labelGroup, this.currentLayout.nodes, this.renderConfig, this.chartWidth);
    }

    /**
     * Recompute link y0/y1/width from current node y0/y1 values.
     * This is the same logic as sankey.ts computeLinkPositions,
     * but runs on the mutable layout objects in-place.
     */
    private recomputeLinkYPositions(nodes: SankeyNode[]): void {
        for (const node of nodes) {
            node.sourceLinks.sort((a, b) => a.target.y0 - b.target.y0);
            node.targetLinks.sort((a, b) => a.source.y0 - b.source.y0);
        }

        for (const node of nodes) {
            const nodeHeight = node.y1 - node.y0;
            let totalOut = 0;
            for (const l of node.sourceLinks) totalOut += l.value;
            const scale = totalOut > 0 ? nodeHeight / totalOut : 0;

            let y = node.y0;
            for (const link of node.sourceLinks) {
                link.width = link.value * scale;
                link.y0 = y + link.width / 2;
                y += link.width;
            }
        }

        for (const node of nodes) {
            const nodeHeight = node.y1 - node.y0;
            let totalIn = 0;
            for (const l of node.targetLinks) totalIn += l.value;
            const scale = totalIn > 0 ? nodeHeight / totalIn : 0;

            let y = node.y0;
            for (const link of node.targetLinks) {
                const w = link.value * scale;
                link.y1 = y + w / 2;
                y += w;
            }
        }
    }

    /* ═══════════════════════════════════════════════
       Selection
       ═══════════════════════════════════════════════ */

    private applySelection(): void {
        if (!this.currentLayout || !this.renderConfig) return;
        applySelectionStyles(
            this.svgRoot,
            this.currentLayout.nodes,
            this.currentLayout.links,
            this.selectionManager,
            this.renderConfig.color.selectedNodeColor,
            this.renderConfig.color.selectedLinkColor,
            this.renderConfig.node.opacity,
            this.renderConfig.link.opacity,
        );
    }

    /* ═══════════════════════════════════════════════
       Tooltips
       ═══════════════════════════════════════════════ */

    private showTooltipForNode(node: SankeyNode, e: MouseEvent): void {
        let totalIn = 0;
        let totalOut = 0;
        for (const l of node.targetLinks) totalIn += l.value;
        for (const l of node.sourceLinks) totalOut += l.value;

        const items: powerbi.extensibility.VisualTooltipDataItem[] = [
            { displayName: "Node", value: node.name },
            { displayName: "Total In", value: formatNumber(totalIn) },
            { displayName: "Total Out", value: formatNumber(totalOut) },
        ];

        this.host.tooltipService.show({
            coordinates: [e.clientX, e.clientY],
            isTouchEvent: false,
            dataItems: items,
            identities: [],
        });
    }

    private showTooltipForLink(link: SankeyLink, e: MouseEvent): void {
        let sourceTotal = 0;
        for (const l of link.source.sourceLinks) sourceTotal += l.value;
        const pctOfSource = sourceTotal > 0 ? link.value / sourceTotal : 0;

        const items: powerbi.extensibility.VisualTooltipDataItem[] = [
            { displayName: "Source", value: link.source.name },
            { displayName: "Destination", value: link.target.name },
            { displayName: "Value", value: formatNumber(link.value) },
            { displayName: "% of Source", value: formatPercent(pctOfSource) },
        ];

        /* Append user-defined tooltip extras */
        for (const extra of link.tooltipExtras) {
            items.push(extra);
        }

        this.host.tooltipService.show({
            coordinates: [e.clientX, e.clientY],
            isTouchEvent: false,
            dataItems: items,
            identities: [],
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay
       ═══════════════════════════════════════════════ */

    private showError(msg: string): void {
        this.errorOverlay.textContent = msg;
        this.errorOverlay.style.display = "flex";
        this.svgRoot.style.display = "none";
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.svgRoot.style.display = "block";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
