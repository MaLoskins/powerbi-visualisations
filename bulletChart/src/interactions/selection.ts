/*
 *  Bullet Chart – Power BI Custom Visual
 *  src/interactions/selection.ts
 *
 *  Selection highlight/dim logic for bullet chart rows.
 */
"use strict";

import { BulletItem } from "../types";
import { UNSELECTED_OPACITY } from "../constants";

import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.visuals.ISelectionId;

/** Apply selection styles: dim unselected rows, highlight selected ones. */
export function applySelectionStyles(
    svgContainer: SVGSVGElement,
    items: BulletItem[],
    selectedIds: ISelectionId[],
    selectedBarColor: string,
): void {
    const hasSelection = selectedIds.length > 0;
    const selectedSet = new Set(selectedIds.map((id) => JSON.stringify(id.getKey())));

    const rows = svgContainer.querySelectorAll<SVGGElement>(".bullet-row");
    rows.forEach((row) => {
        const idx = parseInt(row.getAttribute("data-row") ?? "-1", 10);
        if (idx < 0 || idx >= items.length) return;

        const item = items[idx];
        const isSelected = selectedSet.has(JSON.stringify(item.selectionId.getKey()));

        if (hasSelection) {
            row.style.opacity = isSelected ? "1" : String(UNSELECTED_OPACITY);

            /* Highlight selected actual bar */
            if (isSelected) {
                const actualBar = row.querySelector<SVGRectElement>(".bullet-actual");
                if (actualBar) {
                    actualBar.setAttribute("stroke", selectedBarColor);
                    actualBar.setAttribute("stroke-width", "2");
                }
            } else {
                const actualBar = row.querySelector<SVGRectElement>(".bullet-actual");
                if (actualBar) {
                    actualBar.removeAttribute("stroke");
                    actualBar.removeAttribute("stroke-width");
                }
            }
        } else {
            row.style.opacity = "1";
            const actualBar = row.querySelector<SVGRectElement>(".bullet-actual");
            if (actualBar) {
                actualBar.removeAttribute("stroke");
                actualBar.removeAttribute("stroke-width");
            }
        }
    });
}

/** Handle a click on a bullet row. Returns true if a selection was made. */
export function handleClick(
    item: BulletItem,
    e: MouseEvent,
    selectionManager: powerbi.extensibility.ISelectionManager,
): void {
    const isMulti = e.ctrlKey || e.metaKey;
    selectionManager.select(item.selectionId, isMulti);
}
