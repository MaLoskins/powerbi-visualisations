#!/usr/bin/env bash
set -euo pipefail

# sync_theme.sh
# Propagates the shared design system from shared/theme/ into each visual module.
#
# What it does:
#   1. Replaces the «SHARED THEME» marked section in each module's constants.ts
#      with the canonical palette from shared/theme/palette.ts
#   2. Replaces the «SHARED COLOR UTILS» marked section in each module's utils/color.ts
#      with the canonical utilities from shared/theme/color-utils.ts
#
# Modules must have marker comments to delineate shared vs module-specific code.
# If markers are missing, the script warns and skips that file.
#
# Usage:
#   ./sync_theme.sh           # sync all modules
#   ./sync_theme.sh GanttChart # sync a single module

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHARED_DIR="${ROOT_DIR}/shared/theme"

VISUAL_DIRS=(
    "GanttChart"
    "advancedGauge"
    "advancedPieDonutChart"
    "advancedTrellis"
    "bubbleScatterChart"
    "bulletChart"
    "hierarchicalVarianceTree"
    "hierarchyFilterSlicer"
    "linearGauge"
    "marimekkoChart"
    "multiAxesChart"
    "packedBubble"
    "performanceFlow"
    "radarPolarChart"
    "tagCloud"
    "varianceChart"
    "waterfallChart"
)

# If a specific module is passed as argument, only sync that one
if [[ $# -gt 0 ]]; then
    VISUAL_DIRS=("$@")
fi

# ── Generate the constants.ts shared block ──────────────────────────────────

# We read palette.ts and extract the export statements (skipping the file-level
# comments that reference sync_theme.sh, since those are for the source file only).
generate_constants_block() {
    cat <<'BLOCK'
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
BLOCK
}

# ── Generate the color-utils shared block ───────────────────────────────────

generate_color_utils_block() {
    cat <<'BLOCK'
/* ── [SHARED COLOR UTILS START] ──────────────────
   Auto-generated from shared/theme/color-utils.ts
   Do NOT edit manually — run sync_theme.sh
   ────────────────────────────────────────────── */

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** Is the string a valid hex colour (#FFF or #FFFFFF)? */
export function isHexColor(s: string): boolean {
    return HEX_RE.test(s);
}

/** Return hex if valid, otherwise fallback. */
export function safeHex(value: string | undefined | null, fallback: string): string {
    if (value && HEX_RE.test(value)) return value;
    return fallback;
}

/** Alias for safeHex. */
export const validHex = safeHex;

interface HSL { h: number; s: number; l: number; }

/** Parse a hex colour string to {r, g, b} (0-255). */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Convert {r,g,b} (0-255) to a hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert a hex colour to an rgba() string. */
export function hexToRgba(hex: string, opacity: number): string {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${opacity})`;
}

function rgbToHsl(r: number, g: number, b: number): HSL {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l * 100 };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
    const sn = s / 100, ln = l / 100;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number): number => {
        const k = (n + h / 30) % 12;
        return ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    const toHex = (x: number): string => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

/** Convert a hex colour to HSL. */
export function hexToHsl(hex: string): HSL {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b);
}

/** Lighten a hex colour by increasing HSL lightness. */
export function lightenColor(hex: string, amount: number = 15): string {
    const hsl = hexToHsl(hex);
    return hslToHex(hsl.h, hsl.s, Math.min(95, hsl.l + amount));
}

/** Darken a hex colour by reducing channel values. amount 0-1. */
export function darkenHex(hex: string, amount: number): string {
    const { r, g, b } = hexToRgb(hex);
    const f = 1 - amount;
    return rgbToHex(r * f, g * f, b * f);
}

/** Interpolate between two hex colours. t=0 → c1, t=1 → c2. */
export function interpolateColor(c1: string, c2: string, t: number): string {
    const a = hexToRgb(c1), b = hexToRgb(c2);
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

/** Get a colour from RESOURCE_COLORS by index (wraps). */
export function resourceColor(index: number): string {
    return RESOURCE_COLORS[index % RESOURCE_COLORS.length];
}

/** Resolve a status string to its semantic colour. */
export function resolveStatusColor(status: string): string | undefined {
    return STATUS_COLORS[status.toLowerCase()];
}

/** Assign or retrieve a colour for a resource/category from a persistent map. */
export function assignResourceColor(
    resource: string, map: Map<string, string>, counter: { idx: number },
): string {
    let c = map.get(resource);
    if (!c) {
        c = RESOURCE_COLORS[counter.idx % RESOURCE_COLORS.length];
        map.set(resource, c);
        counter.idx++;
    }
    return c;
}

/** Return the palette array for a named palette variant. */
export function getPaletteColors(palette: string): readonly string[] {
    switch (palette) {
        case "pastel": return PASTEL_COLORS;
        case "vivid":  return VIVID_COLORS;
        default:       return RESOURCE_COLORS;
    }
}

/** Get N colours from the default RESOURCE_COLORS cycle. */
export function getDefaultPalette(n: number): string[] {
    return Array.from({ length: n }, (_, i) => RESOURCE_COLORS[i % RESOURCE_COLORS.length]);
}

/** Generate pastel palette: RESOURCE_COLORS hues with S=70%, L=80%. */
export function getPastelPalette(n: number): string[] {
    return Array.from({ length: n }, (_, i) => {
        const hsl = hexToHsl(RESOURCE_COLORS[i % RESOURCE_COLORS.length]);
        return hslToHex(hsl.h, 70, 80);
    });
}

/** Generate vivid palette: RESOURCE_COLORS hues with S=100%, L=50%. */
export function getVividPalette(n: number): string[] {
    return Array.from({ length: n }, (_, i) => {
        const hsl = hexToHsl(RESOURCE_COLORS[i % RESOURCE_COLORS.length]);
        return hslToHex(hsl.h, 100, 50);
    });
}

/** Generate monochrome palette: N shades from L=85% to L=30% of baseHex. */
export function getMonochromePalette(n: number, baseHex: string): string[] {
    const hsl = hexToHsl(baseHex);
    return Array.from({ length: n }, (_, i) => {
        const t = n > 1 ? i / (n - 1) : 0;
        return hslToHex(hsl.h, hsl.s, 85 - t * 55);
    });
}

/** Resolve a full colour palette based on type, count, and optional monochrome base. */
export function resolvePalette(palette: string, count: number, monochromeBase: string): string[] {
    switch (palette) {
        case "pastel":     return getPastelPalette(count);
        case "vivid":      return getVividPalette(count);
        case "monochrome": return getMonochromePalette(count, monochromeBase);
        default:           return getDefaultPalette(count);
    }
}

/* ── [SHARED COLOR UTILS END] ────────────────── */
BLOCK
}

# ── Replacement logic ───────────────────────────────────────────────────────

# Replace content between marker comments in a file.
# $1 = file path, $2 = start marker, $3 = end marker, $4 = new content
replace_between_markers() {
    local file="$1" start_marker="$2" end_marker="$3" new_content="$4"

    if [[ ! -f "$file" ]]; then
        echo "  SKIP (file not found): $file"
        return 1
    fi

    if ! grep -q "$start_marker" "$file"; then
        echo "  WARN (no start marker): $file"
        return 1
    fi

    if ! grep -q "$end_marker" "$file"; then
        echo "  WARN (no end marker): $file"
        return 1
    fi

    # Use awk to replace between markers (inclusive)
    awk -v start="$start_marker" -v end="$end_marker" -v content="$new_content" '
    BEGIN { printing=1; replaced=0 }
    $0 ~ start && !replaced {
        print content;
        printing=0;
        replaced=1;
        next;
    }
    $0 ~ end && !printing {
        printing=1;
        next;
    }
    printing { print }
    ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"

    echo "  OK: $file"
    return 0
}

# ── Main ────────────────────────────────────────────────────────────────────

CONSTANTS_BLOCK="$(generate_constants_block)"
COLOR_UTILS_BLOCK="$(generate_color_utils_block)"

echo "================================================================================"
echo "Shared Theme Sync"
echo "Source: ${SHARED_DIR}"
echo "Modules: ${VISUAL_DIRS[*]}"
echo "================================================================================"

SYNCED=0
SKIPPED=0

for dir in "${VISUAL_DIRS[@]}"; do
    TARGET="${ROOT_DIR}/${dir}"

    if [[ ! -d "$TARGET" ]]; then
        echo "SKIP: ${dir} (directory not found)"
        ((SKIPPED++))
        continue
    fi

    echo
    echo "── ${dir} ──"

    # Sync constants.ts
    CONSTANTS_FILE="${TARGET}/src/constants.ts"
    if replace_between_markers "$CONSTANTS_FILE" \
        "\\[SHARED THEME START\\]" \
        "\\[SHARED THEME END\\]" \
        "$CONSTANTS_BLOCK"; then
        ((SYNCED++))
    else
        ((SKIPPED++))
    fi

    # Sync utils/color.ts
    COLOR_FILE="${TARGET}/src/utils/color.ts"
    if replace_between_markers "$COLOR_FILE" \
        "\\[SHARED COLOR UTILS START\\]" \
        "\\[SHARED COLOR UTILS END\\]" \
        "$COLOR_UTILS_BLOCK"; then
        ((SYNCED++))
    else
        ((SKIPPED++))
    fi
done

echo
echo "================================================================================"
echo "Sync complete. Synced: ${SYNCED}, Skipped: ${SKIPPED}"
echo "================================================================================"
