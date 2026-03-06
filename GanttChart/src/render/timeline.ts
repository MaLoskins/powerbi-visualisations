import { select } from "d3-selection";
import type { Selection } from "d3-selection";
import { timeMonth, timeYear, timeWeek, timeDay } from "d3-time";
import type { TimeInterval } from "d3-time";
import { timeFormat } from "d3-time-format";
import type { ScaleTime } from "d3-scale";
import type { GanttTask, RenderConfig, TaskPosition } from "../types";
import { MIN_BAR_WIDTH, MILESTONE_STYLES, STATUS_COLORS } from "../constants";
import { formatDateCustom, isWeekend } from "../utils/date";

/* ═══════════════════════════════════════════════
   Timeline header
   ═══════════════════════════════════════════════ */
export function renderTimelineHeader(
    svg: SVGSVGElement,
    scale: ScaleTime<number, number>,
    timeMin: Date,
    timeMax: Date,
    pxPerDay: number,
    cfg: RenderConfig,
    sbWidth: number,
): void {
    const totalWidth = scale.range()[1];
    const h = cfg.header;
    const svgWidth = totalWidth + sbWidth;
    const d3svg = select(svg).attr("width", svgWidth).attr("height", h.headerHeight);
    d3svg.selectAll("*").remove();

    d3svg.append("rect")
        .attr("width", svgWidth).attr("height", h.headerHeight)
        .attr("fill", h.headerBackground);

    let topFmt: (d: Date) => string;
    let topInterval: TimeInterval;
    if (pxPerDay >= 15) { topInterval = timeMonth; topFmt = timeFormat("%B %Y"); }
    else if (pxPerDay >= 2) { topInterval = timeMonth; topFmt = timeFormat("%b %Y"); }
    else { topInterval = timeYear; topFmt = timeFormat("%Y"); }

    const topTicks = topInterval.range(timeMin, timeMax);
    const topG = d3svg.append("g").attr("class", "gantt-axis-top");
    topG.selectAll("text").data(topTicks).enter()
        .append("text")
        .attr("x", (d: Date) => scale(d) + 4)
        .attr("y", Math.min(16, h.headerHeight * 0.4))
        .style("font-size", h.headerFontSize + "px")
        .style("font-weight", "600")
        .style("fill", h.headerFontColor)
        .text((d: Date) => topFmt(d));

    if (h.showAxisLines) {
        topG.selectAll("line").data(topTicks).enter()
            .append("line")
            .attr("x1", (d: Date) => scale(d)).attr("x2", (d: Date) => scale(d))
            .attr("y1", 0).attr("y2", h.headerHeight)
            .style("stroke", h.axisLineColor).style("stroke-width", 1);
    }

    let botFmt: (d: Date) => string;
    let botInterval: TimeInterval | null;
    if (pxPerDay >= 30) { botInterval = timeDay; botFmt = timeFormat("%d"); }
    else if (pxPerDay >= 8) { botInterval = timeWeek; botFmt = timeFormat("%d %b"); }
    else if (pxPerDay >= 2) { botInterval = timeMonth; botFmt = timeFormat("%b"); }
    else {
        botInterval = timeMonth.every(3) as TimeInterval;
        botFmt = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    }

    if (botInterval) {
        const botTicks = botInterval.range(timeMin, timeMax);
        d3svg.append("g").attr("class", "gantt-axis-bot")
            .selectAll("text").data(botTicks).enter()
            .append("text")
            .attr("x", (d: Date) => scale(d) + 4)
            .attr("y", h.headerHeight - 6)
            .style("font-size", (h.headerFontSize - 1) + "px")
            .style("fill", h.headerFontColor)
            .style("opacity", 0.7)
            .text((d: Date) => botFmt(d));
    }
}

/* ═══════════════════════════════════════════════
   Timeline body (virtualized)
   ═══════════════════════════════════════════════ */
export interface TimelineBodyCallbacks {
    onBarClick: (task: GanttTask, e: MouseEvent) => void;
    showTooltip: (task: GanttTask, e: MouseEvent) => void;
    hideTooltip: () => void;
    moveTooltip: (task: GanttTask, e: MouseEvent) => void;
}

export function renderTimelineBody(
    svg: SVGSVGElement,
    flatVisible: GanttTask[],
    scale: ScaleTime<number, number>,
    pxPerDay: number,
    timeMin: Date,
    timeMax: Date,
    cfg: RenderConfig,
    cbs: TimelineBodyCallbacks,
): Map<string, TaskPosition> {
    const totalWidth = scale.range()[1];
    const rowH = cfg.task.rowHeight;
    const barH = cfg.task.barHeight;
    const radius = cfg.task.barCornerRadius;
    const totalHeight = flatVisible.length * rowH;

    const d3svg = select(svg).attr("width", totalWidth).attr("height", totalHeight);
    d3svg.selectAll("*").remove();
    if (flatVisible.length === 0) return new Map();

    const bgG = d3svg.append("g").attr("class", "gantt-bg");

    /* Row stripes – full dataset for background continuity */
    bgG.selectAll("rect.gantt-row-stripe")
        .data(flatVisible).enter()
        .append("rect").attr("class", "gantt-row-stripe")
        .attr("x", 0).attr("y", (_: GanttTask, i: number) => i * rowH)
        .attr("width", totalWidth).attr("height", rowH)
        .style("fill", (_: GanttTask, i: number) =>
            i % 2 === 0 ? cfg.colors.rowEvenColor : cfg.colors.rowOddColor)
        .style("stroke", cfg.grid.gridLineColor)
        .style("stroke-width", 0.5);

    /* Weekend shading */
    if (cfg.timeline.showWeekends && pxPerDay >= 1.5) {
        const weekendDays = timeDay.range(timeMin, timeMax).filter((d: Date) => isWeekend(d));
        bgG.selectAll("rect.gantt-weekend").data(weekendDays).enter()
            .append("rect").attr("class", "gantt-weekend")
            .attr("x", (d: Date) => scale(d)).attr("y", 0)
            .attr("width", pxPerDay).attr("height", totalHeight)
            .style("fill", cfg.timeline.weekendColor)
            .style("opacity", cfg.timeline.weekendOpacity);
    }

    /* Current week highlight */
    if (cfg.timeline.showCurrentWeekHighlight) {
        const today = new Date();
        const weekStart = timeWeek.floor(today);
        const weekEnd = timeWeek.ceil(today);
        if (weekEnd > timeMin && weekStart < timeMax) {
            const x1 = scale(weekStart < timeMin ? timeMin : weekStart);
            const x2 = scale(weekEnd > timeMax ? timeMax : weekEnd);
            bgG.append("rect").attr("x", x1).attr("y", 0)
                .attr("width", x2 - x1).attr("height", totalHeight)
                .style("fill", cfg.timeline.currentWeekColor)
                .style("opacity", 0.3).style("pointer-events", "none");
        }
    }

    /* Horizontal grid lines */
    bgG.selectAll("line.gantt-hline")
        .data(flatVisible).enter()
        .append("line").attr("class", "gantt-hline")
        .attr("x1", 0).attr("x2", totalWidth)
        .attr("y1", (_: GanttTask, i: number) => (i + 1) * rowH)
        .attr("y2", (_: GanttTask, i: number) => (i + 1) * rowH);

    /* Vertical axis lines */
    if (cfg.header.showAxisLines) {
        const vInterval = pxPerDay >= 2 ? timeMonth : timeYear;
        const vTicks = vInterval.range(timeMin, timeMax);
        bgG.selectAll("line.gantt-vline").data(vTicks).enter()
            .append("line").attr("class", "gantt-vline")
            .attr("x1", (d: Date) => scale(d)).attr("x2", (d: Date) => scale(d))
            .attr("y1", 0).attr("y2", totalHeight)
            .style("stroke", cfg.header.axisLineColor)
            .style("stroke-width", 0.5).style("opacity", 0.4);
    }

    /* Task bars */
    const barsG = d3svg.append("g").attr("class", "gantt-bars");
    const taskPosMap = new Map<string, TaskPosition>();

    for (let i = 0; i < flatVisible.length; i++) {
        const task = flatVisible[i];
        const y = i * rowH + (rowH - barH) / 2;
        const x1 = scale(task.start);
        const x2 = scale(task.end);
        const w = Math.max(MIN_BAR_WIDTH, x2 - x1);

        taskPosMap.set(task.id, { x: x1, y: y + barH / 2, w });

        /* Planned bars */
        if (cfg.task.showPlannedBars && task.plannedStart && task.plannedEnd) {
            const px1 = scale(task.plannedStart);
            const px2 = scale(task.plannedEnd);
            const pw = Math.max(MIN_BAR_WIDTH, px2 - px1);
            barsG.append("rect").attr("class", "gantt-planned-bar")
                .attr("x", px1).attr("y", y + barH * 0.6)
                .attr("width", pw).attr("height", barH * 0.35)
                .attr("rx", radius).attr("ry", radius)
                .style("fill", cfg.colors.plannedBarColor)
                .style("opacity", cfg.task.plannedBarOpacity);
        }

        /* Bar colour resolution */
        let barColor = task.color || cfg.colors.defaultBarColor;
        if (cfg.colors.colorByStatus && task.status) {
            const sc = STATUS_COLORS[task.status.toLowerCase()];
            if (sc) barColor = sc;
        } else if (!cfg.colors.colorByResource) {
            barColor = cfg.colors.defaultBarColor;
        }

        /* Render the appropriate shape */
        if (task.isMilestone && task.milestoneMarkers.length === 0) {
            renderMilestone(barsG, task, scale(task.start), y, barH, i, cfg, cbs);
        } else if (task.isGroup) {
            renderGroupBar(barsG, task, x1, y, w, barH, i, cfg, cbs);
        } else {
            renderTaskBar(barsG, task, x1, y, w, barH, radius, i, barColor, cfg, cbs);
        }

        /* Milestone date markers */
        for (const ms of task.milestoneMarkers) {
            const msX = scale(ms.date);
            const style = MILESTONE_STYLES[ms.styleIndex % MILESTONE_STYLES.length];
            renderMilestoneMarker(barsG, task, msX, i * rowH, rowH, style, ms.label, cfg, cbs);
        }

        /* Bar labels */
        if (cfg.labels.showBarLabels && !task.isMilestone && !task.isGroup) {
            renderBarLabel(barsG, task, x1, y, w, barH, cfg);
        }
    }

    /* Dependencies – need positions for all visible tasks */
    if (cfg.dependencies.showDependencies) {
        renderDependencies(d3svg, flatVisible, taskPosMap, cfg);
    }

    /* Today line */
    if (cfg.timeline.showTodayLine) {
        const today = new Date();
        if (today >= timeMin && today <= timeMax) {
            const tx = scale(today);
            const style = cfg.timeline.todayLineStyle;
            let dash = "6 3";
            if (style === "solid") dash = "none";
            else if (style === "dotted") dash = "2 3";
            d3svg.append("line").attr("class", "gantt-today-line")
                .attr("x1", tx).attr("x2", tx).attr("y1", 0).attr("y2", totalHeight)
                .style("stroke", cfg.timeline.todayLineColor)
                .style("stroke-width", cfg.timeline.todayLineWidth)
                .style("stroke-dasharray", dash);
            d3svg.append("text").attr("x", tx + 3).attr("y", 12)
                .style("font-size", "9px").style("fill", cfg.timeline.todayLineColor)
                .style("font-weight", "600").style("pointer-events", "none").text("Today");
        }
    }

    return taskPosMap;
}

/* ═══════════════════════════════════════════════
   Rendering helpers (private)
   ═══════════════════════════════════════════════ */
function renderTaskBar(
    g: Selection<SVGGElement, unknown, null, undefined>,
    task: GanttTask, x: number, y: number, w: number, h: number,
    radius: number, rowIdx: number, fill: string,
    cfg: RenderConfig, cbs: TimelineBodyCallbacks,
): void {
    const barG = g.append("g").attr("class", "gantt-bar-group")
        .attr("data-task-id", task.id).attr("data-row", rowIdx);

    const rect = barG.append("rect").attr("class", "gantt-bar")
        .attr("x", x).attr("y", y).attr("width", w).attr("height", h)
        .attr("rx", radius).attr("ry", radius)
        .style("fill", fill);

    if (cfg.task.barBorderWidth > 0) {
        rect.style("stroke", cfg.task.barBorderColor).style("stroke-width", cfg.task.barBorderWidth);
    }

    if (cfg.criticalPath.showCriticalPath && cfg.criticalPath.highlightCriticalBars && task.isCritical) {
        rect.style("stroke", cfg.colors.criticalPathColor).style("stroke-width", cfg.criticalPath.criticalPathWidth);
    }

    /* Progress overlay */
    if (cfg.task.showProgress && task.progress > 0) {
        const pOpacity = cfg.task.progressOpacity;
        if (cfg.task.progressStyle === "bottomStripe") {
            const stripeH = Math.max(3, h * 0.2);
            barG.append("rect").attr("class", "gantt-progress")
                .attr("x", x).attr("y", y + h - stripeH)
                .attr("width", w * task.progress).attr("height", stripeH)
                .attr("rx", 1).attr("ry", 1)
                .style("fill", cfg.colors.progressColor);
        } else {
            barG.append("rect").attr("class", "gantt-progress")
                .attr("x", x).attr("y", y)
                .attr("width", w * task.progress).attr("height", h)
                .attr("rx", radius).attr("ry", radius)
                .style("fill", cfg.colors.progressColor)
                .style("opacity", pOpacity);
        }
    }

    /* Progress % label inside bar */
    if (cfg.labels.showProgressLabels && w > 35 && task.progress > 0) {
        barG.append("text").attr("class", "gantt-bar-progress-label")
            .attr("x", x + w / 2).attr("y", y + h / 2 + 1)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .style("font-size", cfg.labels.progressLabelFontSize + "px")
            .style("fill", "#fff").style("font-weight", "600").style("pointer-events", "none")
            .text(Math.round(task.progress * 100) + "%");
    }

    attachBarInteraction(barG, task, cbs);
}

function renderGroupBar(
    g: Selection<SVGGElement, unknown, null, undefined>,
    task: GanttTask, x: number, y: number, w: number, h: number,
    rowIdx: number, cfg: RenderConfig, cbs: TimelineBodyCallbacks,
): void {
    const gc = cfg.colors.groupBarColor;
    const style = cfg.task.groupBarStyle;
    const barG = g.append("g").attr("class", "gantt-bar-group gantt-group-bar")
        .attr("data-task-id", task.id).attr("data-row", rowIdx);

    if (style === "thin") {
        const lineY = y + h / 2;
        barG.append("line").attr("x1", x).attr("x2", x + w).attr("y1", lineY).attr("y2", lineY)
            .style("stroke", gc).style("stroke-width", 3);
        barG.append("line").attr("x1", x).attr("x2", x).attr("y1", lineY - 4).attr("y2", lineY + 4)
            .style("stroke", gc).style("stroke-width", 2);
        barG.append("line").attr("x1", x + w).attr("x2", x + w).attr("y1", lineY - 4).attr("y2", lineY + 4)
            .style("stroke", gc).style("stroke-width", 2);
    } else if (style === "flat") {
        const groupH = Math.max(6, h * 0.5);
        const groupY = y + (h - groupH) / 2;
        barG.append("rect").attr("x", x).attr("y", groupY).attr("width", w).attr("height", groupH)
            .attr("rx", 2).attr("ry", 2)
            .style("fill", gc).style("opacity", 0.7);
    } else {
        const groupH = Math.max(6, h * 0.4);
        const groupY = y + (h - groupH) / 2;
        barG.append("rect").attr("x", x).attr("y", groupY).attr("width", w).attr("height", groupH)
            .style("fill", gc);
        const capW = Math.min(6, w / 4);
        barG.append("polygon")
            .attr("points", `${x},${groupY} ${x + capW},${groupY} ${x},${groupY + groupH}`)
            .style("fill", gc);
        barG.append("polygon")
            .attr("points", `${x + w},${groupY} ${x + w - capW},${groupY} ${x + w},${groupY + groupH}`)
            .style("fill", gc);
    }

    attachBarInteraction(barG, task, cbs);
}

function renderMilestone(
    g: Selection<SVGGElement, unknown, null, undefined>,
    task: GanttTask, cx: number, y: number, h: number,
    rowIdx: number, cfg: RenderConfig, cbs: TimelineBodyCallbacks,
): void {
    const s = cfg.task.milestoneSize / 2;
    const cy = y + h / 2;
    const fill = cfg.colors.milestoneFill;

    const barG = g.append("g").attr("class", "gantt-bar-group gantt-milestone")
        .attr("data-task-id", task.id).attr("data-row", rowIdx);

    barG.append("polygon")
        .attr("points", `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`)
        .style("fill", fill);

    attachBarInteraction(barG, task, cbs);
}

function renderMilestoneMarker(
    g: Selection<SVGGElement, unknown, null, undefined>,
    task: GanttTask, cx: number, rowTop: number, rowH: number,
    style: { color: string; shape: string }, label: string,
    cfg: RenderConfig, cbs: TimelineBodyCallbacks,
): void {
    const s = cfg.task.milestoneSize / 2;
    const cy = rowTop + rowH / 2;
    const fill = style.color;
    const markerG = g.append("g").attr("class", "gantt-milestone-marker");

    if (style.shape === "circle") {
        markerG.append("circle").attr("cx", cx).attr("cy", cy).attr("r", s)
            .style("fill", fill).style("stroke", "#fff").style("stroke-width", 1.5);
    } else if (style.shape === "triangle") {
        markerG.append("polygon")
            .attr("points", `${cx},${cy - s} ${cx + s},${cy + s} ${cx - s},${cy + s}`)
            .style("fill", fill).style("stroke", "#fff").style("stroke-width", 1.5);
    } else if (style.shape === "star") {
        const points: string[] = [];
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            const r = i % 2 === 0 ? s : s * 0.45;
            points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        markerG.append("polygon").attr("points", points.join(" "))
            .style("fill", fill).style("stroke", "#fff").style("stroke-width", 1.5);
    } else {
        markerG.append("polygon")
            .attr("points", `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`)
            .style("fill", fill).style("stroke", "#fff").style("stroke-width", 1.5);
    }

    /* Milestone-specific tooltip */
    const node = markerG.node() as SVGGElement;
    node.addEventListener("mouseenter", (e: MouseEvent) => {
        cbs.showTooltip(task, e);
    });
    node.addEventListener("mouseleave", () => cbs.hideTooltip());
}

function renderBarLabel(
    g: Selection<SVGGElement, unknown, null, undefined>,
    task: GanttTask, x: number, y: number, w: number, h: number,
    cfg: RenderConfig,
): void {
    const ls = cfg.labels;
    const content = ls.barLabelContent;
    const position = ls.barLabelPosition;
    const fontSize = ls.barLabelFontSize;
    const fontColor = ls.barLabelFontColor;

    let text = "";
    switch (content) {
        case "name": text = task.name; break;
        case "progress": text = Math.round(task.progress * 100) + "%"; break;
        case "resource": text = task.resource; break;
        case "dates": text = formatDateCustom(task.start, cfg.grid.dateFormat) + " – " + formatDateCustom(task.end, cfg.grid.dateFormat); break;
        case "nameAndProgress": text = task.name + " (" + Math.round(task.progress * 100) + "%)"; break;
        case "nameAndResource": text = task.name + (task.resource ? " [" + task.resource + "]" : ""); break;
    }
    if (!text) return;

    const actualPosition = position === "auto" ? (w > 80 ? "inside" : "right") : position;
    let tx: number, anchor: string, color: string;
    if (actualPosition === "inside") { tx = x + w / 2; anchor = "middle"; color = "#fff"; }
    else if (actualPosition === "left") { tx = x - 4; anchor = "end"; color = fontColor; }
    else { tx = x + w + 4; anchor = "start"; color = fontColor; }

    g.append("text").attr("class", "gantt-bar-label-ext")
        .attr("x", tx).attr("y", y + h / 2 + 1)
        .attr("text-anchor", anchor).attr("dominant-baseline", "middle")
        .style("font-size", fontSize + "px").style("fill", color).style("pointer-events", "none")
        .text(text);
}

function renderDependencies(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    flatVisible: GanttTask[],
    posMap: Map<string, TaskPosition>,
    cfg: RenderConfig,
): void {
    const d = cfg.dependencies;
    const lineColor = cfg.colors.dependencyLineColor;
    let dashArray = "none";
    if (d.dependencyLineStyle === "dashed") dashArray = "6 3";
    else if (d.dependencyLineStyle === "dotted") dashArray = "2 3";

    const depG = svg.append("g").attr("class", "gantt-deps");
    const defs = svg.append("defs");
    defs.append("marker").attr("id", "gantt-arrow")
        .attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5)
        .attr("markerWidth", d.dependencyArrowSize).attr("markerHeight", d.dependencyArrowSize)
        .attr("orient", "auto-start-reverse")
        .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").style("fill", lineColor);

    for (const task of flatVisible) {
        if (task.dependencyIds.length === 0) continue;
        const target = posMap.get(task.id);
        if (!target) continue;
        for (const depId of task.dependencyIds) {
            const source = posMap.get(depId);
            if (!source) continue;
            const sx = source.x + source.w, sy = source.y;
            const tx = target.x, ty = target.y;
            let pathD: string;
            if (d.dependencyRouting === "straight") { pathD = `M ${sx} ${sy} L ${tx} ${ty}`; }
            else if (d.dependencyRouting === "curved") {
                const midX = (sx + tx) / 2;
                pathD = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
            } else {
                const midX = sx + 12;
                pathD = `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ty} L ${tx} ${ty}`;
            }
            depG.append("path").attr("class", "gantt-dep-line").attr("d", pathD)
                .style("stroke", lineColor).style("stroke-width", d.dependencyLineWidth)
                .style("fill", "none").style("stroke-dasharray", dashArray)
                .attr("marker-end", "url(#gantt-arrow)");
        }
    }
}

function attachBarInteraction(
    barG: Selection<SVGGElement, unknown, null, undefined>,
    task: GanttTask,
    cbs: TimelineBodyCallbacks,
): void {
    const node = barG.node() as SVGGElement;
    node.addEventListener("mouseenter", (e: MouseEvent) => cbs.showTooltip(task, e));
    node.addEventListener("mouseleave", () => cbs.hideTooltip());
    node.addEventListener("mousemove", (e: MouseEvent) => cbs.moveTooltip(task, e));
    node.addEventListener("click", (e: MouseEvent) => cbs.onBarClick(task, e));
}
