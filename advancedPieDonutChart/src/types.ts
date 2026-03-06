/*
 *  Advanced Pie / Donut Chart – Power BI Custom Visual
 *  types.ts – Domain interfaces, literal unions, RenderConfig
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId;

/* ═══════════════════════════════════════════════
   Literal Unions (as const + derived types)
   ═══════════════════════════════════════════════ */

export const CHART_TYPES = ["pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const SORT_MODES = ["none", "valueAsc", "valueDesc", "nameAsc", "nameDesc"] as const;
export type SortMode = (typeof SORT_MODES)[number];

export const COLOR_PALETTES = ["default", "pastel", "vivid", "monochrome"] as const;
export type ColorPalette = (typeof COLOR_PALETTES)[number];

export const LABEL_CONTENTS = ["name", "value", "percent", "nameAndPercent", "nameAndValue"] as const;
export type LabelContent = (typeof LABEL_CONTENTS)[number];

export const LABEL_POSITIONS = ["outside", "inside", "auto"] as const;
export type LabelPosition = (typeof LABEL_POSITIONS)[number];

export const CENTRE_CONTENTS = ["total", "customText", "measure"] as const;
export type CentreContent = (typeof CENTRE_CONTENTS)[number];

export const LEGEND_POSITIONS = ["top", "bottom", "left", "right"] as const;
export type LegendPosition = (typeof LEGEND_POSITIONS)[number];

/* ═══════════════════════════════════════════════
   Domain Model
   ═══════════════════════════════════════════════ */

/** A single slice in the main pie/donut ring (P1) */
export interface PieSlice {
    category: string;
    value: number;
    percent: number;
    color: string;
    selectionId: ISelectionId;
    tooltipExtras: TooltipExtra[];
    /** If this slice is "Other", store the original sub-slices */
    isOther: boolean;
    otherChildren: PieSlice[];
    /** Outer-ring breakdown items attached to this slice (S1) */
    outerSlices: OuterSlice[];
}

/** A segment in the outer (sunburst) ring (S1) */
export interface OuterSlice {
    category: string;
    outerCategory: string;
    value: number;
    percent: number;
    color: string;
    selectionId: ISelectionId;
    tooltipExtras: TooltipExtra[];
}

/** Extra tooltip field from user-defined tooltipFields role */
export interface TooltipExtra {
    displayName: string;
    value: string;
}

/** Result of the data parse pipeline */
export interface ParseResult {
    slices: PieSlice[];
    total: number;
    hasOuterCategory: boolean;
}

/* ═══════════════════════════════════════════════
   Column Index (from model/columns.ts)
   ═══════════════════════════════════════════════ */

export interface ColumnIndex {
    category: number;
    value: number;
    outerCategory: number;
    tooltipFields: number[];
}

/* ═══════════════════════════════════════════════
   RenderConfig (R1)
   ═══════════════════════════════════════════════ */

export interface RenderConfig {
    chart: {
        chartType: ChartType;
        innerRadiusFraction: number;   /* 0-1, converted from 0-100 pct */
        padAngle: number;
        cornerRadius: number;
        startAngle: number;            /* radians, converted from degrees */
        sortSlices: SortMode;
        showOuterRing: boolean;
        outerRingThicknessFraction: number; /* 0-1 */
        arcStrokeColor: string;        /* stroke colour between slices */
    };
    color: {
        colorPalette: ColorPalette;
        monochromeBase: string;
        selectedSliceColor: string;
        selectedSliceScale: number;
    };
    label: {
        showLabels: boolean;
        labelContent: LabelContent;
        labelPosition: LabelPosition;
        labelFontSize: number;
        labelFontColor: string;
        showLeaderLines: boolean;
        leaderLineColor: string;
        minSlicePercentForLabel: number; /* 0-1 fraction */
    };
    centreLabel: {
        showCentreLabel: boolean;
        centreContent: CentreContent;
        centreCustomText: string;
        centreFontSize: number;
        centreFontColor: string;
        centreSubText: string;
        centreSubFontSize: number;
        centreSubFontColor: string;
    };
    legend: {
        showLegend: boolean;
        legendPosition: LegendPosition;
        legendFontSize: number;
        legendFontColor: string;
    };
    other: {
        groupSmallSlices: boolean;
        otherThresholdFraction: number; /* 0-1 */
        otherColor: string;
        otherLabel: string;
    };
    animation: {
        enableAnimation: boolean;
        animationDuration: number;
    };
}

/* ═══════════════════════════════════════════════
   Callback Interfaces
   ═══════════════════════════════════════════════ */

export interface ChartCallbacks {
    onSliceClick: (slice: PieSlice, event: MouseEvent) => void;
    onOuterSliceClick: (slice: OuterSlice, event: MouseEvent) => void;
    onBackgroundClick: () => void;
    onSliceMouseOver: (slice: PieSlice | OuterSlice, event: MouseEvent) => void;
    onSliceMouseMove: (slice: PieSlice | OuterSlice, event: MouseEvent) => void;
    onSliceMouseOut: () => void;
}

export interface LegendCallbacks {
    onLegendClick: (slice: PieSlice, event: MouseEvent) => void;
}
