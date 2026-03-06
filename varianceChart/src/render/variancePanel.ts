/* ═══════════════════════════════════════════════
   render/variancePanel.ts - Optional mini variance bar chart
   ═══════════════════════════════════════════════ */
"use strict";

import { Selection } from "d3-selection";
import { scaleLinear, ScaleBand } from "d3-scale";
import { VarianceItem, RenderConfig } from "../types";
import { varianceColor } from "../utils/color";
import { formatVariance } from "../utils/format";

type SVGSel = Selection<SVGGElement, unknown, null, undefined>;

/** Render the variance panel as a mini horizontal bar chart */
export function renderVariancePanel(
    g: SVGSel,
    items: VarianceItem[],
    bandScale: ScaleBand<string>,
    cfg: RenderConfig,
    panelWidth: number,
    innerHeight: number,
    isVertical: boolean,
): void {
    g.selectAll("*").remove();

    if (!cfg.variancePanel.showVariancePanel || items.length === 0) {
        g.attr("display", "none");
        return;
    }
    g.attr("display", null);

    /* Panel background */
    g.append("rect")
        .attr("class", "variance-panel-bg")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", panelWidth)
        .attr("height", innerHeight)
        .attr("fill", cfg.variancePanel.panelBackground)
        .attr("stroke", cfg.variancePanel.panelBorderColor)
        .attr("stroke-width", 1);

    /* Panel header */
    const panelFontSize = Math.max(8, cfg.labels.labelFontSize);
    g.append("text")
        .attr("class", "variance-panel-header")
        .attr("x", panelWidth / 2)
        .attr("y", -4)
        .attr("text-anchor", "middle")
        .attr("font-size", panelFontSize + "px")
        .attr("fill", cfg.labels.labelFontColor)
        .attr("font-weight", "600")
        .text("Variance");

    /* Compute variance scale */
    const maxAbs = Math.max(
        1,
        ...items.map((d) => Math.abs(d.variance)),
    );
    const vScale = scaleLinear()
        .domain([-maxAbs, maxAbs])
        .range([4, panelWidth - 4])
        .nice();

    const zeroX = vScale(0);

    /* Zero line */
    g.append("line")
        .attr("class", "variance-panel-zero")
        .attr("x1", zeroX).attr("x2", zeroX)
        .attr("y1", 0).attr("y2", innerHeight)
        .attr("stroke", cfg.variancePanel.panelBorderColor)
        .attr("stroke-width", 1);

    /* Variance bars */
    for (const item of items) {
        const bandY = bandScale(item.category) ?? 0;
        const barH = bandScale.bandwidth() * 0.5;
        const cy = bandY + bandScale.bandwidth() / 2;
        const vX = vScale(item.variance);
        const barX = Math.min(zeroX, vX);
        const barW = Math.abs(vX - zeroX);
        const vColor = varianceColor(
            item.variance,
            cfg.colors.favourableColor,
            cfg.colors.unfavourableColor,
        );

        g.append("rect")
            .attr("class", "variance-panel-bar")
            .attr("x", barX)
            .attr("y", cy - barH / 2)
            .attr("width", Math.max(1, barW))
            .attr("height", barH)
            .attr("fill", vColor)
            .attr("rx", 1);

        /* Variance value label */
        const panelLabelFontSize = Math.max(7, cfg.labels.labelFontSize - 1);
        const labelX = item.variance >= 0 ? vX + 3 : vX - 3;
        g.append("text")
            .attr("class", "variance-panel-label")
            .attr("x", labelX)
            .attr("y", cy)
            .attr("dy", "0.35em")
            .attr("text-anchor", item.variance >= 0 ? "start" : "end")
            .attr("font-size", panelLabelFontSize + "px")
            .attr("fill", vColor)
            .text(formatVariance(item.variance));
    }
}
