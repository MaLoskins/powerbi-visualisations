/* ═══════════════════════════════════════════════
   Radar / Polar Chart – Formatting Settings
   ═══════════════════════════════════════════════ */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import {
    RenderConfig, GridShape, ScaleType, ColorPalette, LegendPosition,
    GRID_SHAPES, SCALE_TYPES, COLOR_PALETTES, LEGEND_POSITIONS,
} from "./types";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/* ═══════════════════════════════════════════════
   Slice Factories
   ═══════════════════════════════════════════════ */

function num(
    name: string,
    displayName: string,
    value: number,
): formattingSettings.NumUpDown {
    return new formattingSettings.NumUpDown({
        name,
        displayName,
        value,
    });
}

function color(
    name: string,
    displayName: string,
    hex: string,
): formattingSettings.ColorPicker {
    return new formattingSettings.ColorPicker({
        name,
        displayName,
        value: { value: hex },
    });
}

function toggle(
    name: string,
    displayName: string,
    value: boolean,
): formattingSettings.ToggleSwitch {
    return new formattingSettings.ToggleSwitch({
        name,
        displayName,
        value,
    });
}

function dropdown(
    name: string,
    displayName: string,
    items: readonly string[],
    labels: string[],
    defaultIdx: number,
): formattingSettings.ItemDropdown {
    const list = items.map((val, i) => ({
        value: val,
        displayName: labels[i] ?? val,
    }));
    return new formattingSettings.ItemDropdown({
        name,
        displayName,
        items: list,
        value: list[defaultIdx],
    });
}

/* ═══════════════════════════════════════════════
   Formatting Cards
   ═══════════════════════════════════════════════ */

/* ── Chart Settings ── */

class ChartSettingsCard extends FormattingSettingsCard {
    startAngle   = num("startAngle", "Start Angle (°)", -90);
    fillOpacity  = num("fillOpacity", "Fill Opacity (%)", 25);
    strokeWidth  = num("strokeWidth", "Stroke Width", 2);
    dotRadius    = num("dotRadius", "Dot Radius", 4);
    showDots     = toggle("showDots", "Show Dots", true);
    smoothCurve  = toggle("smoothCurve", "Smooth Curve", false);

    name: string = "chartSettings";
    displayName: string = "Chart";
    slices: FormattingSettingsSlice[] = [
        this.startAngle, this.fillOpacity, this.strokeWidth,
        this.dotRadius, this.showDots, this.smoothCurve,
    ];
}

/* ── Grid Settings ── */

class GridSettingsCard extends FormattingSettingsCard {
    gridLevels        = num("gridLevels", "Grid Levels", 5);
    gridShape         = dropdown("gridShape", "Grid Shape", GRID_SHAPES, ["Polygon", "Circle"], 0);
    gridColor         = color("gridColor", "Grid Color", "#E2E8F0");
    gridWidth         = num("gridWidth", "Grid Line Width", 0.5);
    gridOpacity       = num("gridOpacity", "Grid Opacity (%)", 50);
    spokeColor        = color("spokeColor", "Spoke Color", "#E2E8F0");
    spokeWidth        = num("spokeWidth", "Spoke Width", 0.5);
    showGridLabels    = toggle("showGridLabels", "Show Grid Labels", true);
    gridLabelFontSize = num("gridLabelFontSize", "Grid Label Font Size", 9);
    gridLabelFontColor = color("gridLabelFontColor", "Grid Label Font Color", "#94A3B8");

    name: string = "gridSettings";
    displayName: string = "Grid";
    slices: FormattingSettingsSlice[] = [
        this.gridLevels, this.gridShape, this.gridColor, this.gridWidth,
        this.gridOpacity, this.spokeColor, this.spokeWidth,
        this.showGridLabels, this.gridLabelFontSize, this.gridLabelFontColor,
    ];
}

/* ── Axis Label Settings ── */

class AxisLabelSettingsCard extends FormattingSettingsCard {
    showAxisLabels = toggle("showAxisLabels", "Show Axis Labels", true);
    axisFontSize   = num("axisFontSize", "Axis Font Size", 11);
    axisFontColor  = color("axisFontColor", "Axis Font Color", "#334155");
    labelPadding   = num("labelPadding", "Label Padding", 12);

    name: string = "axisLabelSettings";
    displayName: string = "Axis Labels";
    slices: FormattingSettingsSlice[] = [
        this.showAxisLabels, this.axisFontSize, this.axisFontColor, this.labelPadding,
    ];
}

/* ── Scale Settings ── */

class ScaleSettingsCard extends FormattingSettingsCard {
    scaleMin  = num("scaleMin", "Scale Min (auto = -1)", 0);
    scaleMax  = num("scaleMax", "Scale Max (auto = 0)", 0);
    scaleType = dropdown("scaleType", "Scale Type", SCALE_TYPES, ["Linear", "Percentage"], 0);

    name: string = "scaleSettings";
    displayName: string = "Scale";
    slices: FormattingSettingsSlice[] = [
        this.scaleMin, this.scaleMax, this.scaleType,
    ];
}

/* ── Color Settings ── */

class ColorSettingsCard extends FormattingSettingsCard {
    colorPalette  = dropdown("colorPalette", "Color Palette", COLOR_PALETTES, ["Default", "Pastel", "Vivid"], 0);
    selectedColor = color("selectedColor", "Selection Highlight", "#2563EB");

    name: string = "colorSettings";
    displayName: string = "Colors";
    slices: FormattingSettingsSlice[] = [
        this.colorPalette, this.selectedColor,
    ];
}

/* ── Legend Settings ── */

class LegendSettingsCard extends FormattingSettingsCard {
    showLegend     = toggle("showLegend", "Show Legend", true);
    legendPosition = dropdown("legendPosition", "Position", LEGEND_POSITIONS, ["Top", "Bottom", "Right"], 0);
    legendFontSize = num("legendFontSize", "Font Size", 10);
    legendFontColor = color("legendFontColor", "Font Color", "#475569");

    name: string = "legendSettings";
    displayName: string = "Legend";
    slices: FormattingSettingsSlice[] = [
        this.showLegend, this.legendPosition, this.legendFontSize, this.legendFontColor,
    ];
}

/* ═══════════════════════════════════════════════
   Root Formatting Model
   ═══════════════════════════════════════════════ */

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartSettingsCard     = new ChartSettingsCard();
    gridSettingsCard      = new GridSettingsCard();
    axisLabelSettingsCard = new AxisLabelSettingsCard();
    scaleSettingsCard     = new ScaleSettingsCard();
    colorSettingsCard     = new ColorSettingsCard();
    legendSettingsCard    = new LegendSettingsCard();

    cards = [
        this.chartSettingsCard,
        this.gridSettingsCard,
        this.axisLabelSettingsCard,
        this.scaleSettingsCard,
        this.colorSettingsCard,
        this.legendSettingsCard,
    ];
}

/* ═══════════════════════════════════════════════
   buildRenderConfig – single conversion boundary
   ═══════════════════════════════════════════════ */

function safeEnum<T extends string>(
    val: string | undefined,
    allowed: readonly T[],
    fallback: T,
): T {
    if (val && (allowed as readonly string[]).includes(val)) return val as T;
    return fallback;
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/** Convert formatting model values into a typed RenderConfig */
export function buildRenderConfig(model: VisualFormattingSettingsModel): RenderConfig {
    const c = model.chartSettingsCard;
    const g = model.gridSettingsCard;
    const a = model.axisLabelSettingsCard;
    const s = model.scaleSettingsCard;
    const co = model.colorSettingsCard;
    const l = model.legendSettingsCard;

    return {
        chart: {
            startAngle:  clamp(c.startAngle.value, -180, 180),
            fillOpacity: clamp(c.fillOpacity.value, 0, 100) / 100,   // pct → fraction
            strokeWidth: clamp(c.strokeWidth.value, 1, 6),
            dotRadius:   clamp(c.dotRadius.value, 0, 10),
            showDots:    c.showDots.value,
            smoothCurve: c.smoothCurve.value,
        },
        grid: {
            gridLevels:        clamp(Math.round(g.gridLevels.value), 2, 10),
            gridShape:         safeEnum(String(g.gridShape.value?.value ?? ""), GRID_SHAPES, "polygon"),
            gridColor:         g.gridColor.value.value || "#E2E8F0",
            gridWidth:         clamp(g.gridWidth.value, 0.25, 2),
            gridOpacity:       clamp(g.gridOpacity.value, 0, 100) / 100,  // pct → fraction
            spokeColor:        g.spokeColor.value.value || "#E2E8F0",
            spokeWidth:        clamp(g.spokeWidth.value, 0.25, 2),
            showGridLabels:    g.showGridLabels.value,
            gridLabelFontSize: clamp(g.gridLabelFontSize.value, 7, 14),
            gridLabelFontColor: g.gridLabelFontColor.value.value || "#94A3B8",
        },
        axisLabel: {
            showAxisLabels: a.showAxisLabels.value,
            axisFontSize:   clamp(a.axisFontSize.value, 8, 18),
            axisFontColor:  a.axisFontColor.value.value || "#334155",
            labelPadding:   clamp(a.labelPadding.value, 4, 30),
        },
        scale: {
            scaleMin:  s.scaleMin.value,
            scaleMax:  s.scaleMax.value,
            scaleType: safeEnum(String(s.scaleType.value?.value ?? ""), SCALE_TYPES, "linear"),
        },
        color: {
            colorPalette:  safeEnum(String(co.colorPalette.value?.value ?? ""), COLOR_PALETTES, "default"),
            selectedColor: co.selectedColor.value.value || "#2563EB",
        },
        legend: {
            showLegend:     l.showLegend.value,
            legendPosition: safeEnum(String(l.legendPosition.value?.value ?? ""), LEGEND_POSITIONS, "top"),
            legendFontSize: clamp(l.legendFontSize.value, 7, 16),
            legendFontColor: l.legendFontColor.value.value || "#475569",
        },
    };
}
