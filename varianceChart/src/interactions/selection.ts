/* ═══════════════════════════════════════════════
   interactions/selection.ts - Selection styling
   ═══════════════════════════════════════════════ */
"use strict";

import { select } from "d3-selection";
import { VarianceItem } from "../types";
import { UNSELECTED_OPACITY } from "../constants";
import powerbi from "powerbi-visuals-api";

import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

/** Apply selection styles: dim unselected, highlight selected */
export function applySelectionStyles(
    svg: SVGSVGElement,
    selectionManager: ISelectionManager,
    items: VarianceItem[],
    selectedColor: string,
): void {
    const selectedIds = selectionManager.getSelectionIds() as ISelectionId[];
    const hasSelection = selectedIds.length > 0;

    const d3svg = select(svg);

    d3svg.selectAll(".variance-bar-group").each(function () {
        const group = select(this);
        const rowIdx = parseInt(group.attr("data-row") ?? "-1", 10);
        const item = items.find((i) => i.rowIndex === rowIdx);

        if (!hasSelection || !item) {
            group.style("opacity", null);
            group.select(".variance-actual-bar").attr("stroke", null).attr("stroke-width", null);
            return;
        }

        const isSelected = selectedIds.some((sid) =>
            sid.equals(item.selectionId),
        );

        if (isSelected) {
            group.style("opacity", "1");
            group.select(".variance-actual-bar")
                .attr("stroke", selectedColor)
                .attr("stroke-width", 2);
        } else {
            group.style("opacity", String(UNSELECTED_OPACITY));
            group.select(".variance-actual-bar").attr("stroke", null).attr("stroke-width", null);
        }
    });

    /* Dim variance indicators and labels when selection active */
    if (hasSelection) {
        d3svg.selectAll(".variance-delta-bar, .variance-lollipop-line, .variance-lollipop-dot, .variance-arrow-stem, .variance-arrow-head, .variance-connector, .variance-connector-vert, .variance-connector-horiz")
            .style("opacity", String(UNSELECTED_OPACITY * 1.5));
        d3svg.selectAll(".variance-label")
            .style("opacity", String(UNSELECTED_OPACITY * 1.5));
    } else {
        d3svg.selectAll(".variance-delta-bar, .variance-lollipop-line, .variance-lollipop-dot, .variance-arrow-stem, .variance-arrow-head, .variance-connector, .variance-connector-vert, .variance-connector-horiz")
            .style("opacity", null);
        d3svg.selectAll(".variance-label")
            .style("opacity", null);
    }
}

/** Handle click selection (single or multi) */
export function handleClick(
    item: VarianceItem | null,
    event: MouseEvent,
    selectionManager: ISelectionManager,
): void {
    if (!item) {
        selectionManager.clear();
        return;
    }

    const multiSelect = event.ctrlKey || event.metaKey;
    selectionManager.select(item.selectionId, multiSelect);
}
