/* ═══════════════════════════════════════════════
   utils/dom.ts – DOM Helper Functions
   ═══════════════════════════════════════════════ */

"use strict";

import { CSS_PREFIX } from "../constants";

/** Create an HTML element with optional class name(s) and text content. */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    textContent?: string,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;
    return element;
}

/** Remove all children from a DOM element. */
export function clearChildren(element: HTMLElement | SVGElement): void {
    element.replaceChildren();
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Build a prefixed CSS class name. */
export function prefixCls(name: string): string {
    return CSS_PREFIX + name;
}
