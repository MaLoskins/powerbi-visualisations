/*
 *  Marimekko Chart – Power BI Custom Visual
 *  constants.ts — Palette arrays, magic numbers, shared config
 */
"use strict";

/* ── [SHARED THEME START] ────────────────────────
   Auto-generated from shared/theme/palette.ts
   Do NOT edit manually — run sync_theme.sh
   ────────────────────────────────────────────── */

/** Categorical colour cycle — 15 WCAG AA-safe colours (shared) */
export const RESOURCE_COLORS = [
    "#3B82F6", // blue-500
    "#F59E0B", // amber-500
    "#10B981", // emerald-500
    "#8B5CF6", // violet-500
    "#EF4444", // red-500
    "#06B6D4", // cyan-500
    "#F97316", // orange-500
    "#EC4899", // pink-500
    "#6366F1", // indigo-500
    "#14B8A6", // teal-500
    "#84CC16", // lime-500
    "#A855F7", // purple-500
    "#0EA5E9", // sky-500
    "#D946EF", // fuchsia-500
    "#78716C", // stone-500
] as const;

/** Semantic RAG colours for status fields (shared) */
export const STATUS_COLORS: Record<string, string> = {
    "not started": "#94A3B8", // slate-400  — neutral/unstarted
    "in progress": "#3B82F6", // blue-500   — active work
    "complete":    "#10B981", // emerald-500 — success
    "completed":   "#10B981",
    "done":        "#10B981",
    "success":     "#10B981",
    "on hold":     "#F59E0B", // amber-500  — caution/paused
    "warning":     "#F59E0B",
    "delayed":     "#EF4444", // red-500    — danger
    "danger":      "#EF4444",
    "at risk":     "#F97316", // orange-500 — warning
    "cancelled":   "#64748B", // slate-500  — deactivated
    "blocked":     "#DC2626", // red-600    — critical blocker
    "critical":    "#DC2626",
    "info":        "#3B82F6", // blue-500   — informational
    "neutral":     "#64748B", // slate-500  — neutral
};

/** Slate design tokens (shared) */
export const SLATE = {
    50:  "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
} as const;

/** Accent blue tokens (shared) */
export const ACCENT = {
    50:  "#EFF6FF",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
} as const;

/** Semantic colour tokens (shared) */
export const SEMANTIC = {
    emerald500: "#10B981",
    red500:     "#EF4444",
    red600:     "#DC2626",
    amber500:   "#F59E0B",
    orange500:  "#F97316",
    blue500:    "#3B82F6",
    blue600:    "#2563EB",
    blue700:    "#1D4ED8",
} as const;

/** Pastel palette variant (shared) */
export const PASTEL_COLORS = [
    "#93C5FD", "#FCD34D", "#6EE7B7", "#C4B5FD", "#FCA5A5",
    "#67E8F9", "#FDBA74", "#F9A8D4", "#A5B4FC", "#5EEAD4",
    "#BEF264", "#D8B4FE", "#7DD3FC", "#F0ABFC", "#A8A29E",
] as const;

/** Vivid palette variant (shared) */
export const VIVID_COLORS = [
    "#2563EB", "#D97706", "#059669", "#7C3AED", "#DC2626",
    "#0891B2", "#EA580C", "#DB2777", "#4F46E5", "#0D9488",
    "#65A30D", "#9333EA", "#0284C7", "#C026D3", "#57534E",
] as const;

/** Dimmed opacity for unselected elements (shared) */
export const UNSELECTED_OPACITY = 0.25;

/** Power BI system font stack (shared) */
export const FONT_STACK = '"Segoe UI", "wf_segoe-ui_normal", "Helvetica Neue", Helvetica, Arial, sans-serif';

/* ── [SHARED THEME END] ─────────────────────── */

/* ── Backward-compatible aliases ── */

/** @deprecated Use UNSELECTED_OPACITY instead */
export const DIM_OPACITY = UNSELECTED_OPACITY;

/** @deprecated Use FONT_STACK instead */
export const FONT_FAMILY = FONT_STACK;

/* ── Layout Constants ── */

/** Margin around the chart area (px) */
export const CHART_MARGINS = {
    top: 24,
    right: 12,
    bottom: 40,
    left: 48,
} as const;

/** Extra bottom margin when x-axis labels are rotated */
export const ROTATED_LABEL_EXTRA_BOTTOM = {
    "0": 0,
    "45": 24,
    "90": 40,
} as const;

/** Minimum segment pixel height to show any label */
export const MIN_LABEL_HEIGHT_FACTOR = 2;

/** Padding inside segment rect for label text */
export const LABEL_PADDING_PX = 4;

/** Legend item square size (px) */
export const LEGEND_SWATCH_SIZE = 12;

/** Legend item gap (px) */
export const LEGEND_ITEM_GAP = 16;

/** Legend area height when positioned top/bottom (px) */
export const LEGEND_AREA_HEIGHT = 28;

/** Legend area width when positioned right (px) */
export const LEGEND_AREA_WIDTH = 140;

/** Hatched pattern ID for negative values */
export const NEGATIVE_PATTERN_ID = "marimekko-hatch-negative";

/** Width-label offset above columns (px) */
export const WIDTH_LABEL_OFFSET_Y = 6;

/** Y-axis tick count */
export const Y_AXIS_TICKS = 5;

/** Error class name */
export const ERROR_CLASS = "marimekko-error";

/** Fallback colour when a segment category has no palette entry */
export const FALLBACK_SEGMENT_COLOR = "#94A3B8";

/** Full opacity (no selection or selected) */
export const FULL_OPACITY = 1.0;

/** Stroke width for the selected-segment highlight */
export const SELECTED_STROKE_WIDTH = 2;
