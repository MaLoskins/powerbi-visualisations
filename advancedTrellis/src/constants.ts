/* ═══════════════════════════════════════════════
   Advanced Trellis – Constants
   ═══════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════
   Module-Specific Constants
   ═══════════════════════════════════════════════ */

/* ── Layout Constants ── */

/** Margins inside each panel SVG (px) */
export const PANEL_MARGIN = { top: 4, right: 8, bottom: 4, left: 8 } as const;

/** Extra bottom margin when X axis is visible */
export const X_AXIS_HEIGHT = 20;

/** Extra left margin when Y axis is visible */
export const Y_AXIS_WIDTH = 36;

/** Height reserved for panel title bar */
export const TITLE_BAR_HEIGHT = 24;

/** Horizontal padding (px) inside the panel title bar */
export const TITLE_PADDING_H = 8;

/** Minimum bar width for grouped bars (px) */
export const MIN_BAR_WIDTH = 2;

/** Dim opacity for unselected elements (alias for backward compat) */
export const DIM_OPACITY = UNSELECTED_OPACITY;

/** Hover opacity applied to bar elements */
export const BAR_HOVER_OPACITY = 0.8;

/** Multiplier applied to dot radius on hover */
export const DOT_HOVER_SCALE = 1.5;

/** Stroke width for lollipop stems */
export const LOLLIPOP_STEM_WIDTH = 1.5;

/** Number of Y-axis gridline ticks */
export const Y_GRIDLINE_TICK_COUNT = 5;

/** Number of Y-axis label ticks */
export const Y_AXIS_TICK_COUNT = 4;

/** Vertical offset (px) above a data point for its data label */
export const DATA_LABEL_OFFSET_Y = 4;

/** Horizontal offset (px) to the left of Y-axis tick labels */
export const Y_TICK_LABEL_OFFSET = 6;

/** Vertical offset (px) below the X-axis line for tick labels */
export const X_TICK_LABEL_OFFSET = 12;

/** Maximum characters for X-axis category labels before truncation */
export const X_LABEL_MAX_CHARS = 10;

/** Maximum number of panels pre-allocated in the panel pool */
export const MAX_PANELS = 200;
