/*
 *  Advanced Pie / Donut Chart – Power BI Custom Visual
 *  settings.ts – Formatting model + buildRenderConfig()
 *
 *  NOTE: settings.ts must NOT import constants.ts.
 *  All palette defaults use literal hex strings.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

import {
    RenderConfig,
    CHART_TYPES,
    SORT_MODES,
    COLOR_PALETTES,
    LABEL_CONTENTS,
    LABEL_POSITIONS,
    CENTRE_CONTENTS,
    LEGEND_POSITIONS,
    ChartType,
    SortMode,
    ColorPalette,
    LabelContent,
    LabelPosition,
    CentreContent,
    LegendPosition,
} from "./types";

/* ═══════════════════════════════════════════════
   Slice Factories
   ═══════════════════════════════════════════════ */

function num(
    name: string,
    displayName: string,
    value: number,
    min?: number,
    max?: number,
): formattingSettings.NumUpDown {
    const slice = new formattingSettings.NumUpDown({
        name,
        displayName,
        value,
    });
    if (min !== undefined || max !== undefined) {
        slice.options = {
            minValue: min !== undefined ? { value: min, type: powerbi.visuals.ValidatorType.Min } : undefined,
            maxValue: max !== undefined ? { value: max, type: powerbi.visuals.ValidatorType.Max } : undefined,
        };
    }
    return slice;
}

function pct(
    name: string,
    displayName: string,
    defaultPct: number,
): formattingSettings.NumUpDown {
    const slice = new formattingSettings.NumUpDown({
        name,
        displayName,
        value: defaultPct,
    });
    slice.options = {
        minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
        maxValue: { value: 100, type: powerbi.visuals.ValidatorType.Max },
    };
    return slice;
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
    return new formattingSettings.ItemDropdown({
        name,
        displayName,
        items: items.map((val, i) => ({ value: val, displayName: labels[i] })),
        value: { value: items[defaultIdx], displayName: labels[defaultIdx] },
    });
}

function text(
    name: string,
    displayName: string,
    value: string,
): formattingSettings.TextInput {
    return new formattingSettings.TextInput({
        name,
        displayName,
        value,
        placeholder: "",
    });
}

/* ═══════════════════════════════════════════════
   safeEnum
   ═══════════════════════════════════════════════ */

function safeEnum<T extends string>(
    val: string | undefined,
    allowed: readonly T[],
    fallback: T,
): T {
    if (val && (allowed as readonly string[]).includes(val)) return val as T;
    return fallback;
}

/* ═══════════════════════════════════════════════
   Card 1: Chart Settings
   ═══════════════════════════════════════════════ */

class ChartSettingsCard extends FormattingSettingsCard {
    chartType = dropdown("chartType", "Chart Type", CHART_TYPES, ["Pie", "Donut"], 1);
    innerRadiusPercent = pct("innerRadiusPercent", "Inner Radius %", 55);
    padAngle = num("padAngle", "Pad Angle", 0.02, 0, 0.1);
    cornerRadius = num("cornerRadius", "Corner Radius", 3, 0, 12);
    startAngle = num("startAngle", "Start Angle (°)", 0, 0, 360);
    sortSlices = dropdown("sortSlices", "Sort Slices", SORT_MODES, ["None", "Value ↑", "Value ↓", "Name A→Z", "Name Z→A"], 2);
    showOuterRing = toggle("showOuterRing", "Show Outer Ring", false);
    outerRingThickness = pct("outerRingThickness", "Outer Ring Thickness %", 30);
    arcStrokeColor = color("arcStrokeColor", "Arc Stroke Color", "#ffffff");

    name: string = "chartSettings";
    displayName: string = "Chart Settings";
    slices: FormattingSettingsSlice[] = [
        this.chartType, this.innerRadiusPercent, this.padAngle,
        this.cornerRadius, this.startAngle, this.sortSlices,
        this.showOuterRing, this.outerRingThickness, this.arcStrokeColor,
    ];
}

/* ═══════════════════════════════════════════════
   Card 2: Color Settings
   ═══════════════════════════════════════════════ */

class ColorSettingsCard extends FormattingSettingsCard {
    colorPalette = dropdown("colorPalette", "Color Palette", COLOR_PALETTES, ["Default", "Pastel", "Vivid", "Monochrome"], 0);
    monochromeBase = color("monochromeBase", "Monochrome Base", "#3B82F6");
    selectedSliceColor = color("selectedSliceColor", "Selected Slice Color", "#2563EB");
    selectedSliceScale = num("selectedSliceScale", "Selected Slice Scale", 1.06, 1.0, 1.15);

    name: string = "colorSettings";
    displayName: string = "Color Settings";
    slices: FormattingSettingsSlice[] = [
        this.colorPalette, this.monochromeBase,
        this.selectedSliceColor, this.selectedSliceScale,
    ];
}

/* ═══════════════════════════════════════════════
   Card 3: Label Settings
   ═══════════════════════════════════════════════ */

class LabelSettingsCard extends FormattingSettingsCard {
    showLabels = toggle("showLabels", "Show Labels", true);
    labelContent = dropdown("labelContent", "Label Content", LABEL_CONTENTS, ["Name", "Value", "Percent", "Name & Percent", "Name & Value"], 3);
    labelPosition = dropdown("labelPosition", "Label Position", LABEL_POSITIONS, ["Outside", "Inside", "Auto"], 0);
    labelFontSize = num("labelFontSize", "Font Size", 11, 7, 18);
    labelFontColor = color("labelFontColor", "Font Color", "#334155");
    showLeaderLines = toggle("showLeaderLines", "Show Leader Lines", true);
    leaderLineColor = color("leaderLineColor", "Leader Line Color", "#CBD5E1");
    minSlicePercentForLabel = num("minSlicePercentForLabel", "Min Slice % for Label", 3, 0, 20);

    name: string = "labelSettings";
    displayName: string = "Label Settings";
    slices: FormattingSettingsSlice[] = [
        this.showLabels, this.labelContent, this.labelPosition,
        this.labelFontSize, this.labelFontColor,
        this.showLeaderLines, this.leaderLineColor,
        this.minSlicePercentForLabel,
    ];
}

/* ═══════════════════════════════════════════════
   Card 4: Centre Label Settings
   ═══════════════════════════════════════════════ */

class CentreLabelSettingsCard extends FormattingSettingsCard {
    showCentreLabel = toggle("showCentreLabel", "Show Centre Label", true);
    centreContent = dropdown("centreContent", "Centre Content", CENTRE_CONTENTS, ["Total", "Custom Text", "Measure"], 0);
    centreCustomText = text("centreCustomText", "Custom Text", "");
    centreFontSize = num("centreFontSize", "Font Size", 22, 10, 48);
    centreFontColor = color("centreFontColor", "Font Color", "#1E293B");
    centreSubText = text("centreSubText", "Sub Text", "");
    centreSubFontSize = num("centreSubFontSize", "Sub Font Size", 11, 7, 20);
    centreSubFontColor = color("centreSubFontColor", "Sub Font Color", "#94A3B8");

    name: string = "centreLabelSettings";
    displayName: string = "Centre Label";
    slices: FormattingSettingsSlice[] = [
        this.showCentreLabel, this.centreContent, this.centreCustomText,
        this.centreFontSize, this.centreFontColor,
        this.centreSubText, this.centreSubFontSize, this.centreSubFontColor,
    ];
}

/* ═══════════════════════════════════════════════
   Card 5: Legend Settings
   ═══════════════════════════════════════════════ */

class LegendSettingsCard extends FormattingSettingsCard {
    showLegend = toggle("showLegend", "Show Legend", true);
    legendPosition = dropdown("legendPosition", "Position", LEGEND_POSITIONS, ["Top", "Bottom", "Left", "Right"], 1);
    legendFontSize = num("legendFontSize", "Font Size", 10, 7, 16);
    legendFontColor = color("legendFontColor", "Font Color", "#475569");

    name: string = "legendSettings";
    displayName: string = "Legend";
    slices: FormattingSettingsSlice[] = [
        this.showLegend, this.legendPosition,
        this.legendFontSize, this.legendFontColor,
    ];
}

/* ═══════════════════════════════════════════════
   Card 6: Other Settings
   ═══════════════════════════════════════════════ */

class OtherSettingsCard extends FormattingSettingsCard {
    groupSmallSlices = toggle("groupSmallSlices", "Group Small Slices", false);
    otherThresholdPercent = num("otherThresholdPercent", "Threshold %", 3, 1, 15);
    otherColor = color("otherColor", "Other Color", "#94A3B8");
    otherLabel = text("otherLabel", "Other Label", "Other");

    name: string = "otherSettings";
    displayName: string = "Other / Grouping";
    slices: FormattingSettingsSlice[] = [
        this.groupSmallSlices, this.otherThresholdPercent,
        this.otherColor, this.otherLabel,
    ];
}

/* ═══════════════════════════════════════════════
   Card 7: Animation Settings
   ═══════════════════════════════════════════════ */

class AnimationSettingsCard extends FormattingSettingsCard {
    enableAnimation = toggle("enableAnimation", "Enable Animation", true);
    animationDuration = num("animationDuration", "Duration (ms)", 600, 0, 2000);

    name: string = "animationSettings";
    displayName: string = "Animation";
    slices: FormattingSettingsSlice[] = [
        this.enableAnimation, this.animationDuration,
    ];
}

/* ═══════════════════════════════════════════════
   Root Formatting Model
   ═══════════════════════════════════════════════ */

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartSettingsCard = new ChartSettingsCard();
    colorSettingsCard = new ColorSettingsCard();
    labelSettingsCard = new LabelSettingsCard();
    centreLabelSettingsCard = new CentreLabelSettingsCard();
    legendSettingsCard = new LegendSettingsCard();
    otherSettingsCard = new OtherSettingsCard();
    animationSettingsCard = new AnimationSettingsCard();

    cards = [
        this.chartSettingsCard,
        this.colorSettingsCard,
        this.labelSettingsCard,
        this.centreLabelSettingsCard,
        this.legendSettingsCard,
        this.otherSettingsCard,
        this.animationSettingsCard,
    ];
}

/* ═══════════════════════════════════════════════
   buildRenderConfig() (R1)
   Percent → fraction, enum sanitisation, colour extraction
   ═══════════════════════════════════════════════ */

export function buildRenderConfig(model: VisualFormattingSettingsModel): RenderConfig {
    const c = model.chartSettingsCard;
    const col = model.colorSettingsCard;
    const l = model.labelSettingsCard;
    const cl = model.centreLabelSettingsCard;
    const lg = model.legendSettingsCard;
    const o = model.otherSettingsCard;
    const a = model.animationSettingsCard;

    return {
        chart: {
            chartType: safeEnum(c.chartType.value?.value as string, CHART_TYPES, "donut"),
            innerRadiusFraction: (c.innerRadiusPercent.value ?? 55) / 100,
            padAngle: c.padAngle.value ?? 0.02,
            cornerRadius: c.cornerRadius.value ?? 3,
            startAngle: ((c.startAngle.value ?? 0) * Math.PI) / 180,
            sortSlices: safeEnum(c.sortSlices.value?.value as string, SORT_MODES, "valueDesc"),
            showOuterRing: c.showOuterRing.value ?? false,
            outerRingThicknessFraction: (c.outerRingThickness.value ?? 30) / 100,
            arcStrokeColor: c.arcStrokeColor.value?.value || "#ffffff",
        },
        color: {
            colorPalette: safeEnum(col.colorPalette.value?.value as string, COLOR_PALETTES, "default"),
            monochromeBase: col.monochromeBase.value?.value || "#3B82F6",
            selectedSliceColor: col.selectedSliceColor.value?.value || "#2563EB",
            selectedSliceScale: col.selectedSliceScale.value ?? 1.06,
        },
        label: {
            showLabels: l.showLabels.value ?? true,
            labelContent: safeEnum(l.labelContent.value?.value as string, LABEL_CONTENTS, "nameAndPercent"),
            labelPosition: safeEnum(l.labelPosition.value?.value as string, LABEL_POSITIONS, "outside"),
            labelFontSize: l.labelFontSize.value ?? 11,
            labelFontColor: l.labelFontColor.value?.value || "#334155",
            showLeaderLines: l.showLeaderLines.value ?? true,
            leaderLineColor: l.leaderLineColor.value?.value || "#CBD5E1",
            minSlicePercentForLabel: (l.minSlicePercentForLabel.value ?? 3) / 100,
        },
        centreLabel: {
            showCentreLabel: cl.showCentreLabel.value ?? true,
            centreContent: safeEnum(cl.centreContent.value?.value as string, CENTRE_CONTENTS, "total"),
            centreCustomText: cl.centreCustomText.value ?? "",
            centreFontSize: cl.centreFontSize.value ?? 22,
            centreFontColor: cl.centreFontColor.value?.value || "#1E293B",
            centreSubText: cl.centreSubText.value ?? "",
            centreSubFontSize: cl.centreSubFontSize.value ?? 11,
            centreSubFontColor: cl.centreSubFontColor.value?.value || "#94A3B8",
        },
        legend: {
            showLegend: lg.showLegend.value ?? true,
            legendPosition: safeEnum(lg.legendPosition.value?.value as string, LEGEND_POSITIONS, "bottom"),
            legendFontSize: lg.legendFontSize.value ?? 10,
            legendFontColor: lg.legendFontColor.value?.value || "#475569",
        },
        other: {
            groupSmallSlices: o.groupSmallSlices.value ?? false,
            otherThresholdFraction: (o.otherThresholdPercent.value ?? 3) / 100,
            otherColor: o.otherColor.value?.value || "#94A3B8",
            otherLabel: o.otherLabel.value ?? "Other",
        },
        animation: {
            enableAnimation: a.enableAnimation.value ?? true,
            animationDuration: a.animationDuration.value ?? 600,
        },
    };
}
