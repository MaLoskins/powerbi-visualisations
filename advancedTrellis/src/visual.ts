/* ═══════════════════════════════════════════════
   Advanced Trellis – Visual Orchestrator
   ═══════════════════════════════════════════════ */

"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ITooltipService = powerbi.extensibility.ITooltipService;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import type {
    RenderConfig,
    ParseResult,
    TrellisDataPoint,
    PanelCallbacks,
} from "./types";
import { resolveColumns, hasRequiredColumns } from "./model/columns";
import { parseRows } from "./model/parser";
import { computeGridLayout } from "./render/layout";
import { updatePanel } from "./render/panel";
import { handleClick, handleBackgroundClick, applySelectionStyles } from "./interactions/selection";
import { el } from "./utils/dom";
import { formatValue } from "./utils/format";
import { MAX_PANELS } from "./constants";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {
    /* ── Power BI services ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;

    /* ── DOM elements (created once in constructor) ── */
    private container: HTMLDivElement;
    private scrollContainer: HTMLDivElement;
    private gridContainer: HTMLDivElement;
    private errorOverlay: HTMLDivElement;

    /* ── Panel pool (P1): pre-allocated panel DOM elements ── */
    private panelPool: {
        div: HTMLDivElement;
        titleDiv: HTMLDivElement;
        svg: SVGSVGElement;
    }[];

    /* ── State ── */
    private renderConfig: RenderConfig | null;
    private parseResult: ParseResult | null;
    private hasRenderedOnce: boolean;

    /* ═══════════════════════════════════════════════
       Constructor — build all DOM once
       ═══════════════════════════════════════════════ */

    constructor(options: VisualConstructorOptions | undefined) {
        if (!options) return;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = this.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();
        this.formattingSettings = new VisualFormattingSettingsModel();
        this.renderConfig = null;
        this.parseResult = null;
        this.hasRenderedOnce = false;

        /* ── Root container ── */
        this.container = el("div", "trellis-container", options.element);

        /* ── Error overlay ── */
        this.errorOverlay = el("div", "trellis-error", this.container);
        this.errorOverlay.style.display = "none";

        /* ── Scroll container ── */
        this.scrollContainer = el("div", "trellis-scroll", this.container);

        /* ── Grid container (holds all panel divs) ── */
        this.gridContainer = el("div", "trellis-grid", this.scrollContainer);

        /* ── Pre-allocate panel pool (P1) ── */
        this.panelPool = [];
        for (let i = 0; i < MAX_PANELS; i++) {
            const div = el("div", "trellis-panel", this.gridContainer);
            div.style.display = "none";

            const titleDiv = el("div", "trellis-panel-title", div);
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "trellis-panel-svg");
            div.appendChild(svg);

            this.panelPool.push({ div, titleDiv, svg });
        }

        /* ── Background click clears selection ── */
        this.scrollContainer.addEventListener("click", (e: MouseEvent) => {
            if (e.target === this.scrollContainer || e.target === this.gridContainer) {
                handleBackgroundClick(this.selectionManager, () => {
                    applySelectionStyles(this.gridContainer, this.selectionManager);
                });
            }
        });
    }

    /* ═══════════════════════════════════════════════
       Update — data pipeline + render orchestration
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            this.updateInternal(options);
        } catch {
            this.showError("An unexpected error occurred.");
        }
    }

    private updateInternal(options: VisualUpdateOptions): void {
        const dv = options?.dataViews?.[0];

        /* ── Populate formatting model ── */
        if (dv) {
            this.formattingSettings =
                this.formattingSettingsService.populateFormattingSettingsModel(
                    VisualFormattingSettingsModel,
                    dv,
                );
        }
        this.renderConfig = buildRenderConfig(this.formattingSettings);

        /* ── Update type gating ── */
        const updateType = options.type ?? 0;
        const hasData = (updateType & 2) !== 0;

        /* ── Data pipeline (skip on resize-only) ── */
        if (hasData || !this.hasRenderedOnce) {
            if (!dv || !dv.table) {
                this.showError("Required fields missing.\nAdd Trellis By, Category, and Value fields.");
                return;
            }

            const table = dv.table;
            const cols = resolveColumns(table.columns);

            if (!hasRequiredColumns(cols)) {
                this.showError("Required fields missing.\nAdd Trellis By, Category, and Value fields.");
                return;
            }

            this.parseResult = parseRows(
                table,
                cols,
                this.host,
                this.renderConfig.colors.colorPalette,
                this.renderConfig.colors.defaultBarColor,
            );

            if (this.parseResult.panels.length === 0) {
                this.showError("No data to display.");
                return;
            }
        }

        /* ── Guard: must have data ── */
        if (!this.parseResult || !this.renderConfig) return;

        this.hideError();
        this.layoutAndRender(options.viewport);
        this.hasRenderedOnce = true;
    }

    /* ═══════════════════════════════════════════════
       Layout & Render
       ═══════════════════════════════════════════════ */

    private layoutAndRender(viewport: powerbi.IViewport): void {
        const cfg = this.renderConfig!;
        const data = this.parseResult!;

        /* ── Container sizing ── */
        this.container.style.width = `${viewport.width}px`;
        this.container.style.height = `${viewport.height}px`;

        /* ── Compute grid layout ── */
        const grid = computeGridLayout(
            viewport.width,
            viewport.height,
            data.panels.length,
            cfg.layout,
        );

        /* ── Update grid container styles ── */
        this.gridContainer.style.display = "flex";
        this.gridContainer.style.flexWrap = "wrap";
        this.gridContainer.style.gap = `${cfg.layout.panelPadding}px`;
        this.gridContainer.style.padding = `${cfg.layout.panelPadding}px`;
        this.gridContainer.style.alignContent = "flex-start";

        /* ── Y scale bounds ── */
        const globalYMin = data.globalMinValue;
        const globalYMax = data.globalMaxValue;

        /* ── Build callbacks ── */
        const callbacks = this.buildCallbacks();

        /* ── Expand panel pool if needed ── */
        this.ensurePoolSize(data.panels.length);

        /* ── Update panel pool ── */
        for (let i = 0; i < this.panelPool.length; i++) {
            const pool = this.panelPool[i];
            const panel = i < data.panels.length ? data.panels[i] : null;

            /* Per-panel Y scale (if not shared) */
            let yMin = globalYMin;
            let yMax = globalYMax;
            if (!cfg.axis.sharedYScale && panel && panel.dataPoints.length > 0) {
                yMin = 0;
                yMax = 0;
                for (const pt of panel.dataPoints) {
                    if (pt.value < yMin) yMin = pt.value;
                    if (pt.value > yMax) yMax = pt.value;
                }
                if (yMin > 0) yMin = 0;
                if (yMax < 0) yMax = 0;
                if (yMin === 0 && yMax === 0) yMax = 1;
            }

            updatePanel(
                pool.div,
                pool.titleDiv,
                pool.svg,
                panel,
                grid.panelWidth,
                grid.panelHeight,
                yMin,
                yMax,
                cfg,
                callbacks,
            );
        }

        /* ── Apply selection styles ── */
        applySelectionStyles(this.gridContainer, this.selectionManager);
    }

    /* ═══════════════════════════════════════════════
       Panel Pool Management
       ═══════════════════════════════════════════════ */

    /** Grow the panel pool dynamically when more panels are needed. */
    private ensurePoolSize(requiredCount: number): void {
        while (this.panelPool.length < requiredCount) {
            const div = el("div", "trellis-panel", this.gridContainer);
            div.style.display = "none";

            const titleDiv = el("div", "trellis-panel-title", div);
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "trellis-panel-svg");
            div.appendChild(svg);

            this.panelPool.push({ div, titleDiv, svg });
        }
    }

    /* ═══════════════════════════════════════════════
       Interaction Callbacks
       ═══════════════════════════════════════════════ */

    private buildCallbacks(): PanelCallbacks {
        return {
            onClick: (point: TrellisDataPoint, event: MouseEvent) => {
                event.stopPropagation();
                handleClick(point, event, this.selectionManager, () => {
                    applySelectionStyles(this.gridContainer, this.selectionManager);
                });
            },
            onMouseOver: (point: TrellisDataPoint, x: number, y: number, _event: MouseEvent) => {
                this.showTooltip(point, x, y);
            },
            onMouseMove: (point: TrellisDataPoint, x: number, y: number, _event: MouseEvent) => {
                this.moveTooltip(point, x, y);
            },
            onMouseOut: () => {
                this.hideTooltip();
            },
        };
    }

    /* ── Tooltip helpers ── */

    private buildTooltipItems(point: TrellisDataPoint): powerbi.extensibility.VisualTooltipDataItem[] {
        const items: powerbi.extensibility.VisualTooltipDataItem[] = [
            { displayName: "Trellis", value: point.trellisValue },
            { displayName: "Category", value: point.categoryValue },
            { displayName: "Value", value: formatValue(point.value) },
        ];
        if (point.seriesValue) {
            items.splice(2, 0, { displayName: "Series", value: point.seriesValue });
        }
        for (const extra of point.tooltipExtras) {
            items.push({ displayName: extra.displayName, value: extra.value });
        }
        return items;
    }

    private showTooltip(point: TrellisDataPoint, x: number, y: number): void {
        this.tooltipService.show({
            dataItems: this.buildTooltipItems(point),
            identities: [point.selectionId],
            coordinates: [x, y],
            isTouchEvent: false,
        });
    }

    private moveTooltip(point: TrellisDataPoint, x: number, y: number): void {
        this.tooltipService.move({
            dataItems: this.buildTooltipItems(point),
            identities: [point.selectionId],
            coordinates: [x, y],
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
        this.errorOverlay.style.display = "flex";
        this.errorOverlay.textContent = msg;
        this.scrollContainer.style.display = "none";
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.scrollContainer.style.display = "block";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
