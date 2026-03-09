import type { ZoomLevel, RenderConfig } from "../types";
import { ZOOM_LEVELS } from "../types";
import { el } from "../utils/dom";

export interface ToolbarCallbacks {
    onZoom: (z: ZoomLevel) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onScrollToToday: () => void;
    onSearch: (term: string) => void;
}

/**
 * Toolbar – DOM is created once (G2).
 * Only visibility/style attributes are updated on subsequent calls.
 */
export class Toolbar {
    private root: HTMLDivElement;
    private zoomGroup: HTMLDivElement;
    private expandGroup: HTMLDivElement;
    private todayGroup: HTMLDivElement;
    private searchGroup: HTMLDivElement;
    private searchInput: HTMLInputElement;
    private zoomButtons: HTMLButtonElement[] = [];
    private toolButtons: HTMLButtonElement[] = [];

    constructor(parent: HTMLDivElement, cbs: ToolbarCallbacks) {
        this.root = parent;

        /* Zoom group */
        this.zoomGroup = el("div", "gantt-toolbar-group gantt-toolbar-zoom");
        const zoomLabels: Record<ZoomLevel, string> = {
            day: "Day", week: "Week", month: "Month",
            quarter: "Qtr", year: "Year", fit: "Fit",
        };
        for (const key of ZOOM_LEVELS) {
            const btn = el("button", "gantt-zoom-btn", zoomLabels[key]);
            btn.dataset.zoom = key;
            btn.addEventListener("click", () => cbs.onZoom(key));
            this.zoomGroup.appendChild(btn);
            this.zoomButtons.push(btn);
        }
        this.root.appendChild(this.zoomGroup);
        this.root.appendChild(createSep());

        /* Expand/Collapse group */
        this.expandGroup = el("div", "gantt-toolbar-group gantt-toolbar-expand");
        const expandBtn = el("button", "gantt-tool-btn", "Expand All");
        expandBtn.title = "Expand all groups";
        expandBtn.addEventListener("click", () => cbs.onExpandAll());
        this.expandGroup.appendChild(expandBtn);
        const collapseBtn = el("button", "gantt-tool-btn", "Collapse");
        collapseBtn.title = "Collapse all groups";
        collapseBtn.addEventListener("click", () => cbs.onCollapseAll());
        this.expandGroup.appendChild(collapseBtn);
        this.toolButtons.push(expandBtn, collapseBtn);
        this.root.appendChild(this.expandGroup);
        this.root.appendChild(createSep());

        /* Today button */
        this.todayGroup = el("div", "gantt-toolbar-group gantt-toolbar-today");
        const todayBtn = el("button", "gantt-tool-btn", "Today");
        todayBtn.title = "Scroll to today";
        todayBtn.addEventListener("click", () => cbs.onScrollToToday());
        this.todayGroup.appendChild(todayBtn);
        this.toolButtons.push(todayBtn);
        this.root.appendChild(this.todayGroup);
        this.root.appendChild(createSep());

        /* Search */
        this.searchGroup = el("div", "gantt-toolbar-group gantt-toolbar-search");
        this.searchInput = el("input", "gantt-search-input");
        this.searchInput.type = "text";
        this.searchInput.placeholder = "Search tasks…";
        this.searchInput.addEventListener("input", () => {
            cbs.onSearch(this.searchInput.value.toLowerCase().trim());
        });
        this.searchGroup.appendChild(this.searchInput);
        this.root.appendChild(this.searchGroup);
    }

    /** Update active zoom highlight + toolbar formatting from config. */
    updateState(cfg: RenderConfig["toolbar"], activeZoom: ZoomLevel): void {
        const tb = cfg;
        this.root.style.display = tb.showToolbar ? "" : "none";
        this.root.style.background = tb.toolbarBackground;

        this.zoomGroup.style.display = tb.showZoomButtons ? "" : "none";
        this.expandGroup.style.display = tb.showExpandCollapseAll ? "" : "none";
        this.todayGroup.style.display = tb.showScrollToToday ? "" : "none";
        this.searchGroup.style.display = tb.showSearchBox ? "" : "none";

        for (const btn of this.zoomButtons) {
            const isActive = btn.dataset.zoom === activeZoom;
            btn.classList.toggle("active", isActive);
            btn.style.background = isActive ? tb.buttonActiveBackground : tb.buttonBackground;
            btn.style.color = isActive ? tb.buttonActiveFontColor : tb.buttonFontColor;
            btn.style.borderColor = tb.buttonBorderColor;
        }

        for (const btn of this.toolButtons) {
            btn.style.background = tb.buttonBackground;
            btn.style.color = tb.buttonFontColor;
            btn.style.borderColor = tb.buttonBorderColor;
        }

        this.searchInput.style.background = tb.buttonBackground;
        this.searchInput.style.color = tb.buttonFontColor;
        this.searchInput.style.borderColor = tb.buttonBorderColor;
    }
}

function createSep(): HTMLDivElement {
    return el("div", "gantt-toolbar-sep");
}
