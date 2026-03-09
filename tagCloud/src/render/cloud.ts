/* ═══════════════════════════════════════════════
   Tag Cloud – SVG Word Rendering
   ═══════════════════════════════════════════════ */

"use strict";

import { select } from "d3-selection";
import { PlacedWord, RenderConfig, CloudCallbacks } from "../types";

/**
 * Render placed words into the SVG element.
 * Clears existing content and draws fresh.
 * Words are wrapped in a centred group with clipping to prevent overflow.
 */
export function renderCloud(
    svg: SVGSVGElement,
    words: PlacedWord[],
    cfg: RenderConfig,
    callbacks: CloudCallbacks,
): void {
    const d3svg = select(svg);
    const svgWidth = parseFloat(svg.getAttribute("width") || "0");
    const svgHeight = parseFloat(svg.getAttribute("height") || "0");

    /* Clear previous render */
    d3svg.selectAll("*").remove();

    /* Add a clipPath so text does not overflow the viewport */
    const defs = d3svg.append("defs");
    defs.append("clipPath")
        .attr("id", "tcloud-clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", svgWidth)
        .attr("height", svgHeight);

    /* Compute bounding box of placed words and centre the group */
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of words) {
        const halfW = w.width / 2;
        const halfH = w.height / 2;
        if (w.x - halfW < minX) minX = w.x - halfW;
        if (w.y - halfH < minY) minY = w.y - halfH;
        if (w.x + halfW > maxX) maxX = w.x + halfW;
        if (w.y + halfH > maxY) maxY = w.y + halfH;
    }
    const cloudW = maxX - minX;
    const cloudH = maxY - minY;
    const cloudCx = minX + cloudW / 2;
    const cloudCy = minY + cloudH / 2;

    /* Scale cloud to fill viewport with a small responsive margin */
    const margin = Math.min(svgWidth, svgHeight) * 0.02;
    const availW = svgWidth - margin * 2;
    const availH = svgHeight - margin * 2;
    const scale = (cloudW > 0 && cloudH > 0)
        ? Math.min(availW / cloudW, availH / cloudH, 1.5)
        : 1;

    const offsetX = svgWidth / 2 - cloudCx * scale;
    const offsetY = svgHeight / 2 - cloudCy * scale;

    /* Wrapper group: clipped + centred + scaled */
    const g = d3svg.append("g")
        .attr("clip-path", "url(#tcloud-clip)")
        .append("g")
        .attr("transform", `translate(${offsetX},${offsetY}) scale(${scale})`);

    /* Create word elements */
    const groups = g
        .selectAll<SVGTextElement, PlacedWord>("text")
        .data(words)
        .enter()
        .append("text")
        .attr("class", "tcloud-word")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotation})`)
        .attr("font-size", d => `${d.fontSize}px`)
        .attr("font-family", cfg.word.fontFamily)
        .attr("font-weight", cfg.word.fontWeight)
        .attr("fill", d => d.color)
        .attr("data-word", d => d.text)
        .text(d => d.text);

    /* Interaction handlers */
    groups
        .on("click", (e: MouseEvent, d: PlacedWord) => {
            callbacks.onClick(d, e);
        })
        .on("mouseover", (e: MouseEvent, d: PlacedWord) => {
            const rect = svg.getBoundingClientRect();
            callbacks.onMouseOver(d, e.clientX - rect.left, e.clientY - rect.top, e);
        })
        .on("mousemove", (e: MouseEvent, d: PlacedWord) => {
            const rect = svg.getBoundingClientRect();
            callbacks.onMouseMove(d, e.clientX - rect.left, e.clientY - rect.top, e);
        })
        .on("mouseout", () => {
            callbacks.onMouseOut();
        });
}

/**
 * Apply selection dimming styles to word elements.
 * If selectedIds is empty, all words are shown at full opacity.
 */
export function applySelectionStyles(
    svg: SVGSVGElement,
    selectedIds: Set<string>,
    cfg: RenderConfig,
): void {
    const d3svg = select(svg);
    const hasSelection = selectedIds.size > 0;

    d3svg.selectAll<SVGTextElement, PlacedWord>(".tcloud-word")
        .classed("tcloud-word-dimmed", d => hasSelection && !selectedIds.has(JSON.stringify(d.selectionId)))
        .attr("fill", d => {
            if (hasSelection && selectedIds.has(JSON.stringify(d.selectionId))) {
                return cfg.color.selectedColor;
            }
            return d.color;
        });
}
