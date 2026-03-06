/** Clamp a number to [lo, hi]. */
export function clamp(val: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, val));
}

/** Create an element with className and optional text. */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

/** Remove all child nodes. */
export function clearChildren(parent: HTMLElement): void {
    parent.textContent = "";
}
