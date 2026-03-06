/*
 *  Marimekko Chart – Power BI Custom Visual
 *  visual.ts — Entry point / orchestrator
 *
 *  DOM is created once in the constructor.
 *  update() gates on VisualUpdateType flags.
 *  Render logic is delegated to render/ modules.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import * as d3 from "d3-selection";

import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import {
    RenderConfig,
    ParseResult,
    MekkoColumn,
    MekkoSegment,
    ChartCallbacks,
    LegendPosition,
} from "./types";
import {
    responsiveMargins,
    LEGEND_AREA_HEIGHT,
    LEGEND_AREA_MAX_HEIGHT,
    LEGEND_AREA_WIDTH,
    ERROR_CLASS,
    FALLBACK_SEGMENT_COLOR,
} from "./constants";

import { resolveColumns } from "./model/columns";
import { parseData } from "./model/parser";
import { buildSegmentColorMap } from "./utils/color";
import { el } from "./utils/dom";
import { formatPercent, formatCompact } from "./utils/format";
import { layoutColumns, ensureHatchPattern, renderSegments, attachBackgroundClick } from "./render/chart";
import { renderYAxis, renderXAxis, renderWidthLabels, extraBottomForRotation } from "./render/axes";
import { renderSegmentLabels } from "./render/labels";
import { renderLegend } from "./render/legend";
import { applySelectionStyles, getSelectedRowSet } from "./interactions/selection";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {
    /* ── Power BI services ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;

    /* ── DOM elements (created once in constructor) ── */
    private container: HTMLDivElement;
    private errorOverlay: HTMLDivElement;
    private legendContainer: HTMLDivElement;
    private svgRoot: SVGSVGElement;
    private chartG: SVGGElement;

    /* ── State ── */
    private data: ParseResult | null;
    private config: RenderConfig | null;
    private colorMap: Map<string, string>;
    private selectedSegments: MekkoSegment[];
    private hasRenderedOnce: boolean;

    /* ═══════════════════════════════════════════════
       Constructor — build all DOM once
       ═══════════════════════════════════════════════ */

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();
        this.formattingSettings = new VisualFormattingSettingsModel();
        this.data = null;
        this.config = null;
        this.colorMap = new Map();
        this.selectedSegments = [];
        this.hasRenderedOnce = false;

        /* Root container */
        this.container = el("div", "marimekko-container") as HTMLDivElement;
        options.element.appendChild(this.container);

        /* Error overlay (hidden by default) */
        this.errorOverlay = el("div", ERROR_CLASS) as HTMLDivElement;
        this.errorOverlay.style.display = "none";
        this.container.appendChild(this.errorOverlay);

        /* Legend container */
        this.legendContainer = el("div", "marimekko-legend") as HTMLDivElement;
        this.container.appendChild(this.legendContainer);

        /* SVG root */
        this.svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
        this.svgRoot.setAttribute("class", "marimekko-svg");
        this.container.appendChild(this.svgRoot);

        /* Chart group (offset by margins) */
        this.chartG = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
        this.chartG.setAttribute("class", "marimekko-chart-g");
        this.svgRoot.appendChild(this.chartG);

        /* Selection manager callback — re-apply styles on external selection change */
        this.selectionManager.registerOnSelectCallback(() => {
            if (this.data && this.config) {
                const rows = getSelectedRowSet(this.selectedSegments);
                applySelectionStyles(
                    d3.select(this.chartG),
                    rows,
                    this.config.color.selectedColor,
                );
            }
        });
    }

    /* ═══════════════════════════════════════════════
       Update
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            /* ── Gate on update type ── */
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0;

            /* ── Always rebuild config (cheap) ── */
            const dv = options.dataViews?.[0];
            if (dv) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
            }
            this.config = buildRenderConfig(this.formattingSettings);

            /* ── Data parse (skip on resize-only) ── */
            if (hasData || !this.hasRenderedOnce) {
                if (!dv || !dv.table) {
                    this.showError("Required fields missing.\nAdd Column Category, Segment Category, and Value.");
                    return;
                }

                const cols = resolveColumns(dv.table);
                if (!cols) {
                    this.showError("Required fields missing.\nAdd Column Category, Segment Category, and Value.");
                    return;
                }

                this.data = parseData(dv.table, cols, this.host);

                if (this.data.columns.length === 0) {
                    this.showError("No data to display.\nEnsure your data contains valid values.");
                    return;
                }

                /* Assign colours */
                this.colorMap = buildSegmentColorMap(
                    this.data.segmentCategories,
                    this.config.color.colorPalette,
                );
                for (const col of this.data.columns) {
                    for (const seg of col.segments) {
                        seg.color = this.colorMap.get(seg.segmentCategory) ?? FALLBACK_SEGMENT_COLOR;
                    }
                }
            }

            if (!this.data || !this.config) return;

            this.hideError();
            this.layoutAndRender(options.viewport);
            this.hasRenderedOnce = true;

        } catch (e) {
            /* Never throw from update() */
            console.error("Marimekko Chart update error:", e);
            this.showError("An unexpected error occurred.");
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render
       ═══════════════════════════════════════════════ */

    private layoutAndRender(viewport: powerbi.IViewport): void {
        if (!this.data || !this.config) return;

        const cfg = this.config;
        const data = this.data;

        /* ── Compute responsive margins based on viewport ── */
        const margins = responsiveMargins(viewport.width, viewport.height);

        /* ── Compute available chart area ── */
        const legendPos = cfg.legend.legendPosition;
        const showLegend = cfg.legend.showLegend;

        let legendHeight = 0;
        let legendWidth = 0;
        if (showLegend) {
            if (legendPos === "top" || legendPos === "bottom") {
                legendHeight = LEGEND_AREA_HEIGHT;
            } else {
                legendWidth = Math.min(LEGEND_AREA_WIDTH, Math.round(viewport.width * 0.25));
            }
        }

        const extraBottom = cfg.axis.showXAxis ? extraBottomForRotation(cfg.axis.xLabelRotation) : 0;
        const yAxisWidth = cfg.axis.showYAxis ? margins.left : Math.round(margins.right);
        const widthLabelTop = cfg.axis.showWidthLabels ? 18 : 0;

        const svgWidth = viewport.width - legendWidth;
        const svgHeight = viewport.height - legendHeight;

        const chartWidth = Math.max(0, svgWidth - yAxisWidth - margins.right);
        const chartHeight = Math.max(0, svgHeight - margins.top - margins.bottom - extraBottom - widthLabelTop);

        /* ── Position SVG and apply clip to prevent label overflow ── */
        this.svgRoot.setAttribute("width", String(svgWidth));
        this.svgRoot.setAttribute("height", String(svgHeight));
        this.svgRoot.style.overflow = "hidden";

        const translateX = yAxisWidth;
        const translateY = margins.top + widthLabelTop;
        this.chartG.setAttribute("transform", `translate(${translateX}, ${translateY})`);

        /* ── Layout columns ── */
        layoutColumns(data.columns, chartWidth, chartHeight, cfg.chart.columnGap, cfg.chart.segmentGap);

        /* ── Clear and render SVG ── */
        const svg = d3.select(this.svgRoot);
        const chartGSel = d3.select(this.chartG);

        /* Remove all children except defs */
        chartGSel.selectAll("*").remove();

        /* Hatch pattern for negatives */
        if (data.hasNegatives) {
            ensureHatchPattern(svg as d3.Selection<SVGSVGElement, unknown, null, undefined>);
        }

        /* Callbacks for interactions */
        const callbacks: ChartCallbacks = {
            onSegmentClick: (seg, event) => this.handleSegmentClick(seg, event),
            onBackgroundClick: () => this.handleBackgroundClick(),
        };

        /* Gridlines + Y-axis (render first so they're behind segments) */
        renderYAxis(chartGSel, cfg.axis, chartHeight, chartWidth);

        /* Segments */
        renderSegments(chartGSel, data.columns, cfg, callbacks);

        /* X-axis */
        renderXAxis(chartGSel, data.columns, cfg.axis, chartHeight);

        /* Width labels */
        renderWidthLabels(chartGSel, data.columns, cfg.axis);

        /* Segment labels */
        renderSegmentLabels(chartGSel, data.columns, cfg);

        /* Background click */
        attachBackgroundClick(
            svg as d3.Selection<SVGSVGElement, unknown, null, undefined>,
            callbacks,
        );

        /* ── Legend ── */
        this.positionLegend(cfg, viewport, legendPos, svgHeight);
        renderLegend(this.legendContainer, data.segmentCategories, this.colorMap, cfg.legend);

        /* ── Tooltips ── */
        this.attachTooltips(data.columns);

        /* ── Re-apply selection if any ── */
        const rows = getSelectedRowSet(this.selectedSegments);
        applySelectionStyles(chartGSel, rows, cfg.color.selectedColor);
    }

    /* ═══════════════════════════════════════════════
       Legend Positioning
       ═══════════════════════════════════════════════ */

    private positionLegend(
        cfg: RenderConfig,
        viewport: powerbi.IViewport,
        position: LegendPosition,
        svgHeight: number,
    ): void {
        const lc = this.legendContainer;

        if (!cfg.legend.showLegend) {
            lc.style.display = "none";
            return;
        }

        lc.style.position = "absolute";
        lc.style.overflow = "auto";

        /* Cap the right-side legend width to 25% of viewport */
        const effectiveLegendWidth = Math.min(LEGEND_AREA_WIDTH, Math.round(viewport.width * 0.25));

        if (position === "top") {
            lc.style.top = "0";
            lc.style.left = "0";
            lc.style.right = "auto";
            lc.style.width = viewport.width + "px";
            lc.style.maxHeight = LEGEND_AREA_MAX_HEIGHT + "px";
            lc.style.height = "auto";
            lc.style.minHeight = LEGEND_AREA_HEIGHT + "px";
            this.svgRoot.style.marginTop = LEGEND_AREA_HEIGHT + "px";
        } else if (position === "bottom") {
            lc.style.top = svgHeight + "px";
            lc.style.left = "0";
            lc.style.right = "auto";
            lc.style.width = viewport.width + "px";
            lc.style.maxHeight = LEGEND_AREA_MAX_HEIGHT + "px";
            lc.style.height = "auto";
            lc.style.minHeight = LEGEND_AREA_HEIGHT + "px";
            this.svgRoot.style.marginTop = "0";
        } else {
            /* right */
            lc.style.top = "0";
            lc.style.right = "0";
            lc.style.left = "auto";
            lc.style.width = effectiveLegendWidth + "px";
            lc.style.height = viewport.height + "px";
            lc.style.maxHeight = "";
            lc.style.minHeight = "";
            this.svgRoot.style.marginTop = "0";
        }
    }

    /* ═══════════════════════════════════════════════
       Tooltips
       ═══════════════════════════════════════════════ */

    private attachTooltips(columns: MekkoColumn[]): void {
        const tooltipService = this.host.tooltipService;
        if (!tooltipService) return;

        const chartGSel = d3.select(this.chartG);

        chartGSel.selectAll<SVGGElement, unknown>(".marimekko-segment").each(function () {
            const segG = d3.select(this);

            segG.on("mouseover", (event: MouseEvent) => {
                /* Find matching segment data from DOM attributes */
                const rowStr = segG.attr("data-row");
                const segName = segG.attr("data-segment");
                const seg = findSegment(columns, segName, parseInt(rowStr ?? "-1", 10));
                if (!seg) return;

                const items: VisualTooltipDataItem[] = [
                    { displayName: "Column", value: seg.xCategory },
                    { displayName: "Segment", value: seg.segmentCategory },
                    { displayName: "Value", value: formatCompact(seg.value) },
                    { displayName: "% of Column", value: formatPercent(seg.fractionOfColumn) },
                    { displayName: "% of Total", value: formatPercent(seg.fractionOfTotal) },
                ];

                if (seg.isNegative) {
                    items.push({ displayName: "Warning", value: "Original value is negative" });
                }

                for (const extra of seg.tooltipExtras) {
                    items.push({ displayName: extra.displayName, value: extra.value });
                }

                tooltipService.show({
                    dataItems: items,
                    identities: seg.selectionId ? [seg.selectionId] : [],
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: false,
                });
            });

            segG.on("mousemove", (event: MouseEvent) => {
                tooltipService.move({
                    dataItems: [],
                    identities: [],
                    coordinates: [event.clientX, event.clientY],
                    isTouchEvent: false,
                });
            });

            segG.on("mouseout", () => {
                tooltipService.hide({ immediately: true, isTouchEvent: false });
            });
        });
    }

    /* ═══════════════════════════════════════════════
       Selection Handlers
       ═══════════════════════════════════════════════ */

    private handleSegmentClick(segment: MekkoSegment, event: MouseEvent): void {
        if (!segment.selectionId) return;

        const isMulti = event.ctrlKey || event.metaKey;

        if (isMulti) {
            /* Toggle segment in/out of selection */
            const idx = this.selectedSegments.findIndex((s) => s.rowIndex === segment.rowIndex);
            if (idx >= 0) {
                this.selectedSegments.splice(idx, 1);
            } else {
                this.selectedSegments.push(segment);
            }
        } else {
            this.selectedSegments = [segment];
        }

        const ids = this.selectedSegments
            .map((s) => s.selectionId)
            .filter((id): id is powerbi.visuals.ISelectionId => id !== null);

        this.selectionManager.select(ids, false).then(() => {
            if (this.config) {
                const rows = getSelectedRowSet(this.selectedSegments);
                applySelectionStyles(
                    d3.select(this.chartG),
                    rows,
                    this.config.color.selectedColor,
                );
            }
        });
    }

    private handleBackgroundClick(): void {
        this.selectedSegments = [];
        this.selectionManager.clear().then(() => {
            if (this.config) {
                applySelectionStyles(
                    d3.select(this.chartG),
                    new Set(),
                    this.config.color.selectedColor,
                );
            }
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay
       ═══════════════════════════════════════════════ */

    private showError(msg: string): void {
        this.errorOverlay.textContent = msg;
        this.errorOverlay.style.display = "flex";
        this.svgRoot.style.display = "none";
        this.legendContainer.style.display = "none";
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.svgRoot.style.display = "";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}

/* ── Helper ── */

function findSegment(
    columns: MekkoColumn[],
    segName: string | null,
    rowIndex: number,
): MekkoSegment | null {
    for (const col of columns) {
        for (const seg of col.segments) {
            if (seg.rowIndex === rowIndex && seg.segmentCategory === segName) {
                return seg;
            }
        }
    }
    return null;
}
