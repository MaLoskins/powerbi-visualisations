import { scaleTime } from "d3-scale";
import type { ScaleTime } from "d3-scale";
import type { GanttTask, ZoomLevel } from "../types";
import { DAY_MS, ZOOM_PX_PER_DAY } from "../constants";
import { daysBetween } from "../utils/date";

export interface TimeRange {
    min: Date;
    max: Date;
}

/** Compute the min/max date range including planned + milestone dates. */
export function computeTimeRange(leafTasks: GanttTask[], paddingDays: number): TimeRange {
    let minT = Infinity;
    let maxT = -Infinity;
    for (const t of leafTasks) {
        if (t.start.getTime() < minT) minT = t.start.getTime();
        if (t.end.getTime() > maxT) maxT = t.end.getTime();
        if (t.plannedStart && t.plannedStart.getTime() < minT) minT = t.plannedStart.getTime();
        if (t.plannedEnd && t.plannedEnd.getTime() > maxT) maxT = t.plannedEnd.getTime();
        for (const ms of t.milestoneMarkers) {
            if (ms.date.getTime() < minT) minT = ms.date.getTime();
            if (ms.date.getTime() > maxT) maxT = ms.date.getTime();
        }
    }
    if (minT === Infinity) return { min: new Date(), max: new Date() };
    return {
        min: new Date(minT - DAY_MS * paddingDays),
        max: new Date(maxT + DAY_MS * paddingDays),
    };
}

/** Get pxPerDay for the current zoom level. */
export function computePxPerDay(
    zoom: ZoomLevel,
    timeMin: Date,
    timeMax: Date,
    availableWidth: number,
): number {
    if (zoom === "fit") {
        const totalDays = Math.max(1, daysBetween(timeMin, timeMax));
        const available = Math.max(20, availableWidth - 2);
        return Math.max(0.1, available / totalDays);
    }
    return ZOOM_PX_PER_DAY[zoom] ?? 5;
}

/** Build a d3 scaleTime for the given range and pxPerDay. */
export function buildTimeScale(
    timeMin: Date,
    timeMax: Date,
    pxPerDay: number,
): ScaleTime<number, number> {
    const totalDays = Math.max(1, daysBetween(timeMin, timeMax));
    const totalWidth = totalDays * pxPerDay;
    return scaleTime<number>().domain([timeMin, timeMax]).range([0, totalWidth]);
}
