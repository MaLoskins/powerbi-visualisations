/* ═══════════════════════════════════════════════
   Radar / Polar Chart – Visual Orchestrator
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
import { RadarData, RenderConfig, ChartCallbacks, RadarDataPoint, RadarSeries } from "./types";
import { ERROR_MISSING_FIELDS } from "./constants";

import { resolveColumns } from "./model/columns";
import { parseRadarData } from "./model/parser";
import { computeRadarLayout } from "./layout/radarScale";
import { renderGrid } from "./render/grid";
import { renderGridLabels, renderAxisLabels } from "./render/labels";
import { renderChart } from "./render/chart";
import { renderLegend } from "./render/legend";
import { applySelectionStyles, handlePointClick, handleBackgroundClick } from "./interactions/selection";
import { el } from "./utils/dom";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {
    /* ── Power BI services ── */
    private host!: IVisualHost;
    private selectionManager!: ISelectionManager;
    private tooltipService!: ITooltipService;
    private formattingSettingsService!: FormattingSettingsService;

    /* ── State ── */
    private formattingSettings!: VisualFormattingSettingsModel;
    private radarData!: RadarData;
    private renderConfig!: RenderConfig;

    /* ── DOM elements (created once in constructor) ── */
    private container!: HTMLElement;
    private svg!: SVGSVGElement;
    private gGrid!: Selection<SVGGElement, unknown, null, undefined>;
    private gGridLabels!: Selection<SVGGElement, unknown, null, undefined>;
    private gAxisLabels!: Selection<SVGGElement, unknown, null, undefined>;
    private gPolygons!: Selection<SVGGElement, unknown, null, undefined>;
    private gDots!: Selection<SVGGElement, unknown, null, undefined>;
    private legendContainer!: HTMLElement;
    private errorOverlay!: HTMLElement;

    /* ═══════════════════════════════════════════════
       Constructor – build DOM skeleton once
       ═══════════════════════════════════════════════ */

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = this.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();

        /* Root container */
        this.container = el("div", "radar-container", options.element);

        /* SVG canvas */
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("class", "radar-svg");
        this.container.appendChild(this.svg);

        const root = select(this.svg);
        this.gGrid       = root.append("g").attr("class", "radar-grid-group");
        this.gGridLabels = root.append("g").attr("class", "radar-grid-labels-group");
        this.gPolygons   = root.append("g").attr("class", "radar-polygons-group");
        this.gDots       = root.append("g").attr("class", "radar-dots-group");
        this.gAxisLabels = root.append("g").attr("class", "radar-axis-labels-group");

        /* Click background to deselect */
        select(this.svg).on("click", () => {
            handleBackgroundClick(this.selectionManager);
            applySelectionStyles(this.svg, this.selectionManager);
        });

        /* Legend (HTML overlay) */
        this.legendContainer = el("div", "radar-legend", this.container);

        /* Error overlay */
        this.errorOverlay = el("div", "radar-error", this.container);
        this.errorOverlay.style.display = "none";

        /* Init empty data */
        this.radarData = { axes: [], series: [], hasData: false };
    }

    /* ═══════════════════════════════════════════════
       Update – data pipeline + render orchestration
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            /* ── Update-type gating (G1) ── */
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0;
            const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;

            /* ── Always rebuild formatting config ── */
            const dv = options.dataViews?.[0];
            if (dv) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
            }
            if (!this.formattingSettings) {
                this.formattingSettings = new VisualFormattingSettingsModel();
            }
            this.renderConfig = buildRenderConfig(this.formattingSettings);

            /* ── Data parse (skip on resize-only) ── */
            if (hasData || !isResizeOnly) {
                const categorical = dv?.categorical;
                const cols = resolveColumns(categorical);

                if (!cols) {
                    this.radarData = { axes: [], series: [], hasData: false };
                    this.showError(ERROR_MISSING_FIELDS);
                    return;
                }

                this.radarData = parseRadarData(
                    cols.categorical,
                    this.host,
                    this.renderConfig.color.colorPalette,
                );

                if (!this.radarData.hasData) {
                    this.showError(ERROR_MISSING_FIELDS);
                    return;
                }
            }

            this.hideError();
            this.layoutAndRender(options.viewport);
        } catch (_e) {
            /* Never throw from update (E1) */
            this.showError("An unexpected error occurred.");
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render
       ═══════════════════════════════════════════════ */

    private layoutAndRender(viewport: powerbi.IViewport): void {
        const w = viewport.width;
        const h = viewport.height;

        this.svg.setAttribute("width", String(w));
        this.svg.setAttribute("height", String(h));

        const cfg = this.renderConfig;
        const data = this.radarData;
        if (!data.hasData) return;

        /* Compute layout */
        const layout = computeRadarLayout(data, w, h, cfg);

        /* Render layers */
        renderGrid(this.gGrid, layout, data.axes.length, cfg);
        renderGridLabels(this.gGridLabels, layout, cfg);
        renderChart(this.gPolygons, this.gDots, data, layout, cfg, this.buildCallbacks());
        renderAxisLabels(this.gAxisLabels, data.axes, layout, cfg);
        renderLegend(this.legendContainer, data.series, cfg);

        /* Re-apply selection state */
        applySelectionStyles(this.svg, this.selectionManager);
    }

    /* ═══════════════════════════════════════════════
       Callbacks
       ═══════════════════════════════════════════════ */

    private buildCallbacks(): ChartCallbacks {
        return {
            onDotClick: (point: RadarDataPoint, event: MouseEvent) => {
                handlePointClick(point, event, this.selectionManager);
                applySelectionStyles(this.svg, this.selectionManager);
            },
            onPolygonClick: (series: RadarSeries, event: MouseEvent) => {
                /* Select first point of the series as representative */
                if (series.points.length > 0) {
                    handlePointClick(series.points[0], event, this.selectionManager);
                    applySelectionStyles(this.svg, this.selectionManager);
                }
            },
            onBackgroundClick: () => {
                handleBackgroundClick(this.selectionManager);
                applySelectionStyles(this.svg, this.selectionManager);
            },
            onMouseOver: (point: RadarDataPoint, x: number, y: number) => {
                this.showTooltip(point, x, y);
            },
            onMouseMove: (point: RadarDataPoint, x: number, y: number) => {
                this.showTooltip(point, x, y);
            },
            onMouseOut: () => {
                this.tooltipService.hide({ immediately: true, isTouchEvent: false });
            },
        };
    }

    /* ── Tooltips ── */

    private showTooltip(point: RadarDataPoint, x: number, y: number): void {
        const items: VisualTooltipDataItem[] = [
            { displayName: "Axis", value: point.axisName },
            { displayName: point.seriesName, value: point.formattedValue },
        ];
        for (const t of point.tooltipItems) {
            items.push({ displayName: t.displayName, value: t.value });
        }
        this.tooltipService.show({
            dataItems: items,
            identities: [point.selectionId],
            coordinates: [x, y],
            isTouchEvent: false,
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay
       ═══════════════════════════════════════════════ */

    private showError(msg: string): void {
        this.errorOverlay.textContent = msg;
        this.errorOverlay.style.display = "flex";
        this.svg.style.display = "none";
        this.legendContainer.style.display = "none";
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.svg.style.display = "";
        this.legendContainer.style.display = "";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
