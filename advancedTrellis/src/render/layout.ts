/* ═══════════════════════════════════════════════
   Advanced Trellis – Grid Layout Calculation
   ═══════════════════════════════════════════════ */

"use strict";

import type { GridLayout, RenderConfig } from "../types";
import { clamp } from "../utils/dom";

/**
 * Compute the trellis grid layout: number of columns/rows, panel dimensions.
 * Handles all grid configurations: 1×N, N×1, and N×M.
 */
export function computeGridLayout(
    viewportWidth: number,
    viewportHeight: number,
    panelCount: number,
    cfg: RenderConfig["layout"],
): GridLayout {
    if (panelCount === 0) {
        return { columns: 1, rows: 0, panelWidth: 0, panelHeight: 0, totalHeight: 0 };
    }

    /* Auto-column calculation when columns = 0 */
    let cols: number;
    if (cfg.columns > 0) {
        cols = Math.min(cfg.columns, panelCount);
    } else {
        cols = Math.floor(viewportWidth / Math.max(1, cfg.panelMinWidth));
        cols = clamp(cols, 1, panelCount);
    }

    const rows = Math.ceil(panelCount / cols);

    /* Panel width: fill available space minus padding.
       The grid uses CSS flex with `gap` (cols-1 inner gaps) plus `padding`
       (one on each edge), giving (cols - 1) + 2 = (cols + 1) padding units. */
    const totalHPadding = cfg.panelPadding * (cols + 1);
    const panelWidth = Math.max(
        cfg.panelMinWidth,
        Math.floor((viewportWidth - totalHPadding) / cols),
    );

    /* Panel height: try to fill viewport, but respect minimum.
       Same logic: (rows - 1) inner gaps + 2 outer edges = (rows + 1) units. */
    const totalVPadding = cfg.panelPadding * (rows + 1);
    const idealHeight = Math.floor((viewportHeight - totalVPadding) / rows);
    const panelHeight = Math.max(cfg.panelMinHeight, idealHeight);

    /* Total scrollable height */
    const totalHeight = rows * panelHeight + (rows + 1) * cfg.panelPadding;

    return {
        columns: cols,
        rows,
        panelWidth,
        panelHeight,
        totalHeight,
    };
}
