/* ═══════════════════════════════════════════════
   Tag Cloud – Colour Utilities
   ═══════════════════════════════════════════════ */

"use strict";

import { RESOURCE_COLORS, STATUS_COLORS, PASTEL_COLORS, VIVID_COLORS } from "../constants";

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

/** Get a palette colour by index (cycles). Alias for resourceColor. */
export const paletteColor = resourceColor;

/** Map categorical strings to stable palette colours */
export function categoryColorMap(categories: string[]): Map<string, string> {
    const unique = [...new Set(categories)];
    const map = new Map<string, string>();
    for (let i = 0; i < unique.length; i++) {
        map.set(unique[i], paletteColor(i));
    }
    return map;
}
