/* ═══════════════════════════════════════════════
   constants.ts – Shared Palette & Config
   Hierarchical Variance Tree
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

/* ── Backward-compatible aliases for individual token exports ── */

/** @deprecated Use SLATE[50] instead */
export const SLATE_50  = SLATE[50];
/** @deprecated Use SLATE[100] instead */
export const SLATE_100 = SLATE[100];
/** @deprecated Use SLATE[200] instead */
export const SLATE_200 = SLATE[200];
/** @deprecated Use SLATE[300] instead */
export const SLATE_300 = SLATE[300];
/** @deprecated Use SLATE[400] instead */
export const SLATE_400 = SLATE[400];
/** @deprecated Use SLATE[500] instead */
export const SLATE_500 = SLATE[500];
/** @deprecated Use SLATE[600] instead */
export const SLATE_600 = SLATE[600];
/** @deprecated Use SLATE[700] instead */
export const SLATE_700 = SLATE[700];
/** @deprecated Use SLATE[800] instead */
export const SLATE_800 = SLATE[800];
/** @deprecated Use SLATE[900] instead */
export const SLATE_900 = SLATE[900];

/** @deprecated Use ACCENT[50] instead */
export const BLUE_50  = ACCENT[50];
/** @deprecated Use ACCENT[500] instead */
export const BLUE_500 = ACCENT[500];
/** @deprecated Use ACCENT[600] instead */
export const BLUE_600 = ACCENT[600];
/** @deprecated Use ACCENT[700] instead */
export const BLUE_700 = ACCENT[700];

/** @deprecated Use SEMANTIC.red500 instead */
export const RED_500    = SEMANTIC.red500;
/** @deprecated Use SEMANTIC.red600 instead */
export const RED_600    = SEMANTIC.red600;
/** @deprecated Use SEMANTIC.amber500 instead */
export const AMBER_500  = SEMANTIC.amber500;
/** @deprecated Use SEMANTIC.emerald500 instead */
export const EMERALD_500 = SEMANTIC.emerald500;
/** @deprecated Use SEMANTIC.orange500 instead */
export const ORANGE_500 = SEMANTIC.orange500;

/* ── CSS prefix ── */

export const CSS_PREFIX = "hvtree-";

/* ── Layout defaults ── */

export const DEFAULT_NODE_WIDTH = 160;
export const DEFAULT_NODE_HEIGHT = 70;
export const DEFAULT_LEVEL_SPACING = 60;
export const DEFAULT_SIBLING_SPACING = 16;

/* ── Root node label ── */

export const ROOT_LABEL = "Total";

/* ── Hierarchy separator for node IDs ── */

export const HIERARCHY_SEP = "›";
