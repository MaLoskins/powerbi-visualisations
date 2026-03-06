import type { GanttTask, RenderConfig } from "../types";
import { formatDateCustom } from "../utils/date";
import { el, clearChildren } from "../utils/dom";
import { resolveStatusColor } from "../utils/color";

/**
 * Render the grid pane (header + body rows).
 */
export function renderGridHeader(
    gridHeader: HTMLDivElement,
    cfg: RenderConfig,
): void {
    clearChildren(gridHeader);
    const g = cfg.grid;
    const h = cfg.header;

    gridHeader.style.height = h.headerHeight + "px";
    gridHeader.style.fontSize = g.textSize + "pt";
    gridHeader.style.background = g.gridHeaderBackground;
    gridHeader.style.color = g.gridHeaderFontColor;

    const hRow = el("div", "gantt-grid-header-row");
    addHeaderCell(hRow, "Task", "gantt-grid-cell-name");
    if (g.showWbsColumn) addHeaderCell(hRow, "WBS", "gantt-grid-cell-extra");
    if (g.showDateColumns) {
        addHeaderCell(hRow, "Start", "gantt-grid-cell-date");
        addHeaderCell(hRow, "End", "gantt-grid-cell-date");
    }
    if (g.showDurationColumn) addHeaderCell(hRow, "Dur.", "gantt-grid-cell-num");
    if (g.showProgressColumn) addHeaderCell(hRow, "%", "gantt-grid-cell-num");
    if (g.showResourceColumn) addHeaderCell(hRow, "Resource", "gantt-grid-cell-extra");
    if (g.showStatusColumn) addHeaderCell(hRow, "Status", "gantt-grid-cell-extra");
    if (g.showPriorityColumn) addHeaderCell(hRow, "Priority", "gantt-grid-cell-extra");
    gridHeader.appendChild(hRow);
}

export interface GridBodyCallbacks {
    onToggle: (task: GanttTask) => void;
    onClick: (task: GanttTask, e: MouseEvent) => void;
}

/**
 * Render all grid body rows using normal document flow.
 */
export function renderGridBody(
    gridBody: HTMLDivElement,
    flatVisible: GanttTask[],
    cfg: RenderConfig,
    cbs: GridBodyCallbacks,
): void {
    clearChildren(gridBody);
    const g = cfg.grid;
    const rowH = cfg.task.rowHeight;

    gridBody.style.fontSize = g.textSize + "pt";
    gridBody.style.color = g.gridFontColor;

    for (let idx = 0; idx < flatVisible.length; idx++) {
        const task = flatVisible[idx];
        const row = el("div", "gantt-grid-row");
        if (task.isSyntheticGroup || task.isGroup) row.className += " gantt-grid-row-group";
        row.style.height = rowH + "px";
        row.style.lineHeight = rowH + "px";
        row.style.borderBottomColor = g.gridLineColor;
        row.style.backgroundColor = idx % 2 === 0 ? cfg.colors.rowEvenColor : cfg.colors.rowOddColor;

        /* Name cell */
        const nameCell = el("span", "gantt-grid-cell gantt-grid-cell-name");
        nameCell.style.paddingLeft = (4 + task.depth * g.indentSize) + "px";

        if (task.isGroup) {
            const toggle = el("span", "gantt-toggle", task.isExpanded ? "\u25BE" : "\u25B8");
            toggle.addEventListener("click", (e) => { e.stopPropagation(); cbs.onToggle(task); });
            nameCell.appendChild(toggle);
        } else {
            nameCell.appendChild(el("span", "gantt-toggle-spacer"));
        }

        const nameSpan = el("span", "gantt-task-label", task.name);
        nameSpan.title = task.name;
        if (task.isCritical) nameSpan.classList.add("gantt-critical-label");
        nameCell.appendChild(nameSpan);
        row.appendChild(nameCell);

        if (g.showWbsColumn) addBodyCell(row, task.wbs, "gantt-grid-cell-extra");
        if (g.showDateColumns) {
            addBodyCell(row, formatDateCustom(task.start, g.dateFormat), "gantt-grid-cell-date");
            addBodyCell(row, formatDateCustom(task.end, g.dateFormat), "gantt-grid-cell-date");
        }
        if (g.showDurationColumn) addBodyCell(row, task.duration + "d", "gantt-grid-cell-num");
        if (g.showProgressColumn) addBodyCell(row, Math.round(task.progress * 100) + "%", "gantt-grid-cell-num");
        if (g.showResourceColumn) addBodyCell(row, task.resource, "gantt-grid-cell-extra");
        if (g.showStatusColumn) {
            const statusCell = addBodyCell(row, task.status, "gantt-grid-cell-extra");
            if (task.status) {
                const sc = resolveStatusColor(task.status);
                if (sc) { statusCell.style.color = sc; statusCell.style.fontWeight = "600"; }
            }
        }
        if (g.showPriorityColumn) addBodyCell(row, task.priority, "gantt-grid-cell-extra");

        row.addEventListener("click", (e) => cbs.onClick(task, e));
        row.dataset.taskId = task.id;
        gridBody.appendChild(row);
    }
}

function addHeaderCell(parent: HTMLElement, text: string, cls: string): void {
    const cell = el("span", "gantt-grid-cell " + cls, text);
    parent.appendChild(cell);
}

function addBodyCell(parent: HTMLElement, text: string, cls: string): HTMLSpanElement {
    const cell = el("span", "gantt-grid-cell " + cls, text);
    cell.title = text;
    parent.appendChild(cell);
    return cell;
}
