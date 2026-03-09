/* ═══════════════════════════════════════════════
   Format Utilities
   ═══════════════════════════════════════════════ */

"use strict";

/** Format a number for display (compact for grid labels) */
export function formatValue(value: number, isPercentage: boolean): string {
    if (isPercentage) {
        return Math.round(value * 100) + "%";
    }
    if (Math.abs(value) >= 1_000_000) {
        return (value / 1_000_000).toFixed(1) + "M";
    }
    if (Math.abs(value) >= 1_000) {
        return (value / 1_000).toFixed(1) + "K";
    }
    if (Number.isInteger(value)) {
        return value.toString();
    }
    return value.toFixed(2);
}

/** Format a value preserving precision for tooltips */
export function formatTooltipValue(value: number): string {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
