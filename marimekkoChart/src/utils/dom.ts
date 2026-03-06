/*
 *  Marimekko Chart – Power BI Custom Visual
 *  utils/dom.ts — DOM element factories and helpers
 */
"use strict";

/** Create an HTML element with optional className and textContent */
export function el(
    tag: string,
    className?: string,
    textContent?: string,
): HTMLElement {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
}

/** Remove all children from a parent element */
export function clearChildren(parent: Element): void {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

/** Clamp a numeric value between min and max */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** Create an SVG element in the SVG namespace */
export function svgEl(tag: string): SVGElement {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

/**
 * Shared canvas context for text measurement — avoids creating a new
 * canvas element on every call, which is expensive during render loops.
 */
let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
    if (!_measureCtx) {
        const canvas = document.createElement("canvas");
        _measureCtx = canvas.getContext("2d");
    }
    return _measureCtx;
}

/**
 * Average character-width ratio (character width / font size) for common fonts.
 *
 * Empirically measured for "Segoe UI" at 9–14 px using mixed-case alphanumeric
 * strings. The true per-character ratio varies from ~0.3 (i, l, 1) to ~0.85
 * (W, M), but 0.52 is a good mean for typical data-label text.
 *
 * LIMITATION: This fallback is only used when the Canvas 2D API is unavailable
 * (e.g. headless test environments). In a real Power BI host the canvas path
 * is always used and provides pixel-accurate measurement. If you observe
 * truncation issues in a canvas-capable environment, the problem is elsewhere
 * (likely available width being too small, not the measurement).
 */
const AVG_CHAR_WIDTH_RATIO = 0.52;

/**
 * Measure text width using a cached canvas context.
 *
 * Fallback: if canvas 2D is unavailable, we approximate using
 * `fontSize * AVG_CHAR_WIDTH_RATIO` per character. See constant above
 * for accuracy notes.
 */
export function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
    const ctx = getMeasureCtx();
    if (!ctx) {
        return text.length * fontSize * AVG_CHAR_WIDTH_RATIO;
    }
    ctx.font = `${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
}

/**
 * Truncate text with ellipsis to fit within maxWidth.
 * Uses binary search (O(log n) measurements) instead of linear scan.
 */
export function truncateText(
    text: string,
    maxWidth: number,
    fontSize: number,
    fontFamily: string,
): string {
    if (maxWidth <= 0) return "";
    if (measureTextWidth(text, fontSize, fontFamily) <= maxWidth) return text;

    // Quick check: if even a single char + ellipsis doesn't fit, return ellipsis
    const ellipsis = "\u2026"; // …
    if (measureTextWidth(text[0] + ellipsis, fontSize, fontFamily) > maxWidth) {
        // If even the ellipsis alone doesn't fit, return empty
        return measureTextWidth(ellipsis, fontSize, fontFamily) <= maxWidth ? ellipsis : "";
    }

    // Binary search for the longest prefix that fits with ellipsis appended
    let lo = 1;
    let hi = text.length - 1;
    let best = 0;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (measureTextWidth(text.slice(0, mid) + ellipsis, fontSize, fontFamily) <= maxWidth) {
            best = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return best > 0 ? text.slice(0, best) + ellipsis : ellipsis;
}
