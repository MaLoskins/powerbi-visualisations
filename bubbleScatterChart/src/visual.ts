/* ═══════════════════════════════════════════════
   Bubble Scatter Chart – Visual Orchestrator
   DOM scaffolding, data pipeline, render dispatch
   ═══════════════════════════════════════════════ */

"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { select } from "d3-selection";
import { zoomIdentity, ZoomTransform } from "d3-zoom";

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
    ChartDimensions,
    ScatterDataPoint,
    ParseResult,
} from "./types";
import {
    DEFAULT_MARGINS,
    PLAY_CONTROLS_HEIGHT,
    MIN_CHART_SIZE,
    SVG_NS,
} from "./constants";

/* ── Model ── */
import { resolveColumns, hasRequiredColumns } from "./model/columns";
import { parseRows } from "./model/parser";

/* ── Render ── */
import { buildScales, renderAxes, NumericScale } from "./render/axes";
import { renderBubbles, renderTrailBubbles, ChartCallbacks } from "./render/chart";
import { renderQuadrants } from "./render/quadrants";
import { renderTrendLine } from "./render/trendline";
import { renderLegend, getLegendSize } from "./render/legend";
import { renderDataLabels } from "./render/labels";

/* ── Interactions ── */
import {
    handleBubbleClick,
    handleBackgroundClick,
    applySelectionStyles,
} from "./interactions/selection";
import {
    initZoom,
    applyZoomToScales,
    resetZoom,
    ZoomState,
} from "./interactions/zoom";
import {
    buildPlayControls,
    filterPointsByFrame,
    getTrailPoints,
    destroyPlayControls,
    PlayAxisState,
} from "./interactions/playAxis";

/* ── Utils ── */
import { el } from "./utils/dom";
import { formatNumber } from "./utils/format";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {

    /* ── Power BI handles ── */
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings!: VisualFormattingSettingsModel;

    /* ── DOM skeleton (created once in constructor) ── */
    private container: HTMLDivElement;
    private errorOverlay: HTMLDivElement;
    private legendContainer: HTMLDivElement;
    private svgRoot: SVGSVGElement;
    private clipRect: SVGRectElement;
    private axisGroup: SVGGElement;
    private contentClipGroup: SVGGElement;
    private trailGroup: SVGGElement;
    private quadrantGroup: SVGGElement;
    private trendGroup: SVGGElement;
    private bubbleGroup: SVGGElement;
    private labelGroup: SVGGElement;
    private playContainer: HTMLDivElement;
    private resetBtn: HTMLButtonElement;

    /* ── State ── */
    private renderConfig: RenderConfig | null = null;
    private parseResult: ParseResult | null = null;
    private baseXScale: NumericScale | null = null;
    private baseYScale: NumericScale | null = null;
    private zoomState: ZoomState = { transform: zoomIdentity, behavior: null };
    private playState: PlayAxisState = { isPlaying: false, currentIndex: 0, timer: null };
    private currentDims: ChartDimensions | null = null;
    private hasRenderedOnce: boolean = false;

    /* ═══════════════════════════════════════════════
       Constructor — build all DOM once
       ═══════════════════════════════════════════════ */

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService();

        const target = options.element;

        /* ── Root container ── */
        this.container = el("div", "bscatter-container") as HTMLDivElement;
        target.appendChild(this.container);

        /* ── Error overlay (hidden by default) ── */
        this.errorOverlay = el("div", "bscatter-error") as HTMLDivElement;
        this.errorOverlay.style.display = "none";
        this.container.appendChild(this.errorOverlay);

        /* ── Legend container ── */
        this.legendContainer = el("div", "bscatter-legend") as HTMLDivElement;
        this.container.appendChild(this.legendContainer);

        /* ── SVG root ── */
        this.svgRoot = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.svgRoot.setAttribute("class", "bscatter-svg");
        this.container.appendChild(this.svgRoot);

        // Clip path for the plot area
        const defs = document.createElementNS(SVG_NS, "defs");
        const clipPath = document.createElementNS(SVG_NS, "clipPath");
        clipPath.setAttribute("id", "bscatter-clip");
        this.clipRect = document.createElementNS(SVG_NS, "rect") as SVGRectElement;
        clipPath.appendChild(this.clipRect);
        defs.appendChild(clipPath);
        this.svgRoot.appendChild(defs);

        // Axis group (outside clip so ticks are visible)
        this.axisGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.axisGroup.setAttribute("class", "bscatter-axis-group");
        this.svgRoot.appendChild(this.axisGroup);

        // Clipped content group
        this.contentClipGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.contentClipGroup.setAttribute("clip-path", "url(#bscatter-clip)");
        this.svgRoot.appendChild(this.contentClipGroup);

        // Sub-groups in draw order
        this.trailGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.trailGroup.setAttribute("class", "bscatter-trails");
        this.contentClipGroup.appendChild(this.trailGroup);

        this.quadrantGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.quadrantGroup.setAttribute("class", "bscatter-quadrants");
        this.contentClipGroup.appendChild(this.quadrantGroup);

        this.trendGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.trendGroup.setAttribute("class", "bscatter-trend");
        this.contentClipGroup.appendChild(this.trendGroup);

        this.bubbleGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.bubbleGroup.setAttribute("class", "bscatter-bubbles");
        this.contentClipGroup.appendChild(this.bubbleGroup);

        this.labelGroup = document.createElementNS(SVG_NS, "g") as SVGGElement;
        this.labelGroup.setAttribute("class", "bscatter-labels");
        this.contentClipGroup.appendChild(this.labelGroup);

        /* ── Play controls container ── */
        this.playContainer = el("div", "bscatter-play-controls") as HTMLDivElement;
        this.playContainer.style.display = "none";
        this.container.appendChild(this.playContainer);

        /* ── Reset zoom button ── */
        this.resetBtn = document.createElement("button");
        this.resetBtn.className = "bscatter-reset-btn";
        this.resetBtn.textContent = "Reset Zoom";
        this.resetBtn.style.display = "none";
        this.resetBtn.addEventListener("click", () => this.handleResetZoom());
        this.container.appendChild(this.resetBtn);

        /* ── Background click to deselect ── */
        this.svgRoot.addEventListener("click", (e: MouseEvent) => {
            const tgt = e.target as Element;
            if (tgt === this.svgRoot || tgt.classList.contains("bscatter-bg-rect")) {
                handleBackgroundClick(this.selectionManager, () => {
                    this.applySelection();
                });
            }
        });
    }

    /* ═══════════════════════════════════════════════
       Update — data pipeline + render orchestration
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            /* ── Update type gating ── */
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0 || !this.hasRenderedOnce;

            /* ── Always rebuild config ── */
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews?.[0],
            );
            this.renderConfig = buildRenderConfig(this.formattingSettings);

            /* ── Validate data ── */
            const dataView = options.dataViews?.[0];
            if (!dataView || !dataView.table) {
                this.showError("Required fields missing.\nAdd X Value, Y Value, and Category fields.");
                return;
            }

            const table = dataView.table;
            const cols = resolveColumns(table);

            if (!hasRequiredColumns(cols)) {
                this.showError("Required fields missing.\nAdd X Value, Y Value, and Category fields.");
                return;
            }

            this.hideError();

            /* ── Parse data (skip on resize-only) ── */
            if (hasData || !this.parseResult) {
                // Destroy existing play timer
                destroyPlayControls(this.playState);

                this.parseResult = parseRows(
                    table,
                    cols,
                    this.host,
                    this.renderConfig.color.defaultBubbleColor,
                    this.renderConfig.color.colorByCategory,
                );
            }

            /* ── Layout + Render ── */
            this.layoutAndRender(options);
            this.hasRenderedOnce = true;

        } catch (err) {
            console.error("[bscatter] Update error:", err);
            this.showError("An unexpected error occurred.");
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render Pipeline
       ═══════════════════════════════════════════════ */

    private layoutAndRender(options: VisualUpdateOptions): void {
        const cfg = this.renderConfig!;
        const result = this.parseResult!;
        const vp = options.viewport;

        /* ── Compute dimensions ── */
        const legendEntries = result.hasSeries ? result.seriesValues : result.categoryValues;
        const legendSize = getLegendSize(cfg.legend, legendEntries.length);
        const playHeight = result.hasPlayAxis && cfg.play.showPlayControls ? PLAY_CONTROLS_HEIGHT : 0;

        const margins = { ...DEFAULT_MARGINS };
        if (cfg.axis.yAxisLabel) margins.left += 16;
        if (cfg.axis.xAxisLabel) margins.bottom += 16;

        // Legend reduces available space
        let chartWidth = vp.width;
        let chartHeight = vp.height - playHeight;

        if (cfg.legend.showLegend && legendEntries.length > 0) {
            const pos = cfg.legend.legendPosition;
            if (pos === "top" || pos === "bottom") chartHeight -= legendSize;
            else chartWidth -= legendSize;
        }

        const plotWidth = Math.max(0, chartWidth - margins.left - margins.right);
        const plotHeight = Math.max(0, chartHeight - margins.top - margins.bottom);

        this.currentDims = {
            width: chartWidth,
            height: chartHeight,
            plotWidth,
            plotHeight,
            margins,
        };

        /* ── Size check ── */
        if (plotWidth < MIN_CHART_SIZE || plotHeight < MIN_CHART_SIZE) {
            this.showError("Visual is too small to render.\nResize the visual.");
            return;
        }
        this.hideError();

        /* ── Position legend ── */
        this.positionLegend(cfg);

        /* ── Size SVG ── */
        this.svgRoot.setAttribute("width", String(chartWidth));
        this.svgRoot.setAttribute("height", String(chartHeight));

        // Translate axis group and content group by margins
        this.axisGroup.setAttribute("transform", `translate(${margins.left},${margins.top})`);
        this.contentClipGroup.setAttribute("transform", `translate(${margins.left},${margins.top})`);

        // Update clip rect
        this.clipRect.setAttribute("width", String(plotWidth));
        this.clipRect.setAttribute("height", String(plotHeight));

        /* ── Build base scales ── */
        const visiblePoints = this.getVisiblePoints(result);
        const { xScale, yScale } = buildScales(visiblePoints, this.currentDims, cfg.axis);
        this.baseXScale = xScale;
        this.baseYScale = yScale;

        /* ── Init zoom ── */
        this.zoomState = initZoom(
            this.svgRoot,
            cfg.zoom,
            this.currentDims,
            { onZoom: (_t: ZoomTransform) => this.onZoomTransform() },
        );

        /* ── Add background rect for click-to-deselect ── */
        const bgExists = this.contentClipGroup.querySelector(".bscatter-bg-rect");
        if (!bgExists) {
            const bgRect = document.createElementNS(SVG_NS, "rect");
            bgRect.setAttribute("class", "bscatter-bg-rect");
            bgRect.setAttribute("fill", "transparent");
            this.contentClipGroup.insertBefore(bgRect, this.contentClipGroup.firstChild);
        }
        const bgRect = this.contentClipGroup.querySelector(".bscatter-bg-rect")!;
        bgRect.setAttribute("width", String(plotWidth));
        bgRect.setAttribute("height", String(plotHeight));

        /* ── Reset button visibility ── */
        this.resetBtn.style.display = cfg.zoom.showResetButton && (cfg.zoom.enableZoom || cfg.zoom.enablePan) ? "block" : "none";

        /* ── Play controls ── */
        if (result.hasPlayAxis && cfg.play.showPlayControls) {
            this.playState = buildPlayControls(
                this.playContainer,
                result.playAxisValues,
                cfg.play,
                { onFrameChange: () => this.renderContent() },
            );
        } else {
            this.playContainer.style.display = "none";
        }

        /* ── Render legend ── */
        renderLegend(this.legendContainer, legendEntries, cfg.legend, cfg.color);

        /* ── Render content ── */
        this.renderContent();
    }

    /** Render (or re-render) all chart content using current scales + zoom. */
    private renderContent(): void {
        const cfg = this.renderConfig!;
        const result = this.parseResult!;
        const dims = this.currentDims!;

        if (!this.baseXScale || !this.baseYScale) return;

        /* ── Apply zoom to scales ── */
        const { xScaleZoomed, yScaleZoomed } = applyZoomToScales(
            this.zoomState.transform,
            this.baseXScale,
            this.baseYScale,
        );

        /* ── Get visible points (filtered by play axis) ── */
        const visiblePoints = this.getVisiblePoints(result);

        /* ── Axes ── */
        renderAxes(
            select(this.axisGroup),
            xScaleZoomed,
            yScaleZoomed,
            dims,
            cfg.axis,
        );

        /* ── Trail bubbles (play axis) ── */
        select(this.trailGroup).selectAll("*").remove();
        if (result.hasPlayAxis && cfg.play.trailOpacity > 0) {
            const trailPts = getTrailPoints(result.points, result.playAxisValues, this.playState.currentIndex);
            if (trailPts.length > 0) {
                renderTrailBubbles(
                    select(this.trailGroup),
                    trailPts,
                    xScaleZoomed,
                    yScaleZoomed,
                    cfg,
                    result.hasSize,
                );
            }
        }

        /* ── Quadrants ── */
        renderQuadrants(
            select(this.quadrantGroup),
            xScaleZoomed,
            yScaleZoomed,
            dims,
            cfg.quadrant,
        );

        /* ── Trend line ── */
        renderTrendLine(
            select(this.trendGroup),
            visiblePoints,
            xScaleZoomed,
            yScaleZoomed,
            dims,
            cfg.trend,
        );

        /* ── Bubbles ── */
        const chartCallbacks: ChartCallbacks = {
            onClick: (pt: ScatterDataPoint, ev: MouseEvent) => this.handleBubbleClick(pt, ev),
            onMouseOver: (pt: ScatterDataPoint, ev: MouseEvent) => this.handleTooltipShow(pt, ev),
            onMouseMove: (pt: ScatterDataPoint, ev: MouseEvent) => this.handleTooltipMove(pt, ev),
            onMouseOut: () => this.handleTooltipHide(),
        };

        renderBubbles(
            select(this.bubbleGroup),
            visiblePoints,
            xScaleZoomed,
            yScaleZoomed,
            cfg,
            result.hasSize,
            chartCallbacks,
        );

        /* ── Data labels ── */
        renderDataLabels(
            select(this.labelGroup),
            visiblePoints,
            xScaleZoomed,
            yScaleZoomed,
            cfg.label,
            cfg.axis,
            cfg.chart.minBubbleRadius,
            dims,
        );

        /* ── Selection styling ── */
        this.applySelection();
    }

    /* ═══════════════════════════════════════════════
       Helpers
       ═══════════════════════════════════════════════ */

    private getVisiblePoints(result: ParseResult): ScatterDataPoint[] {
        if (result.hasPlayAxis && result.playAxisValues.length > 0) {
            return filterPointsByFrame(
                result.points,
                result.playAxisValues,
                this.playState.currentIndex,
            );
        }
        return result.points;
    }

    private positionLegend(cfg: RenderConfig): void {
        const pos = cfg.legend.legendPosition;
        this.legendContainer.style.order = "";
        this.container.style.flexDirection = "column";

        if (pos === "top") {
            this.legendContainer.style.order = "-1";
        } else if (pos === "bottom") {
            this.legendContainer.style.order = "10";
        } else if (pos === "left") {
            this.container.style.flexDirection = "row";
            this.legendContainer.style.order = "-1";
            this.legendContainer.style.flexDirection = "column";
        } else if (pos === "right") {
            this.container.style.flexDirection = "row";
            this.legendContainer.style.order = "10";
            this.legendContainer.style.flexDirection = "column";
        }
    }

    /* ── Zoom ── */

    private onZoomTransform(): void {
        this.renderContent();
    }

    private handleResetZoom(): void {
        resetZoom(this.svgRoot, this.zoomState);
    }

    /* ── Selection ── */

    private handleBubbleClick(point: ScatterDataPoint, event: MouseEvent): void {
        handleBubbleClick(point, event, this.selectionManager, () => {
            this.applySelection();
        });
    }

    private applySelection(): void {
        if (!this.parseResult) return;
        const visiblePoints = this.getVisiblePoints(this.parseResult);
        applySelectionStyles(
            this.bubbleGroup,
            this.selectionManager,
            visiblePoints,
        );
    }

    /* ── Tooltips ── */

    private handleTooltipShow(point: ScatterDataPoint, event: MouseEvent): void {
        const tooltipItems = this.buildTooltipItems(point);
        this.host.tooltipService.show({
            dataItems: tooltipItems,
            identities: [point.selectionId],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
        });
    }

    private handleTooltipMove(point: ScatterDataPoint, event: MouseEvent): void {
        const tooltipItems = this.buildTooltipItems(point);
        this.host.tooltipService.move({
            dataItems: tooltipItems,
            identities: [point.selectionId],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
        });
    }

    private handleTooltipHide(): void {
        this.host.tooltipService.hide({
            immediately: true,
            isTouchEvent: false,
        });
    }

    private buildTooltipItems(point: ScatterDataPoint): VisualTooltipDataItem[] {
        const items: VisualTooltipDataItem[] = [
            { displayName: "Category", value: point.category },
        ];
        if (point.series) {
            items.push({ displayName: "Series", value: point.series });
        }
        items.push(
            { displayName: "X", value: formatNumber(point.x) },
            { displayName: "Y", value: formatNumber(point.y) },
        );
        if (point.size != null) {
            items.push({ displayName: "Size", value: formatNumber(point.size) });
        }
        // User-defined tooltip fields
        for (const extra of point.tooltipExtras) {
            items.push({ displayName: extra.displayName, value: extra.value });
        }
        return items;
    }

    /* ── Error overlay ── */

    private showError(msg: string): void {
        this.errorOverlay.textContent = msg;
        this.errorOverlay.style.display = "flex";
        this.svgRoot.style.display = "none";
        this.legendContainer.style.display = "none";
        this.playContainer.style.display = "none";
        this.resetBtn.style.display = "none";
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
