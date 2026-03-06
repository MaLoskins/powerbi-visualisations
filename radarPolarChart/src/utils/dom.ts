/* ═══════════════════════════════════════════════
   DOM Utilities
   ═══════════════════════════════════════════════ */

"use strict";

/** Create an HTML element with optional class and parent */
export function el(
    tag: string,
    className?: string,
    parent?: HTMLElement,
): HTMLElement {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (parent) parent.appendChild(e);
    return e;
}

/** Remove all child nodes from an element */
export function clearChildren(node: HTMLElement | SVGElement): void {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}
