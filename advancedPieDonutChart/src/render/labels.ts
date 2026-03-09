/*
 *  Advanced Pie / Donut Chart – Power BI Custom Visual
 *  render/labels.ts – Data labels, leader lines, centre label
 */
"use strict";

import { Selection } from "d3-selection";
import { arc as d3Arc, PieArcDatum } from "d3-shape";

import { PieSlice, RenderConfig } from "../types";
import { ChartGeometry, getPieData } from "./chart";
import { LABEL_GAP_FACTOR, MIN_CENTRE_LABEL_RADIUS, scaledLeaderLineExtend, scaledLeaderLineHorizontal } from "../constants";
import { buildLabelText, formatNumber, formatAbbreviated } from "../utils/format";

/* ═══════════════════════════════════════════════
   Data Labels (L6)
   ═══════════════════════════════════════════════ */

interface LabelDatum {
    text: string;
    midAngle: number;
    x: number;
    y: number;
    anchorX: number;
    anchorY: number;
    isRight: boolean;
    slice: PieSlice;
}

/** Render outside or inside data labels with leader lines */
export function renderLabels(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    slices: PieSlice[],
    geom: ChartGeometry,
    cfg: RenderConfig,
    svgWidth?: number,
): void {
    const g = svg.select<SVGGElement>(".apie-labels-group");
    g.selectAll("*").remove();

    if (!cfg.label.showLabels || slices.length === 0) return;

    const pieData = getPieData(slices, cfg);
    const labelPos = cfg.label.labelPosition;
    const fontSize = cfg.label.labelFontSize;
    const minPct = cfg.label.minSlicePercentForLabel;

    /* Filter slices too small for labels */
    const visiblePie = pieData.filter((d) => d.data.percent >= minPct);

    if (labelPos === "inside") {
        renderInsideLabels(g, visiblePie, geom, cfg);
    } else if (labelPos === "outside") {
        renderOutsideLabels(g, visiblePie, geom, cfg, fontSize, svgWidth);
    } else {
        /* "auto": use inside if slice angle is large enough, outside otherwise */
        const largeThreshold = Math.PI / 4; /* ~45° */
        const inside = visiblePie.filter((d) => d.endAngle - d.startAngle >= largeThreshold);
        const outside = visiblePie.filter((d) => d.endAngle - d.startAngle < largeThreshold);
        renderInsideLabels(g, inside, geom, cfg);
        renderOutsideLabels(g, outside, geom, cfg, fontSize, svgWidth);
    }
}

/* ── Inside Labels ── */

function renderInsideLabels(
    g: Selection<SVGGElement, unknown, null, undefined>,
    pieData: PieArcDatum<PieSlice>[],
    geom: ChartGeometry,
    cfg: RenderConfig,
): void {
    const arcGen = d3Arc<PieArcDatum<PieSlice>>()
        .innerRadius(geom.innerRadius)
        .outerRadius(geom.outerRadius);

    for (const pd of pieData) {
        const [cx, cy] = arcGen.centroid(pd);
        const text = buildLabelText(
            pd.data.category,
            pd.data.value,
            pd.data.percent,
            cfg.label.labelContent,
        );
        g.append("text")
            .attr("class", "apie-label-inside")
            .attr("x", cx)
            .attr("y", cy)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", cfg.label.labelFontSize + "px")
            .attr("fill", cfg.label.labelFontColor)
            .attr("pointer-events", "none")
            .text(text);
    }
}

/* ── Outside Labels with Leader Lines and Collision Avoidance ── */

function renderOutsideLabels(
    g: Selection<SVGGElement, unknown, null, undefined>,
    pieData: PieArcDatum<PieSlice>[],
    geom: ChartGeometry,
    cfg: RenderConfig,
    fontSize: number,
    svgWidth?: number,
): void {
    if (pieData.length === 0) return;

    /* Use scaled leader-line dimensions based on chart radius */
    const leaderExtend = scaledLeaderLineExtend(geom.outerRadius);
    const leaderHorizontal = scaledLeaderLineHorizontal(geom.outerRadius);

    const labelRadius = geom.outerRadius + leaderExtend;

    /* Compute max label width to prevent viewport overflow */
    const halfSvg = svgWidth ? svgWidth / 2 : Infinity;
    const maxLabelWidth = halfSvg > 0
        ? Math.max(30, halfSvg - labelRadius - leaderHorizontal - 4)
        : Infinity;

    /* ── Step 1: Compute initial label positions ── */
    const labels: LabelDatum[] = pieData.map((pd) => {
        const midAngle = (pd.startAngle + pd.endAngle) / 2;
        const isRight = midAngle < Math.PI + cfg.chart.startAngle;
        const anchorX = Math.sin(midAngle) * geom.outerRadius;
        const anchorY = -Math.cos(midAngle) * geom.outerRadius;
        const x = Math.sin(midAngle) * labelRadius;
        const y = -Math.cos(midAngle) * labelRadius;

        return {
            text: buildLabelText(
                pd.data.category,
                pd.data.value,
                pd.data.percent,
                cfg.label.labelContent,
            ),
            midAngle,
            x: isRight
                ? labelRadius + leaderHorizontal
                : -(labelRadius + leaderHorizontal),
            y,
            anchorX,
            anchorY,
            isRight,
            slice: pd.data,
        };
    });

    /* ── Step 2: Collision avoidance – sweep sort and adjust ── */
    const minGap = fontSize * LABEL_GAP_FACTOR;
    const maxY = geom.outerRadius + leaderExtend + fontSize;

    /* Split into left and right sides */
    const rightLabels = labels.filter((l) => l.isRight).sort((a, b) => a.y - b.y);
    const leftLabels = labels.filter((l) => !l.isRight).sort((a, b) => a.y - b.y);

    resolveCollisions(rightLabels, minGap, maxY);
    resolveCollisions(leftLabels, minGap, maxY);

    /* ── Step 3: Draw leader lines ── */
    if (cfg.label.showLeaderLines) {
        const allLabels = [...rightLabels, ...leftLabels];
        for (const lbl of allLabels) {
            /* Two-segment polyline: from arc outer midpoint → elbow → label */
            const elbowX = Math.sin(lbl.midAngle) * (geom.outerRadius + leaderExtend);
            const elbowY = -Math.cos(lbl.midAngle) * (geom.outerRadius + leaderExtend);
            const endX = lbl.isRight
                ? labelRadius + leaderHorizontal - 4
                : -(labelRadius + leaderHorizontal - 4);

            g.append("polyline")
                .attr("class", "apie-leader-line")
                .attr("points", [
                    `${lbl.anchorX},${lbl.anchorY}`,
                    `${elbowX},${elbowY}`,
                    `${endX},${lbl.y}`,
                ].join(" "))
                .attr("fill", "none")
                .attr("stroke", cfg.label.leaderLineColor)
                .attr("stroke-width", 1);
        }
    }

    /* ── Step 4: Draw label text (with truncation to prevent overflow) ── */
    const allLabels = [...rightLabels, ...leftLabels];
    for (const lbl of allLabels) {
        const textEl = g.append("text")
            .attr("class", "apie-label-outside")
            .attr("x", lbl.x)
            .attr("y", lbl.y)
            .attr("text-anchor", lbl.isRight ? "start" : "end")
            .attr("dominant-baseline", "central")
            .attr("font-size", cfg.label.labelFontSize + "px")
            .attr("fill", cfg.label.labelFontColor)
            .attr("pointer-events", "none")
            .text(lbl.text);

        /* Truncate labels that would overflow the viewport */
        if (maxLabelWidth < Infinity) {
            truncateSvgText(textEl, lbl.text, maxLabelWidth);
        }
    }
}

/** Truncate an SVG text element to fit within maxWidth, appending ellipsis */
function truncateSvgText(
    textEl: Selection<SVGTextElement, unknown, null, undefined>,
    fullText: string,
    maxWidth: number,
): void {
    const node = textEl.node();
    if (!node) return;

    /* Check if the full text already fits */
    let textWidth = node.getComputedTextLength();
    if (textWidth <= maxWidth) return;

    /* Binary search for the longest substring that fits with ellipsis */
    let lo = 0;
    let hi = fullText.length;
    const ellipsis = "\u2026"; /* … */

    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        node.textContent = fullText.substring(0, mid) + ellipsis;
        textWidth = node.getComputedTextLength();
        if (textWidth <= maxWidth) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }

    node.textContent = lo > 0 ? fullText.substring(0, lo) + ellipsis : ellipsis;
}

/** Sweep-sort collision resolution for a list of labels sorted by y (L7) */
function resolveCollisions(
    labels: LabelDatum[],
    minGap: number,
    maxY: number,
): void {
    if (labels.length <= 1) return;

    /* Forward pass: push down labels that overlap */
    for (let i = 1; i < labels.length; i++) {
        const prev = labels[i - 1];
        const curr = labels[i];
        if (curr.y - prev.y < minGap) {
            curr.y = prev.y + minGap;
        }
    }

    /* Clamp bottom */
    const last = labels[labels.length - 1];
    if (last.y > maxY) {
        last.y = maxY;
        /* Backward pass: push up labels */
        for (let i = labels.length - 2; i >= 0; i--) {
            const next = labels[i + 1];
            const curr = labels[i];
            if (next.y - curr.y < minGap) {
                curr.y = next.y - minGap;
            }
        }
    }

    /* Clamp top */
    if (labels[0].y < -maxY) {
        labels[0].y = -maxY;
        for (let i = 1; i < labels.length; i++) {
            const prev = labels[i - 1];
            const curr = labels[i];
            if (curr.y - prev.y < minGap) {
                curr.y = prev.y + minGap;
            }
        }
    }
}

/* ═══════════════════════════════════════════════
   Centre Label (L8)
   ═══════════════════════════════════════════════ */

/** Render the centre label inside the donut hole */
export function renderCentreLabel(
    svg: Selection<SVGSVGElement, unknown, null, undefined>,
    total: number,
    selectedSlice: PieSlice | null,
    cfg: RenderConfig,
    geom: ChartGeometry,
): void {
    const g = svg.select<SVGGElement>(".apie-centre-group");
    g.selectAll("*").remove();

    if (!cfg.centreLabel.showCentreLabel) return;
    if (cfg.chart.chartType === "pie") return; /* no hole in pie */
    if (geom.innerRadius < MIN_CENTRE_LABEL_RADIUS) return; /* too small */

    /* Determine main text */
    let mainText = "";
    switch (cfg.centreLabel.centreContent) {
        case "total":
            mainText = formatAbbreviated(total);
            break;
        case "customText":
            mainText = cfg.centreLabel.centreCustomText;
            break;
        case "measure":
            mainText = selectedSlice
                ? formatAbbreviated(selectedSlice.value)
                : formatAbbreviated(total);
            break;
    }

    /* Main text */
    g.append("text")
        .attr("class", "apie-centre-main")
        .attr("x", 0)
        .attr("y", cfg.centreLabel.centreSubText ? -6 : 0)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", cfg.centreLabel.centreFontSize + "px")
        .attr("font-weight", "600")
        .attr("fill", cfg.centreLabel.centreFontColor)
        .attr("pointer-events", "none")
        .text(mainText);

    /* Sub text */
    if (cfg.centreLabel.centreSubText) {
        g.append("text")
            .attr("class", "apie-centre-sub")
            .attr("x", 0)
            .attr("y", cfg.centreLabel.centreFontSize * 0.5 + 4)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", cfg.centreLabel.centreSubFontSize + "px")
            .attr("fill", cfg.centreLabel.centreSubFontColor)
            .attr("pointer-events", "none")
            .text(cfg.centreLabel.centreSubText);
    }
}
