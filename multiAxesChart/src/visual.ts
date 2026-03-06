/* ═══════════════════════════════════════════════
   Multi-Axes Combo Chart — Visual Orchestrator
   Entry point for the Power BI custom visual.
   DOM is built once in constructor; update() gates
   on VisualUpdateType flags (M6).
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
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import type { RenderConfig, ParsedData, ChartLayout, CategoryDataPoint } from "./types";
import { resolveColumns } from "./model/columns";
import { parseData } from "./model/parser";
import { computeLayout } from "./layout/margins";
import { renderChart, ChartGroups, ChartCallbacks } from "./render/chart";
import { applySelectionStyles } from "./interactions/selection";
import { el, clearChildren } from "./utils/dom";

type SvgSel = Selection<SVGSVGElement, unknown, null, undefined>;
type GSel = Selection<SVGGElement, unknown, null, undefined>;

export class Visual implements IVisual {
    /* ── Power BI SDK handles ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings!: VisualFormattingSettingsModel;

    /* ── DOM skeleton (created once in constructor) ── */
    private container: HTMLDivElement;
    private svg: SvgSel;
    private errorOverlay: HTMLDivElement;

    /* ── SVG groups ── */
    private gBars: GSel;
    private gLines: GSel;
    private gXAxis: GSel;
    private gYAxisLeft: GSel;
    private gYAxisLeftSec: GSel;
    private gYAxisRight: GSel;
    private gLegend: GSel;
    private gLabels: GSel;
    private gBackground: GSel;

    /* ── State ── */
    private data: ParsedData | null = null;
    private cfg: RenderConfig | null = null;
    private layout: ChartLayout | null = null;
    private hasRenderedOnce = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = this.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();

        /* ── Build DOM once (M7) ── */
        this.container = el("div", "maxes-container", options.element);

        /* ── Error overlay ── */
        this.errorOverlay = el("div", "maxes-error", this.container);
        this.errorOverlay.style.display = "none";

        /* ── SVG root ── */
        const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgNode.setAttribute("class", "maxes-svg");
        this.container.appendChild(svgNode);
        this.svg = select(svgNode) as unknown as SvgSel;

        /* ── Create SVG groups in z-order ── */
        this.gBackground = this.svg.append("g").attr("class", "maxes-g-bg") as GSel;
        this.gYAxisLeft = this.svg.append("g").attr("class", "maxes-g-y-left") as GSel;
        this.gYAxisLeftSec = this.svg.append("g").attr("class", "maxes-g-y-left-sec") as GSel;
        this.gYAxisRight = this.svg.append("g").attr("class", "maxes-g-y-right") as GSel;
        this.gXAxis = this.svg.append("g").attr("class", "maxes-g-x") as GSel;
        this.gBars = this.svg.append("g").attr("class", "maxes-g-bars") as GSel;
        this.gLines = this.svg.append("g").attr("class", "maxes-g-lines") as GSel;
        this.gLabels = this.svg.append("g").attr("class", "maxes-g-labels") as GSel;
        this.gLegend = this.svg.append("g").attr("class", "maxes-g-legend") as GSel;

        /* ── Background click to clear selection ── */
        this.gBackground.append("rect")
            .attr("class", "maxes-bg-rect")
            .attr("fill", "transparent")
            .on("click", () => {
                this.selectionManager.clear();
                this.applySelection();
            });

        /* ── Selection manager callback for external clear ── */
        this.selectionManager.registerOnSelectCallback(() => {
            this.applySelection();
        });
    }

    /* ═══════════════════════════════════════════════
       update() — main entry point per render cycle
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            const vp = options.viewport;
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0;
            const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;

            /* ── Resize SVG ── */
            this.svg.attr("width", vp.width).attr("height", vp.height);
            this.gBackground.select(".maxes-bg-rect")
                .attr("width", vp.width)
                .attr("height", vp.height);

            /* ── Populate formatting settings ── */
            const dv = options.dataViews?.[0];
            if (dv) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
                this.cfg = buildRenderConfig(this.formattingSettings);
            }

            /* ── Data pipeline (skip on resize-only) ── */
            if (!isResizeOnly || !this.hasRenderedOnce) {
                if (!this.parseDataPipeline(dv)) return;
            }

            if (!this.data || !this.cfg) return;

            /* ── Layout ── */
            this.layout = computeLayout(vp.width, vp.height, this.cfg, this.data.measureCount);

            /* ── Render ── */
            this.hideError();
            this.renderAll();
            this.hasRenderedOnce = true;
        } catch (err) {
            // Never throw from update (M8)
            console.error("multiAxesChart update error:", err);
            this.showError("An unexpected error occurred.");
        }
    }

    /* ── Data Pipeline ── */

    private parseDataPipeline(dv: DataView | undefined): boolean {
        if (!dv?.categorical) {
            this.showError("Required fields missing.\nAdd at least the X Axis category and one measure.");
            return false;
        }

        const cols = resolveColumns(dv.categorical);
        if (!cols) {
            this.showError("Required fields missing.\nAdd at least the X Axis category and Measure 1.");
            return false;
        }

        this.data = parseData(dv.categorical, cols, this.host);
        return true;
    }

    /* ── Render All ── */

    private renderAll(): void {
        if (!this.data || !this.cfg || !this.layout) return;

        const groups: ChartGroups = {
            gBars: this.gBars,
            gLines: this.gLines,
            gXAxis: this.gXAxis,
            gYAxisLeft: this.gYAxisLeft,
            gYAxisLeftSec: this.gYAxisLeftSec,
            gYAxisRight: this.gYAxisRight,
            gLegend: this.gLegend,
            gLabels: this.gLabels,
        };

        const callbacks: ChartCallbacks = {
            onClick: (catIdx, seriesIdx, e) => this.handleClick(catIdx, e),
            onMouseOver: (catIdx, seriesIdx, x, y) => this.handleTooltipShow(catIdx, x, y),
            onMouseMove: (x, y) => this.handleTooltipMove(x, y),
            onMouseOut: () => this.handleTooltipHide(),
            onDotClick: (catIdx, seriesIdx, e) => this.handleClick(catIdx, e),
            onDotMouseOver: (catIdx, seriesIdx, x, y) => this.handleTooltipShow(catIdx, x, y),
            onDotMouseMove: (x, y) => this.handleTooltipMove(x, y),
            onDotMouseOut: () => this.handleTooltipHide(),
            onBackgroundClick: () => {
                this.selectionManager.clear();
                this.applySelection();
            },
        };

        renderChart(groups, this.data, this.cfg, this.layout, callbacks);
        this.applySelection();
    }

    /* ═══════════════════════════════════════════════
       Interactions
       ═══════════════════════════════════════════════ */

    private handleClick(catIndex: number, e: MouseEvent): void {
        if (!this.data) return;
        const cat = this.data.categories[catIndex];
        if (!cat) return;

        const multiSelect = e.ctrlKey || e.metaKey;
        this.selectionManager.select(cat.selectionId, multiSelect);
        this.applySelection();
    }

    private applySelection(): void {
        const ids = this.selectionManager.getSelectionIds() as powerbi.visuals.ISelectionId[];
        const hasSelection = ids.length > 0;
        const selectedCats = new Set<number>();

        if (hasSelection && this.data) {
            const idSet = new Set(ids.map(id => JSON.stringify(id)));
            for (const cat of this.data.categories) {
                if (idSet.has(JSON.stringify(cat.selectionId))) {
                    selectedCats.add(cat.categoryIndex);
                }
            }
        }

        if (this.cfg) {
            applySelectionStyles(this.svg, selectedCats, hasSelection, this.cfg);
        }
    }

    /* ── Tooltips ── */

    private handleTooltipShow(catIndex: number, x: number, y: number): void {
        if (!this.data || !this.cfg) return;
        const cat = this.data.categories[catIndex];
        if (!cat) return;

        const items: VisualTooltipDataItem[] = [];

        // X category
        items.push({
            displayName: "Category",
            value: cat.categoryLabel,
        });

        // Active measure values
        for (let m = 0; m < this.data.measureCount; m++) {
            if (this.cfg.series[m].chartType === "none") continue;
            const val = cat.values[m];
            items.push({
                displayName: this.data.measureNames[m],
                value: val != null ? String(val) : "N/A",
                color: this.cfg.series[m].color,
            });
        }

        // Tooltip extras
        for (const extra of cat.tooltipExtras) {
            items.push({
                displayName: extra.displayName,
                value: extra.value,
            });
        }

        this.tooltipService.show({
            dataItems: items,
            identities: [cat.selectionId],
            coordinates: [x, y],
            isTouchEvent: false,
        });
    }

    private handleTooltipMove(x: number, y: number): void {
        this.tooltipService.move({
            dataItems: [],
            identities: [],
            coordinates: [x, y],
            isTouchEvent: false,
        });
    }

    private handleTooltipHide(): void {
        this.tooltipService.hide({
            immediately: true,
            isTouchEvent: false,
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay
       ═══════════════════════════════════════════════ */

    private showError(msg: string): void {
        this.errorOverlay.style.display = "flex";
        this.errorOverlay.textContent = msg;

        // Hide chart content
        this.svg.attr("display", "none");
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.svg.attr("display", null);
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
