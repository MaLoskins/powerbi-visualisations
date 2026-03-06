import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import type { GanttTask, RenderConfig, ZoomLevel } from "./types";
import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import { resolveColumns } from "./model/columns";
import { parseLeafRows } from "./model/parser";
import {
    buildMultiColumnHierarchy, buildExplicitParentHierarchy,
    applySortRecursive, flattenVisible,
    expandAll, collapseAll, toggleExpand,
    computeCriticalPath,
} from "./model/hierarchy";
import { computeTimeRange, computePxPerDay, buildTimeScale } from "./layout/timeScale";
import { renderGridHeader, renderGridBody } from "./render/grid";
import { renderTimelineHeader, renderTimelineBody } from "./render/timeline";
import { Toolbar } from "./ui/toolbar";
import { ScrollbarStyler } from "./ui/scrollbars";
import { applySelectionStyles, handleTaskClick } from "./interactions/selection";
import { el, clamp } from "./utils/dom";
import { formatDateCustom, daysBetween } from "./utils/date";

/* ═══════════════════════════════════════════════
   Visual (orchestrator)
   ═══════════════════════════════════════════════ */
export class Visual implements IVisual {
    private host: IVisualHost;
    private selectionManager: powerbi.extensibility.ISelectionManager;
    private fmtService: FormattingSettingsService;
    private fmtModel!: VisualFormattingSettingsModel;

    /* DOM scaffolding (created once in constructor) */
    private container: HTMLDivElement;
    private errorOverlay: HTMLDivElement;
    private toolbarEl: HTMLDivElement;
    private mainArea: HTMLDivElement;
    private gridPane: HTMLDivElement;
    private gridHeader: HTMLDivElement;
    private gridBody: HTMLDivElement;
    private timelinePane: HTMLDivElement;
    private timelineHeaderWrap: HTMLDivElement;
    private timelineBodyWrap: HTMLDivElement;
    private timelineHeaderSvg: SVGSVGElement;
    private timelineBodySvg: SVGSVGElement;
    private resizeHandle: HTMLDivElement;

    /* Module instances */
    private toolbar: Toolbar;
    private scrollbarStyler: ScrollbarStyler;

    /* Data model */
    private allLeafTasks: GanttTask[] = [];
    private rootTasks: GanttTask[] = [];
    private flatVisible: GanttTask[] = [];
    private expandedSet = new Set<string>();
    private taskById = new Map<string, GanttTask>();
    private hierarchyColumnNames: string[] = [];

    /* View state */
    private timeMin = new Date();
    private timeMax = new Date();
    private currentZoom: ZoomLevel = "fit";
    private pxPerDay = 5;
    private searchTerm = "";
    private isResizingGrid = false;
    private userGridWidth: number | null = null;
    private viewportWidth = 800;
    private viewportHeight = 600;
    private hasRenderedOnce = false;
    private cfg!: RenderConfig;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.fmtService = new FormattingSettingsService();
        this.scrollbarStyler = new ScrollbarStyler();

        /* Build DOM skeleton once (G2) */
        this.container = el("div", "gantt-container");
        options.element.appendChild(this.container);

        this.errorOverlay = el("div", "gantt-error");
        this.container.appendChild(this.errorOverlay);

        this.toolbarEl = el("div", "gantt-toolbar");
        this.container.appendChild(this.toolbarEl);

        this.toolbar = new Toolbar(this.toolbarEl, {
            onZoom: (z) => this.setZoom(z),
            onExpandAll: () => this.doExpandAll(),
            onCollapseAll: () => this.doCollapseAll(),
            onScrollToToday: () => this.scrollToToday(),
            onSearch: (t) => { this.searchTerm = t; this.refreshVisibleAndRender(); },
        });

        this.mainArea = el("div", "gantt-main");
        this.container.appendChild(this.mainArea);

        this.gridPane = el("div", "gantt-grid");
        this.mainArea.appendChild(this.gridPane);

        this.gridHeader = el("div", "gantt-grid-header");
        this.gridPane.appendChild(this.gridHeader);

        this.gridBody = el("div", "gantt-grid-body");
        this.gridPane.appendChild(this.gridBody);

        this.resizeHandle = el("div", "gantt-resize-handle");
        this.mainArea.appendChild(this.resizeHandle);
        this.initResizeHandle();

        this.timelinePane = el("div", "gantt-timeline");
        this.mainArea.appendChild(this.timelinePane);

        this.timelineHeaderWrap = el("div", "gantt-timeline-header");
        this.timelinePane.appendChild(this.timelineHeaderWrap);

        this.timelineHeaderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.timelineHeaderWrap.appendChild(this.timelineHeaderSvg);

        this.timelineBodyWrap = el("div", "gantt-timeline-body");
        this.timelinePane.appendChild(this.timelineBodyWrap);

        this.timelineBodySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.timelineBodyWrap.appendChild(this.timelineBodySvg);

        /* Scroll sync */
        this.timelineBodyWrap.addEventListener("scroll", () => {
            this.gridBody.scrollTop = this.timelineBodyWrap.scrollTop;
            this.timelineHeaderWrap.scrollLeft = this.timelineBodyWrap.scrollLeft;
        });
        this.gridBody.addEventListener("scroll", () => {
            this.timelineBodyWrap.scrollTop = this.gridBody.scrollTop;
        });

        /* Click-to-deselect */
        this.timelineBodySvg.addEventListener("click", (e: MouseEvent) => {
            if ((e.target as Element) === this.timelineBodySvg) {
                this.selectionManager.clear();
                this.applySelection();
            }
        });
    }

    /* ─── Grid resize handle ─── */
    private initResizeHandle(): void {
        let startX = 0;
        let startWidth = 0;

        const onMouseMove = (ev: MouseEvent): void => {
            if (!this.isResizingGrid) return;
            const maxW = Math.max(200, this.viewportWidth * 0.7);
            this.gridPane.style.width = clamp(startWidth + ev.clientX - startX, 100, maxW) + "px";
        };
        const onMouseUp = (): void => {
            this.isResizingGrid = false;
            this.userGridWidth = this.gridPane.offsetWidth;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            this.container.classList.remove("gantt-resizing");
        };
        this.resizeHandle.addEventListener("mousedown", (ev: MouseEvent) => {
            this.isResizingGrid = true;
            startX = ev.clientX;
            startWidth = this.gridPane.offsetWidth;
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
            this.container.classList.add("gantt-resizing");
            ev.preventDefault();
        });
    }

    /* ═══════════════════════════════════════════════
       UPDATE – with type gating (G1)
       ═══════════════════════════════════════════════ */
    public update(options: VisualUpdateOptions): void {
        this.viewportWidth = options.viewport.width;
        this.viewportHeight = options.viewport.height;
        this.container.style.width = this.viewportWidth + "px";
        this.container.style.height = this.viewportHeight + "px";

        /* VisualUpdateType bit flags (const enum – numeric literals only):
           Data = 2, Resize = 4, ViewMode = 8, ResizeEnd = 16, Style = 32 */
        const updateType = options.type ?? 0;
        const hasData = (updateType & 2) !== 0;
        const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;

        /* G1: Resize-only – skip data parse, just re-layout + re-render */
        if (isResizeOnly && this.cfg) {
            this.layoutAndRender();
            return;
        }

        const dv = options.dataViews?.[0];
        if (!dv) { this.showError("No data. Add fields to the visual."); return; }

        /* Always refresh formatting model from dataView */
        this.fmtModel = this.fmtService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
        this.cfg = buildRenderConfig(this.fmtModel);

        /* G1: If we already have parsed data and this is not a data update,
           skip the full parse pipeline (pure formatting / style change). */
        if (!hasData && this.flatVisible.length > 0) {
            this.layoutAndRender();
            return;
        }

        /* ─── Full data pipeline ─── */
        const table = dv.table;
        if (!table?.rows?.length) { this.showError("No rows in data."); return; }

        const cols = resolveColumns(table);
        if (cols.taskNames.length === 0 || cols.startDate < 0 || cols.endDate < 0) {
            this.showError("Required fields missing.\nAdd at least one Task Name field, plus Start Date and End Date.");
            return;
        }

        this.hierarchyColumnNames = cols.taskNames.map(i => table.columns[i].displayName || "Task");
        this.hideError();

        /* Parse → hierarchy → sort → flatten */
        const parsed = parseLeafRows(table, cols, this.host);
        this.allLeafTasks = parsed.tasks;
        this.taskById = parsed.taskById;

        if (cols.taskNames.length > 1) {
            this.rootTasks = buildMultiColumnHierarchy(this.allLeafTasks, cols.taskNames.length, this.taskById, this.expandedSet);
        } else {
            this.rootTasks = buildExplicitParentHierarchy(this.allLeafTasks, this.taskById, this.expandedSet);
        }

        applySortRecursive(this.rootTasks, this.cfg.task.sortBy, this.cfg.task.sortDirection);
        this.flatVisible = flattenVisible(this.rootTasks, this.searchTerm);

        /* Time range + critical path */
        const range = computeTimeRange(this.allLeafTasks, this.cfg.timeline.timelinePadding);
        this.timeMin = range.min;
        this.timeMax = range.max;

        if (this.cfg.criticalPath.showCriticalPath) {
            computeCriticalPath(this.allLeafTasks, this.taskById);
        } else {
            for (const t of this.allLeafTasks) t.isCritical = false;
        }

        /* Apply config zoom ONLY on first render – user toolbar choices persist */
        if (!this.hasRenderedOnce) {
            this.currentZoom = this.cfg.timeline.defaultZoom;
            this.hasRenderedOnce = true;
        }

        this.layoutAndRender();
    }

    /* ═══════════════════════════════════════════════
       Render orchestration
       ═══════════════════════════════════════════════ */

    /**
     * Single consistent exit point: apply layout CSS → recompute scale → render DOM.
     * Every update path and user interaction that needs a visual refresh
     * should call this method rather than renderAll() directly.
     */
    private layoutAndRender(): void {
        this.applyLayoutConfig();
        this.renderAll();
    }

    private renderAll(): void {
        const cfg = this.cfg;
        if (!cfg) return;

        /* Recompute pxPerDay from current layout — reading clientWidth
           forces a synchronous reflow so any pending CSS changes
           (from applyLayoutConfig) are reflected before we measure. */
        this.computeAndSetPxPerDay();
        const scale = buildTimeScale(this.timeMin, this.timeMax, this.pxPerDay);

        /* Grid */
        renderGridHeader(this.gridHeader, cfg);
        renderGridBody(this.gridBody, this.flatVisible, cfg, {
            onToggle: (t) => { toggleExpand(t, this.expandedSet); this.refreshVisibleAndRender(); },
            onClick: (t, e) => handleTaskClick(t, e, this.selectionManager, () => this.applySelection()),
        });

        /* Timeline */
        renderTimelineHeader(
            this.timelineHeaderSvg, scale, this.timeMin, this.timeMax,
            this.pxPerDay, cfg, cfg.scrollbar.scrollbarWidth,
        );
        renderTimelineBody(
            this.timelineBodySvg, this.flatVisible,
            scale, this.pxPerDay, this.timeMin, this.timeMax, cfg,
            {
                onBarClick: (t, e) => handleTaskClick(t, e, this.selectionManager, () => this.applySelection()),
                showTooltip: (t, e) => this.showTaskTooltip(t, e),
                hideTooltip: () => this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }),
                moveTooltip: (t, e) => this.host.tooltipService.move({
                    coordinates: [e.clientX, e.clientY], isTouchEvent: false,
                    dataItems: [], identities: t.selectionId ? [t.selectionId] : [],
                }),
            },
        );

        /* Toolbar state */
        this.toolbar.updateState(cfg.toolbar, this.currentZoom);
    }

    private applyLayoutConfig(): void {
        const cfg = this.cfg;

        /* Grid pane visibility */
        this.gridPane.style.display = cfg.grid.showGrid ? "" : "none";
        /* Preserve user-dragged width; fall back to config default.
           Clamp so the grid never exceeds 70% of viewport. */
        const maxGridW = Math.max(200, this.viewportWidth * 0.7);
        const gridW = Math.min(this.userGridWidth ?? cfg.grid.gridWidth, maxGridW);
        this.gridPane.style.width = gridW + "px";
        this.gridPane.style.borderRightColor = cfg.grid.gridBorderColor;
        this.resizeHandle.style.display = cfg.grid.showGrid ? "" : "none";

        /* Scrollbar */
        this.scrollbarStyler.apply(this.container, cfg.scrollbar);
        this.timelineHeaderWrap.style.paddingRight = cfg.scrollbar.scrollbarWidth + "px";
    }

    /* ═══════════════════════════════════════════════
       Zoom / navigation
       ═══════════════════════════════════════════════ */
    private setZoom(z: ZoomLevel): void {
        this.currentZoom = z;
        this.layoutAndRender();
    }

    private computeAndSetPxPerDay(): void {
        this.pxPerDay = computePxPerDay(
            this.currentZoom, this.timeMin, this.timeMax,
            this.timelinePane.clientWidth,
        );
    }

    private doExpandAll(): void {
        expandAll(this.rootTasks, this.expandedSet);
        this.refreshVisibleAndRender();
    }

    private doCollapseAll(): void {
        collapseAll(this.rootTasks, this.expandedSet);
        this.refreshVisibleAndRender();
    }

    private scrollToToday(): void {
        const today = new Date();
        if (today < this.timeMin || today > this.timeMax) return;
        const scale = buildTimeScale(this.timeMin, this.timeMax, this.pxPerDay);
        const tx = scale(today);
        this.timelineBodyWrap.scrollLeft = Math.max(0, tx - this.timelineBodyWrap.clientWidth / 3);
    }

    private refreshVisibleAndRender(): void {
        this.flatVisible = flattenVisible(this.rootTasks, this.searchTerm);
        this.layoutAndRender();
    }

    /* ═══════════════════════════════════════════════
       Tooltip
       ═══════════════════════════════════════════════ */
    private showTaskTooltip(task: GanttTask, e: MouseEvent): void {
        const fmt = this.cfg.grid.dateFormat;
        const items: VisualTooltipDataItem[] = [
            { displayName: "Task", value: task.name },
            { displayName: "Start", value: formatDateCustom(task.start, fmt) },
            { displayName: "End", value: formatDateCustom(task.end, fmt) },
            { displayName: "Duration", value: task.duration + " days" },
            { displayName: "Progress", value: Math.round(task.progress * 100) + "%" },
        ];
        if (task.resource) items.push({ displayName: "Resource", value: task.resource });
        if (task.status) items.push({ displayName: "Status", value: task.status });
        if (task.priority) items.push({ displayName: "Priority", value: task.priority });
        if (task.wbs) items.push({ displayName: "WBS", value: task.wbs });
        if (task.plannedStart && task.plannedEnd) {
            items.push({ displayName: "Planned Start", value: formatDateCustom(task.plannedStart, fmt) });
            items.push({ displayName: "Planned End", value: formatDateCustom(task.plannedEnd, fmt) });
        }
        if (task.isCritical) items.push({ displayName: "Critical Path", value: "Yes" });
        for (const ms of task.milestoneMarkers) {
            items.push({ displayName: ms.label, value: formatDateCustom(ms.date, fmt) });
        }
        if (task.isSyntheticGroup && task.hierarchyPath.length > 0) {
            for (let i = 0; i < task.hierarchyPath.length; i++) {
                const levelName = i < this.hierarchyColumnNames.length ? this.hierarchyColumnNames[i] : "Level " + (i + 1);
                items.push({ displayName: levelName, value: task.hierarchyPath[i] });
            }
        }
        for (const extra of task.tooltipExtra) items.push(extra);

        this.host.tooltipService.show({
            coordinates: [e.clientX, e.clientY], isTouchEvent: false,
            dataItems: items, identities: task.selectionId ? [task.selectionId] : [],
        });
    }

    /* ─── Selection helper ─── */
    private applySelection(): void {
        applySelectionStyles(
            this.selectionManager, this.flatVisible,
            this.timelineBodySvg, this.gridBody,
            this.cfg.colors.selectedBarColor,
        );
    }

    /* ─── Error state ─── */
    private showError(msg: string): void {
        this.errorOverlay.textContent = msg;
        this.errorOverlay.style.display = "flex";
        this.toolbarEl.style.display = "none";
        this.mainArea.style.display = "none";
    }
    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.toolbarEl.style.display = "";
        this.mainArea.style.display = "";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model API
       ═══════════════════════════════════════════════ */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.fmtModel);
    }
}