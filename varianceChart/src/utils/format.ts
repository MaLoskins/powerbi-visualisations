/* ═══════════════════════════════════════════════
   utils/format.ts - Number and percent formatting
   ═══════════════════════════════════════════════ */
"use strict";

/** Format a number compactly (e.g. 1.2K, 3.4M) */
export function formatCompact(value: number): string {
    if (!isFinite(value)) return "N/A";
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + "B";
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "K";
    if (abs === Math.floor(abs)) return sign + abs.toString();
    return sign + abs.toFixed(1);
}

/** Format a variance value with sign prefix */
export function formatVariance(value: number): string {
    const prefix = value > 0 ? "+" : "";
    return prefix + formatCompact(value);
}

/** Format a percentage value (input as decimal 0-1 range or raw percent) */
export function formatPercent(value: number, isDecimal: boolean = false): string {
    if (!isFinite(value)) return "N/A";
    const pct = isDecimal ? value * 100 : value;
    const prefix = pct > 0 ? "+" : "";
    return prefix + pct.toFixed(1) + "%";
}

/** Format a raw number with commas */
export function formatNumber(value: number): string {
    if (!isFinite(value)) return "N/A";
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
