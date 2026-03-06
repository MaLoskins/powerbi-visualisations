/* ═══════════════════════════════════════════════
   Shared Design System — Colour Utilities
   ═══════════════════════════════════════════════
   Single Source of Truth for colour manipulation
   functions shared across all Power BI visuals.
   Run `sync_theme.sh` to propagate into each
   module's utils/color.ts.
   ═══════════════════════════════════════════════ */

"use strict";

import { RESOURCE_COLORS, STATUS_COLORS, PASTEL_COLORS, VIVID_COLORS } from "../constants";

/* ═══════════════════════════════════════════════
   Hex Validation & Conversion
   ═══════════════════════════════════════════════ */

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

/** Alias for safeHex — validates a hex colour with a fallback. */
export const validHex = safeHex;

/* ═══════════════════════════════════════════════
   Colour Space Conversions
   ═══════════════════════════════════════════════ */

interface HSL {
    h: number; /* 0-360 */
    s: number; /* 0-100 */
    l: number; /* 0-100 */
}

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

/** Convert a hex colour to an rgba() string with the given opacity (0-1). */
export function hexToRgba(hex: string, opacity: number): string {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${opacity})`;
}

/** Convert RGB (0-255) to HSL. */
function rgbToHsl(r: number, g: number, b: number): HSL {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
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

/** Convert HSL to hex. */
function hslToHex(h: number, s: number, l: number): string {
    const sn = s / 100;
    const ln = l / 100;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number): number => {
        const k = (n + h / 30) % 12;
        return ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    const toHex = (x: number): string =>
        Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

/** Convert a hex colour to HSL. */
export function hexToHsl(hex: string): HSL {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b);
}

/* ═══════════════════════════════════════════════
   Colour Manipulation
   ═══════════════════════════════════════════════ */

/** Lighten a hex colour by increasing its HSL lightness. */
export function lightenColor(hex: string, amount: number = 15): string {
    const hsl = hexToHsl(hex);
    const newL = Math.min(95, hsl.l + amount);
    return hslToHex(hsl.h, hsl.s, newL);
}

/** Darken a hex colour by reducing channel values. amount 0-1. */
export function darkenHex(hex: string, amount: number): string {
    const { r, g, b } = hexToRgb(hex);
    const factor = 1 - amount;
    return rgbToHex(r * factor, g * factor, b * factor);
}

/** Interpolate between two hex colours. t=0 returns c1, t=1 returns c2. */
export function interpolateColor(c1: string, c2: string, t: number): string {
    const a = hexToRgb(c1);
    const b = hexToRgb(c2);
    return rgbToHex(
        a.r + (b.r - a.r) * t,
        a.g + (b.g - a.g) * t,
        a.b + (b.b - a.b) * t,
    );
}

/* ═══════════════════════════════════════════════
   Palette Resolution
   ═══════════════════════════════════════════════ */

/** Get a colour from RESOURCE_COLORS by index (wraps around). */
export function resourceColor(index: number): string {
    return RESOURCE_COLORS[index % RESOURCE_COLORS.length];
}

/** Resolve a status string to its semantic colour. */
export function resolveStatusColor(status: string): string | undefined {
    return STATUS_COLORS[status.toLowerCase()];
}

/** Assign or retrieve a colour for a resource/category from a persistent map. */
export function assignResourceColor(
    resource: string,
    map: Map<string, string>,
    counter: { idx: number },
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
    const result: string[] = [];
    for (let i = 0; i < n; i++) {
        result.push(RESOURCE_COLORS[i % RESOURCE_COLORS.length]);
    }
    return result;
}

/** Generate pastel palette: RESOURCE_COLORS hues with S=70%, L=80%. */
export function getPastelPalette(n: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < n; i++) {
        const base = RESOURCE_COLORS[i % RESOURCE_COLORS.length];
        const hsl = hexToHsl(base);
        result.push(hslToHex(hsl.h, 70, 80));
    }
    return result;
}

/** Generate vivid palette: RESOURCE_COLORS hues with S=100%, L=50%. */
export function getVividPalette(n: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < n; i++) {
        const base = RESOURCE_COLORS[i % RESOURCE_COLORS.length];
        const hsl = hexToHsl(base);
        result.push(hslToHex(hsl.h, 100, 50));
    }
    return result;
}

/** Generate monochrome palette: N shades from L=85% down to L=30% of baseHex. */
export function getMonochromePalette(n: number, baseHex: string): string[] {
    const hsl = hexToHsl(baseHex);
    const result: string[] = [];
    for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0;
        const lightness = 85 - t * 55; /* 85% -> 30% */
        result.push(hslToHex(hsl.h, hsl.s, lightness));
    }
    return result;
}

/** Resolve a full colour palette based on type, count, and optional monochrome base. */
export function resolvePalette(
    palette: string,
    count: number,
    monochromeBase: string,
): string[] {
    switch (palette) {
        case "pastel":     return getPastelPalette(count);
        case "vivid":      return getVividPalette(count);
        case "monochrome": return getMonochromePalette(count, monochromeBase);
        default:           return getDefaultPalette(count);
    }
}
