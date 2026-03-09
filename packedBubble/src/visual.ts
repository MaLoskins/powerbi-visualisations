/* ═══════════════════════════════════════════════
   Packed Bubble Chart – Visual Orchestrator
   Entry point. All DOM created in constructor.
   ═══════════════════════════════════════════════ */

"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { select, Selection } from "d3-selection";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import { RenderConfig, BubbleNode, ChartCallbacks, ParseResult } from "./types";
import { CSS_PREFIX, MISSING_FIELDS_MSG, FONT_STACK } from "./constants";
import { resolveColumns, hasRequiredColumns } from "./model/columns";
import { parseRows } from "./model/parser";
import {
    SimNode,
    SimulationContext,
    computeRadii,
    createSimulation,
    restartSimulation,
    stopSimulation,
} from "./layout/simulation";
import {
    scaffoldSVG,
    renderBubbles,
    tickBubbles,
    bindBackgroundClick,
    resizeSVG,
} from "./render/chart";
import { renderBubbleLabels, renderGroupLabels } from "./render/labels";
import { renderLegend } from "./render/legend";
import {
    handleBubbleClick,
    handleBackgroundClick,
    applySelectionStyles,
} from "./interactions/selection";
import { el } from "./utils/dom";
import { formatFull } from "./utils/format";

type SVGSel = Selection<SVGSVGElement, unknown, null, undefined>;

export class Visual implements IVisual {
    /* ── Power BI handles ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;

    /* ── DOM skeleton (created once) ── */
    private container: HTMLDivElement;
    private errorOverlay: HTMLDivElement;
    private legendContainer: HTMLDivElement;
    private svgEl: SVGSVGElement;
    private svg: SVGSel;

    /* ── State ── */
    private cfg: RenderConfig;
    private parseResult: ParseResult | null = null;
    private simCtx: SimulationContext | null = null;
    private hasRenderedOnce = false;

    /* ═══════════════════════════════════════════════
       Constructor — build all DOM once
       ═══════════════════════════════════════════════ */
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = this.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();

        /* Root container */
        this.container = el("div", "container");
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.display = "flex";
        this.container.style.flexDirection = "column";
        this.container.style.overflow = "hidden";
        this.container.style.fontFamily = FONT_STACK;
        options.element.appendChild(this.container);

        /* Error overlay (hidden by default) */
        this.errorOverlay = el("div", "error");
        this.errorOverlay.style.display = "none";
        this.container.appendChild(this.errorOverlay);

        /* Legend (top by default) */
        this.legendContainer = el("div", "legend");
        this.legendContainer.style.display = "none";
        this.container.appendChild(this.legendContainer);

        /* SVG */
        this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgEl.classList.add(`${CSS_PREFIX}-svg`);
        this.svgEl.style.flex = "1 1 0";
        this.svgEl.style.minHeight = "0";
        this.svgEl.style.minWidth = "0";
        this.svgEl.style.width = "100%";
        this.svgEl.style.height = "100%";
        this.container.appendChild(this.svgEl);

        this.svg = scaffoldSVG(this.svgEl, 0, 0);

        /* Default config */
        this.formattingSettings = new VisualFormattingSettingsModel();
        this.cfg = buildRenderConfig(this.formattingSettings);

        /* Register selection callback so Power BI can notify us */
        this.selectionManager.registerOnSelectCallback(() => {
            applySelectionStyles(this.svg, this.selectionManager, this.cfg.bubble.opacity);
        });
    }

    /* ═══════════════════════════════════════════════
       Update — gate on VisualUpdateType
       ═══════════════════════════════════════════════ */
    public update(options: VisualUpdateOptions): void {
        try {
            const updateType = (options.type as number) ?? 0;
            const hasData = (updateType & 2) !== 0;
            const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;

            /* Always refresh config */
            const dv = options.dataViews?.[0];
            if (dv) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
            }
            this.cfg = buildRenderConfig(this.formattingSettings);

            /* Resize-only path */
            if (isResizeOnly && this.hasRenderedOnce) {
                this.layoutAndRender(false);
                return;
            }

            /* Full data pipeline */
            if (!dv || !dv.table) {
                this.showError(MISSING_FIELDS_MSG);
                return;
            }

            const table = dv.table;
            const cols = resolveColumns(table);

            if (!hasRequiredColumns(cols)) {
                this.showError(MISSING_FIELDS_MSG);
                return;
            }

            this.hideError();

            this.parseResult = parseRows(
                table,
                cols,
                this.host,
                this.cfg.color.colorByGroup,
                this.cfg.color.defaultBubbleColor,
            );

            if (this.parseResult.nodes.length === 0) {
                this.showError("No data to display.\nEnsure values are positive numbers.");
                return;
            }

            this.layoutAndRender(true);
            this.hasRenderedOnce = true;

        } catch (err) {
            // Never throw from update (E1)
            console.error("packedBubble update error:", err);
            this.showError("An unexpected error occurred.");
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render
       ═══════════════════════════════════════════════ */
    private layoutAndRender(isDataChange: boolean): void {
        if (!this.parseResult) return;
        const pr = this.parseResult;
        const cfg = this.cfg;

        /* ── Legend ── */
        this.positionLegend(cfg);
        renderLegend(this.legendContainer, pr.groups, cfg);

        /* ── Compute available chart area from the SVG element's actual size
         *  (flex layout already accounts for legend space) ── */
        const svgRect = this.svgEl.getBoundingClientRect();
        const chartWidth = Math.max(svgRect.width, 50);
        const chartHeight = Math.max(svgRect.height, 50);

        /* ── Compute radii ── */
        computeRadii(pr.nodes, pr.minValue, pr.maxValue, cfg.bubble.minRadius, cfg.bubble.maxRadius);

        /* ── SVG scaffold ── */
        if (isDataChange) {
            this.svg = scaffoldSVG(this.svgEl, chartWidth, chartHeight);
            bindBackgroundClick(this.svg, () => {
                handleBackgroundClick(this.selectionManager);
                applySelectionStyles(this.svg, this.selectionManager, cfg.bubble.opacity);
            });
        } else {
            resizeSVG(this.svg, chartWidth, chartHeight);
        }

        /* ── Callbacks ── */
        const callbacks: ChartCallbacks = {
            onClick: (node, event) => {
                handleBubbleClick(node, event, this.selectionManager);
                applySelectionStyles(this.svg, this.selectionManager, cfg.bubble.opacity);
            },
            onBackgroundClick: () => {
                handleBackgroundClick(this.selectionManager);
                applySelectionStyles(this.svg, this.selectionManager, cfg.bubble.opacity);
            },
            onMouseOver: (node, event) => this.showTooltip(node, event),
            onMouseMove: (node, event) => this.moveTooltip(node, event),
            onMouseOut: () => this.hideTooltip(),
        };

        /* ── Force Simulation ── */
        const simNodes = pr.nodes as SimNode[];

        if (isDataChange) {
            stopSimulation(this.simCtx);

            /* Render initial bubbles */
            renderBubbles(this.svg, simNodes, cfg, callbacks);

            this.simCtx = createSimulation(
                simNodes,
                pr.groups,
                chartWidth,
                chartHeight,
                cfg,
                () => this.onSimTick(),
            );
        } else {
            /* Resize: update forces and restart */
            if (this.simCtx) {
                renderBubbles(this.svg, simNodes, cfg, callbacks);
                restartSimulation(this.simCtx, chartWidth, chartHeight, cfg, pr.groups);
            }
        }
    }

    /** Called on every simulation tick to update positions */
    private onSimTick(): void {
        tickBubbles(this.svg);
        if (this.parseResult && this.simCtx) {
            renderBubbleLabels(this.svg, this.simCtx.nodes, this.cfg);
            renderGroupLabels(this.svg, this.simCtx, this.parseResult.groups, this.cfg);
        }
    }

    /* ── Legend Positioning ── */
    private positionLegend(cfg: RenderConfig): void {
        const c = this.container;
        const l = this.legendContainer;

        /* Remove and re-insert to match position */
        if (l.parentElement) l.parentElement.removeChild(l);

        if (cfg.legend.position === "right") {
            c.style.flexDirection = "row";
            c.appendChild(this.svgEl);
            c.appendChild(l);
        } else if (cfg.legend.position === "bottom") {
            c.style.flexDirection = "column";
            c.appendChild(this.svgEl);
            c.appendChild(l);
        } else {
            /* top (default) */
            c.style.flexDirection = "column";
            /* Legend before SVG */
            c.insertBefore(l, this.svgEl);
        }

        /* Re-append error overlay at the start */
        if (this.errorOverlay.parentElement !== c) {
            c.insertBefore(this.errorOverlay, c.firstChild);
        }
    }

    /* ═══════════════════════════════════════════════
       Tooltips
       ═══════════════════════════════════════════════ */
    private showTooltip(node: BubbleNode, event: MouseEvent): void {
        const items: VisualTooltipDataItem[] = [
            { displayName: "Category", value: node.category },
            { displayName: "Value", value: formatFull(node.value) },
        ];
        if (node.group) {
            items.push({ displayName: "Group", value: node.group });
        }
        for (const tf of node.tooltipFields) {
            items.push({ displayName: tf.displayName, value: tf.value });
        }

        this.tooltipService.show({
            dataItems: items,
            identities: [node.selectionId],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
        });
    }

    private moveTooltip(node: BubbleNode, event: MouseEvent): void {
        this.tooltipService.move({
            dataItems: [],
            identities: [],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
        });
    }

    private hideTooltip(): void {
        this.tooltipService.hide({
            immediately: true,
            isTouchEvent: false,
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay
       ═══════════════════════════════════════════════ */
    private showError(msg: string): void {
        stopSimulation(this.simCtx);
        this.simCtx = null;
        this.svgEl.style.display = "none";
        this.legendContainer.style.display = "none";
        this.errorOverlay.style.display = "flex";
        this.errorOverlay.textContent = "";

        const lines = msg.split("\n");
        for (const line of lines) {
            const p = document.createElement("p");
            p.textContent = line;
            this.errorOverlay.appendChild(p);
        }
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.svgEl.style.display = "";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
