/* ═══════════════════════════════════════════════
   Tag Cloud – Spiral Placement Algorithm
   L1: Axis-aligned bounding box overlap check
   L2: Archimedean spiral step
   L3: Angle increment
   L4: Max iterations safety cap
   ═══════════════════════════════════════════════ */

"use strict";

import { scaleSqrt, scaleLinear } from "d3-scale";
import { BBox, PlacedWord, RenderConfig, WordItem, SpiralType } from "../types";
import { SPIRAL_STEP, SPIRAL_ANGLE_STEP, MAX_SPIRAL_STEPS } from "../constants";
import { paletteColor, isHexColor, categoryColorMap } from "../utils/color";

/* ── Canvas measurement ── */

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureCanvas(): HTMLCanvasElement {
    if (!measureCanvas) {
        measureCanvas = document.createElement("canvas");
    }
    return measureCanvas;
}

/** Measure text bounding box using a hidden canvas */
function measureText(
    text: string,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
    rotation: number,
): { w: number; h: number } {
    const canvas = getMeasureCanvas();
    const ctx = canvas.getContext("2d")!;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);

    const textW = metrics.width;
    const textH = fontSize * 1.2; /* approximate line height */

    /* Apply rotation to bounding box */
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    return {
        w: textW * cos + textH * sin,
        h: textW * sin + textH * cos,
    };
}

/* ── Overlap detection (L1) ── */

function bboxOverlaps(a: BBox, b: BBox): boolean {
    return !(
        a.x + a.w <= b.x ||
        b.x + b.w <= a.x ||
        a.y + a.h <= b.y ||
        b.y + b.h <= a.y
    );
}

function overlapsAny(candidate: BBox, placed: BBox[]): boolean {
    for (const p of placed) {
        if (bboxOverlaps(candidate, p)) return true;
    }
    return false;
}

/* ── Spiral generators ── */

function archimedeanSpiral(step: number): { dx: number; dy: number } {
    const angle = step * SPIRAL_ANGLE_STEP;
    const radius = SPIRAL_STEP * angle;
    return {
        dx: radius * Math.cos(angle),
        dy: radius * Math.sin(angle),
    };
}

function rectangularSpiral(step: number): { dx: number; dy: number } {
    const side = Math.floor(Math.sqrt(step));
    const sign = (side % 2 === 0) ? 1 : -1;
    const progress = step - side * side;
    const halfSide = (side + 1) * SPIRAL_STEP * 2;

    if (progress <= side + 1) {
        return { dx: sign * halfSide, dy: sign * (progress * SPIRAL_STEP * 2 - halfSide) };
    } else {
        return { dx: sign * (halfSide - (progress - side - 1) * SPIRAL_STEP * 2), dy: sign * halfSide };
    }
}

function spiralPosition(step: number, type: SpiralType): { dx: number; dy: number } {
    return type === "rectangular" ? rectangularSpiral(step) : archimedeanSpiral(step);
}

/* ── Rotation assignment ── */

function getRotation(cfg: RenderConfig["rotation"]): number {
    switch (cfg.rotationMode) {
        case "none":
            return 0;
        case "rightAngle":
            return Math.random() < cfg.rightAngleChance ? 90 : 0;
        case "random":
            return cfg.randomMin + Math.random() * (cfg.randomMax - cfg.randomMin);
        case "custom":
            return Math.random() < 0.5 ? cfg.customAngle : 0;
        default:
            return 0;
    }
}

/* ── Colour assignment ── */

function assignColors(
    words: WordItem[],
    cfg: RenderConfig["color"],
    valueExtent: [number, number],
): Map<WordItem, string> {
    const map = new Map<WordItem, string>();

    if (cfg.colorMode === "single") {
        for (const w of words) map.set(w, cfg.singleColor);
        return map;
    }

    if (cfg.colorMode === "gradient") {
        const gradScale = scaleLinear<string>()
            .domain(valueExtent)
            .range([cfg.gradientStart, cfg.gradientEnd])
            .clamp(true);
        for (const w of words) map.set(w, gradScale(w.value));
        return map;
    }

    if (cfg.colorMode === "field") {
        /* If field values are hex colours, use directly; otherwise map categorically */
        const fieldValues = words
            .map(w => w.colorFieldValue)
            .filter((v): v is string => v != null);
        const allHex = fieldValues.length > 0 && fieldValues.every(isHexColor);

        if (allHex) {
            for (const w of words) {
                map.set(w, w.colorFieldValue && isHexColor(w.colorFieldValue)
                    ? w.colorFieldValue
                    : paletteColor(0));
            }
        } else {
            const catMap = categoryColorMap(fieldValues);
            for (const w of words) {
                map.set(w, w.colorFieldValue ? (catMap.get(w.colorFieldValue) ?? paletteColor(0)) : paletteColor(0));
            }
        }
        return map;
    }

    /* palette mode (default) */
    for (let i = 0; i < words.length; i++) {
        map.set(words[i], paletteColor(i));
    }
    return map;
}

/* ═══════════════════════════════════════════════
   Main Placement Function
   ═══════════════════════════════════════════════ */

export function computePlacement(
    words: WordItem[],
    width: number,
    height: number,
    cfg: RenderConfig,
): PlacedWord[] {
    if (words.length === 0 || width <= 0 || height <= 0) return [];

    /* Sort descending by value so largest words are placed first */
    const sorted = [...words].sort((a, b) => b.value - a.value);

    /* Limit to maxWords */
    const limited = sorted.slice(0, cfg.word.maxWords);

    /* Build font size scale */
    const values = limited.map(w => w.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const fontScale = scaleSqrt()
        .domain([minVal, maxVal || 1])
        .range([cfg.word.minFontSize, cfg.word.maxFontSize])
        .clamp(true);

    /* Assign colours */
    const colorMap = assignColors(limited, cfg.color, [minVal, maxVal]);

    const cx = width / 2;
    const cy = height / 2;
    const placedBoxes: BBox[] = [];
    const result: PlacedWord[] = [];
    const padding = cfg.word.padding;

    /* Use responsive margins based on viewport size instead of fixed pixels */
    const marginX = width * 0.02;
    const marginY = height * 0.02;

    for (const word of limited) {
        const fontSize = fontScale(word.value);
        const rotation = getRotation(cfg.rotation);
        const { w, h } = measureText(
            word.text,
            fontSize,
            cfg.word.fontFamily,
            cfg.word.fontWeight,
            rotation,
        );

        const paddedW = w + padding * 2;
        const paddedH = h + padding * 2;

        let placed = false;

        for (let step = 0; step < MAX_SPIRAL_STEPS; step++) {
            const { dx, dy } = spiralPosition(step, cfg.layout.spiralType);

            /* Apply center bias: scale spiral spread */
            const biasScale = 1 + (1 - cfg.layout.centerBias) * 2;
            const candidateX = cx + dx * biasScale - paddedW / 2;
            const candidateY = cy + dy * biasScale - paddedH / 2;

            /* Bounds check with responsive margins */
            if (candidateX < marginX || candidateY < marginY ||
                candidateX + paddedW > width - marginX ||
                candidateY + paddedH > height - marginY) {
                continue;
            }

            const candidate: BBox = {
                x: candidateX,
                y: candidateY,
                w: paddedW,
                h: paddedH,
            };

            if (!overlapsAny(candidate, placedBoxes)) {
                placedBoxes.push(candidate);
                result.push({
                    ...word,
                    x: candidateX + paddedW / 2,
                    y: candidateY + paddedH / 2,
                    fontSize,
                    rotation,
                    color: colorMap.get(word) ?? "#3B82F6",
                    width: paddedW,
                    height: paddedH,
                });
                placed = true;
                break;
            }
        }

        /* If we couldn't place, skip this word */
        if (!placed) continue;
    }

    return result;
}
