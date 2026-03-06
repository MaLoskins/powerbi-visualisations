/*
 *  Advanced Pie / Donut Chart – Power BI Custom Visual
 *  visual.ts – Entry point / orchestrator
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { select, Selection } from "d3-selection";
import "d3-transition";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import { PieSlice, OuterSlice, RenderConfig, ParseResult, ChartCallbacks, LegendCallbacks } from "./types";
import { CHART_PADDING, dynamicLabelPadding } from "./constants";
import { resolveColumns } from "./model/columns";
import { parseSlices } from "./model/parser";
import { computeGeometry, renderArcs, renderOuterRing, renderBackground, ChartGeometry } from "./render/chart";
import { renderLabels, renderCentreLabel } from "./render/labels";
import { renderLegend, LegendMetrics } from "./render/legend";
import {
    applySelectionStyles,
    handleSliceClick,
    handleOuterSliceClick,
    handleBackgroundClick,
} from "./interactions/selection";
import { el } from "./utils/dom";
import { formatNumber, formatPercent } from "./utils/format";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {
    /* ── Power BI services ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings!: VisualFormattingSettingsModel;

    /* ── DOM elements (created once in constructor) ── */
    private container: HTMLDivElement;
    private legendTop: HTMLDivElement;
    private legendBottom: HTMLDivElement;
    private legendLeft: HTMLDivElement;
    private legendRight: HTMLDivElement;
    private chartWrapper: HTMLDivElement;
    private svgEl: SVGSVGElement;
    private errorOverlay: HTMLDivElement;

    /* ── State ── */
    private parseResult: ParseResult | null = null;
    private renderConfig: RenderConfig | null = null;
    private hasRenderedOnce: boolean = false;
    private selectedSlice: PieSlice | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();

        /* ── Build entire DOM skeleton once ── */
        const target = options.element;
        target.style.overflow = "hidden";

        this.container = el("div", "apie-container") as HTMLDivElement;
        target.appendChild(this.container);

        /* Legend containers (positioned via CSS flexbox) */
        this.legendTop = el("div", "apie-legend apie-legend-top") as HTMLDivElement;
        this.legendBottom = el("div", "apie-legend apie-legend-bottom") as HTMLDivElement;
        this.legendLeft = el("div", "apie-legend apie-legend-left") as HTMLDivElement;
        this.legendRight = el("div", "apie-legend apie-legend-right") as HTMLDivElement;

        /* Chart SVG wrapper */
        this.chartWrapper = el("div", "apie-chart-wrapper") as HTMLDivElement;
        this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgEl.setAttribute("class", "apie-svg");

        /* Create SVG groups in rendering order */
        const svgSel = select(this.svgEl);
        svgSel.append("g").attr("class", "apie-arcs-group");
        svgSel.append("g").attr("class", "apie-outer-ring-group");
        svgSel.append("g").attr("class", "apie-labels-group");
        svgSel.append("g").attr("class", "apie-centre-group");

        this.chartWrapper.appendChild(this.svgEl);

        /* Error overlay */
        this.errorOverlay = el("div", "apie-error") as HTMLDivElement;
        this.errorOverlay.style.display = "none";

        /* Assemble layout */
        this.container.appendChild(this.legendTop);
        const middle = el("div", "apie-middle") as HTMLDivElement;
        middle.appendChild(this.legendLeft);
        middle.appendChild(this.chartWrapper);
        middle.appendChild(this.legendRight);
        this.container.appendChild(middle);
        this.container.appendChild(this.legendBottom);
        this.container.appendChild(this.errorOverlay);

        /* ── Selection manager callback ── */
        this.selectionManager.registerOnSelectCallback(() => {
            if (this.renderConfig) {
                applySelectionStyles(this.svgEl, this.getActiveLegend(), this.selectionManager, this.renderConfig);
            }
        });
    }

    /* ═══════════════════════════════════════════════
       Update (U1)
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            /* ── Gate on update type ── */
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0;
            const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;

            /* Always rebuild config (cheap) */
            if (options.dataViews?.[0]) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
            }
            if (!this.formattingSettings) {
                this.formattingSettings = new VisualFormattingSettingsModel();
            }
            this.renderConfig = buildRenderConfig(this.formattingSettings);

            /* ── Data parse (skip on resize-only) ── */
            if (hasData || !this.hasRenderedOnce) {
                const dv = options.dataViews?.[0];
                if (!dv?.table || !dv.table.rows || dv.table.rows.length === 0) {
                    this.showError("Required fields missing.\nAdd at least Category and Value fields.");
                    return;
                }

                const cols = resolveColumns(dv.table);
                if (!cols) {
                    this.showError("Required fields missing.\nAdd at least Category and Value fields.");
                    return;
                }

                this.parseResult = parseSlices(dv.table, cols, this.host, this.renderConfig);

                if (this.parseResult.slices.length === 0) {
                    this.showError("No valid data to display.\nEnsure values are positive numbers.");
                    return;
                }
            }

            this.hideError();

            if (!this.parseResult || !this.renderConfig) return;

            /* ── Layout & Render ── */
            this.layoutAndRender(options.viewport);
            this.hasRenderedOnce = true;
        } catch (e) {
            console.error("Advanced Pie/Donut update error:", e);
            this.showError("An unexpected error occurred.");
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render Pipeline
       ═══════════════════════════════════════════════ */

    private layoutAndRender(viewport: powerbi.IViewport): void {
        if (!this.parseResult || !this.renderConfig) return;
        const cfg = this.renderConfig;
        const pr = this.parseResult;

        this.container.style.width = viewport.width + "px";
        this.container.style.height = viewport.height + "px";

        /* ── Legends ── */
        this.hideLegends();
        const activeLegend = this.getActiveLegendContainer();
        const legendMetrics = renderLegend(activeLegend, pr.slices, cfg, this.buildLegendCallbacks());

        /* ── Compute chart area ── */
        const legendH = (cfg.legend.legendPosition === "top" || cfg.legend.legendPosition === "bottom")
            ? activeLegend.offsetHeight : 0;
        const legendW = (cfg.legend.legendPosition === "left" || cfg.legend.legendPosition === "right")
            ? activeLegend.offsetWidth : 0;

        const padding = cfg.label.showLabels && cfg.label.labelPosition !== "inside"
            ? dynamicLabelPadding(viewport.width, viewport.height) : CHART_PADDING;
        const chartW = Math.max(50, viewport.width - legendW - padding * 2);
        const chartH = Math.max(50, viewport.height - legendH - padding * 2);

        this.chartWrapper.style.width = chartW + padding * 2 + "px";
        this.chartWrapper.style.height = chartH + padding * 2 + "px";

        /* ── SVG sizing ── */
        const svgW = chartW + padding * 2;
        const svgH = chartH + padding * 2;
        this.svgEl.setAttribute("width", String(svgW));
        this.svgEl.setAttribute("height", String(svgH));
        this.svgEl.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);

        /* ── Geometry ── */
        const geom = computeGeometry(chartW, chartH, cfg, pr.hasOuterCategory);

        /* Translate groups to centre */
        const cx = svgW / 2;
        const cy = svgH / 2;
        const svgTranslate = this.svgSelection();
        svgTranslate.select(".apie-arcs-group").attr("transform", `translate(${cx},${cy})`);
        svgTranslate.select(".apie-outer-ring-group").attr("transform", `translate(${cx},${cy})`);
        svgTranslate.select(".apie-labels-group").attr("transform", `translate(${cx},${cy})`);
        svgTranslate.select(".apie-centre-group").attr("transform", `translate(${cx},${cy})`);

        /* ── Render ── */
        const callbacks = this.buildChartCallbacks();
        const svgSel = this.svgSelection();
        renderBackground(svgSel, svgW, svgH, callbacks.onBackgroundClick);
        renderArcs(svgSel, pr.slices, geom, cfg, callbacks);
        renderOuterRing(svgSel, pr.slices, geom, cfg, callbacks);
        renderLabels(svgSel, pr.slices, geom, cfg, svgW);
        renderCentreLabel(svgSel, pr.total, this.selectedSlice, cfg, geom);

        /* ── Selection styles ── */
        applySelectionStyles(this.svgEl, this.getActiveLegend(), this.selectionManager, cfg);
    }

    /* ═══════════════════════════════════════════════
       Callbacks (C7)
       ═══════════════════════════════════════════════ */

    private buildChartCallbacks(): ChartCallbacks {
        return {
            onSliceClick: (slice: PieSlice, event: MouseEvent) => {
                handleSliceClick(slice, event, this.selectionManager).then(() => {
                    this.selectedSlice = slice;
                    if (this.renderConfig) {
                        applySelectionStyles(this.svgEl, this.getActiveLegend(), this.selectionManager, this.renderConfig);
                        /* Update centre label for "measure" mode */
                        if (this.renderConfig.centreLabel.centreContent === "measure" && this.parseResult) {
                            const geom = this.getCurrentGeometry();
                            if (geom) {
                                renderCentreLabel(
                                    this.svgSelection(),
                                    this.parseResult.total, this.selectedSlice, this.renderConfig, geom,
                                );
                            }
                        }
                    }
                });
            },
            onOuterSliceClick: (slice: OuterSlice, event: MouseEvent) => {
                handleOuterSliceClick(slice, event, this.selectionManager).then(() => {
                    if (this.renderConfig) {
                        applySelectionStyles(this.svgEl, this.getActiveLegend(), this.selectionManager, this.renderConfig);
                    }
                });
            },
            onBackgroundClick: () => {
                handleBackgroundClick(this.selectionManager).then(() => {
                    this.selectedSlice = null;
                    if (this.renderConfig) {
                        applySelectionStyles(this.svgEl, this.getActiveLegend(), this.selectionManager, this.renderConfig);
                        if (this.renderConfig.centreLabel.centreContent === "measure" && this.parseResult) {
                            const geom = this.getCurrentGeometry();
                            if (geom) {
                                renderCentreLabel(
                                    this.svgSelection(),
                                    this.parseResult.total, null, this.renderConfig, geom,
                                );
                            }
                        }
                    }
                });
            },
            onSliceMouseOver: (slice: PieSlice | OuterSlice, event: MouseEvent) => {
                this.showTooltip(slice, event);
            },
            onSliceMouseMove: (slice: PieSlice | OuterSlice, event: MouseEvent) => {
                this.moveTooltip(event);
            },
            onSliceMouseOut: () => {
                this.hideTooltip();
            },
        };
    }

    private buildLegendCallbacks(): LegendCallbacks {
        return {
            onLegendClick: (slice: PieSlice, event: MouseEvent) => {
                handleSliceClick(slice, event, this.selectionManager).then(() => {
                    this.selectedSlice = slice;
                    if (this.renderConfig) {
                        applySelectionStyles(this.svgEl, this.getActiveLegend(), this.selectionManager, this.renderConfig);
                    }
                });
            },
        };
    }

    /* ═══════════════════════════════════════════════
       Tooltip Helpers (T1)
       ═══════════════════════════════════════════════ */

    private lastTooltipSlice: PieSlice | OuterSlice | null = null;

    private showTooltip(slice: PieSlice | OuterSlice, event: MouseEvent): void {
        this.lastTooltipSlice = slice;
        const items: VisualTooltipDataItem[] = [];

        items.push({ displayName: "Category", value: slice.category });
        items.push({ displayName: "Value", value: formatNumber(slice.value, 2) });
        items.push({ displayName: "Percentage", value: formatPercent(slice.percent) });

        /* Outer slice specific */
        if ("outerCategory" in slice && slice.outerCategory) {
            items.push({ displayName: "Sub-Category", value: slice.outerCategory });
        }

        /* Tooltip extras */
        if (slice.tooltipExtras) {
            for (const te of slice.tooltipExtras) {
                items.push({ displayName: te.displayName, value: te.value });
            }
        }

        /* "Other" breakdown */
        if ("isOther" in slice && slice.isOther && slice.otherChildren?.length > 0) {
            for (const child of slice.otherChildren) {
                items.push({
                    displayName: child.category,
                    value: `${formatNumber(child.value, 2)} (${formatPercent(child.percent)})`,
                });
            }
        }

        this.host.tooltipService.show({
            dataItems: items,
            identities: [slice.selectionId],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
        });
    }

    private moveTooltip(event: MouseEvent): void {
        if (!this.lastTooltipSlice) return;
        this.host.tooltipService.move({
            coordinates: [event.clientX, event.clientY],
            identities: [this.lastTooltipSlice.selectionId],
            isTouchEvent: false,
        });
    }

    private hideTooltip(): void {
        this.lastTooltipSlice = null;
        this.host.tooltipService.hide({
            immediately: true,
            isTouchEvent: false,
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay (E1)
       ═══════════════════════════════════════════════ */

    private showError(msg: string): void {
        this.errorOverlay.style.display = "flex";
        this.errorOverlay.textContent = msg;
        this.chartWrapper.style.display = "none";
        this.hideLegends();
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.chartWrapper.style.display = "block";
    }

    /* ═══════════════════════════════════════════════
       Legend Helpers
       ═══════════════════════════════════════════════ */

    private hideLegends(): void {
        this.legendTop.style.display = "none";
        this.legendBottom.style.display = "none";
        this.legendLeft.style.display = "none";
        this.legendRight.style.display = "none";
    }

    private getActiveLegendContainer(): HTMLDivElement {
        if (!this.renderConfig?.legend.showLegend) return this.legendBottom;
        switch (this.renderConfig.legend.legendPosition) {
            case "top": return this.legendTop;
            case "left": return this.legendLeft;
            case "right": return this.legendRight;
            default: return this.legendBottom;
        }
    }

    private getActiveLegend(): HTMLElement {
        return this.getActiveLegendContainer();
    }

    /** Get a typed d3 selection of the main SVG */
    private svgSelection(): Selection<SVGSVGElement, unknown, null, undefined> {
        return select(this.svgEl) as Selection<SVGSVGElement, unknown, null, undefined>;
    }

    private getCurrentGeometry(): ChartGeometry | null {
        if (!this.renderConfig || !this.parseResult) return null;
        const svgW = Number(this.svgEl.getAttribute("width") || 0);
        const svgH = Number(this.svgEl.getAttribute("height") || 0);
        const padding = this.renderConfig.label.showLabels && this.renderConfig.label.labelPosition !== "inside"
            ? dynamicLabelPadding(svgW, svgH) : CHART_PADDING;
        return computeGeometry(svgW - padding * 2, svgH - padding * 2, this.renderConfig, this.parseResult.hasOuterCategory);
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
