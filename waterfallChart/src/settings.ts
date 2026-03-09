/* ═══════════════════════════════════════════════
   WaterfallChart - Formatting Settings
   Slice factories, card classes, buildRenderConfig()
   W9: settings.ts must NOT import constants.ts;
       palette defaults use literal hex strings.
   ═══════════════════════════════════════════════ */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import {
    RenderConfig,
    ORIENTATIONS,
    CONNECTOR_LINE_STYLES,
    LABEL_POSITIONS,
    VALUE_FORMATS,
    LEGEND_POSITIONS,
    X_LABEL_ROTATIONS,
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
    _minVal?: number,
    _maxVal?: number,
): formattingSettings.NumUpDown {
    const opts: { name: string; displayName: string; value: number } = {
        name,
        displayName,
        value,
    };
    return new formattingSettings.NumUpDown(opts);
}

function pct(
    name: string,
    displayName: string,
    defaultPct: number,
): formattingSettings.NumUpDown {
    return new formattingSettings.NumUpDown({
        name,
        displayName,
        value: defaultPct,
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
    labels: readonly string[],
    defaultIdx: number,
): formattingSettings.ItemDropdown {
    return new formattingSettings.ItemDropdown({
        name,
        displayName,
        items: items.map((val, i) => ({ displayName: labels[i], value: val })),
        value: { displayName: labels[defaultIdx], value: items[defaultIdx] },
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
   Card 1: Chart Settings
   ═══════════════════════════════════════════════ */

class ChartSettingsCard extends FormattingSettingsCard {
    orientation = dropdown("orientation", "Orientation", ["vertical", "horizontal"], ["Vertical", "Horizontal"], 0);
    barWidth = pct("barWidth", "Bar Width (%)", 60);
    barCornerRadius = num("barCornerRadius", "Corner Radius", 2);
    showConnectorLines = toggle("showConnectorLines", "Show Connector Lines", true);
    connectorLineColor = color("connectorLineColor", "Connector Color", "#CBD5E1");
    connectorLineWidth = num("connectorLineWidth", "Connector Width", 1);
    connectorLineStyle = dropdown("connectorLineStyle", "Connector Style", ["solid", "dashed"], ["Solid", "Dashed"], 0);

    name: string = "chartSettings";
    displayName: string = "Chart Settings";
    slices: FormattingSettingsSlice[] = [
        this.orientation, this.barWidth, this.barCornerRadius,
        this.showConnectorLines, this.connectorLineColor,
        this.connectorLineWidth, this.connectorLineStyle,
    ];
}

/* ═══════════════════════════════════════════════
   Card 2: Color Settings
   ═══════════════════════════════════════════════ */

class ColorSettingsCard extends FormattingSettingsCard {
    increaseColor = color("increaseColor", "Increase", "#10B981");
    decreaseColor = color("decreaseColor", "Decrease", "#EF4444");
    totalColor = color("totalColor", "Total", "#3B82F6");
    startColor = color("startColor", "Start", "#64748B");
    selectedColor = color("selectedColor", "Selected Highlight", "#2563EB");

    name: string = "colorSettings";
    displayName: string = "Colors";
    slices: FormattingSettingsSlice[] = [
        this.increaseColor, this.decreaseColor, this.totalColor,
        this.startColor, this.selectedColor,
    ];
}

/* ═══════════════════════════════════════════════
   Card 3: Axis Settings
   ═══════════════════════════════════════════════ */

class AxisSettingsCard extends FormattingSettingsCard {
    showXAxis = toggle("showXAxis", "Show X Axis", true);
    showYAxis = toggle("showYAxis", "Show Y Axis", true);
    axisFontSize = num("axisFontSize", "Font Size", 10);
    axisFontColor = color("axisFontColor", "Font Color", "#64748B");
    showGridlines = toggle("showGridlines", "Show Gridlines", true);
    gridlineColor = color("gridlineColor", "Gridline Color", "#F1F5F9");
    xLabelRotation = dropdown("xLabelRotation", "X Label Rotation", ["0", "45", "90"], ["0°", "45°", "90°"], 1);
    showBaselineLine = toggle("showBaselineLine", "Show Baseline", true);
    baselineColor = color("baselineColor", "Baseline Color", "#CBD5E1");

    name: string = "axisSettings";
    displayName: string = "Axes";
    slices: FormattingSettingsSlice[] = [
        this.showXAxis, this.showYAxis, this.axisFontSize, this.axisFontColor,
        this.showGridlines, this.gridlineColor, this.xLabelRotation,
        this.showBaselineLine, this.baselineColor,
    ];
}

/* ═══════════════════════════════════════════════
   Card 4: Label Settings
   ═══════════════════════════════════════════════ */

class LabelSettingsCard extends FormattingSettingsCard {
    showValueLabels = toggle("showValueLabels", "Show Value Labels", true);
    labelPosition = dropdown("labelPosition", "Label Position", ["above", "inside", "auto"], ["Above", "Inside", "Auto"], 0);
    labelFontSize = num("labelFontSize", "Font Size", 10);
    labelFontColor = color("labelFontColor", "Font Color", "#334155");
    showRunningTotal = toggle("showRunningTotal", "Show Running Total", false);
    showPlusMinus = toggle("showPlusMinus", "Show +/- Prefix", true);
    valueFormat = dropdown("valueFormat", "Value Format", ["auto", "number", "currency", "compact"], ["Auto", "Number", "Currency", "Compact"], 0);

    name: string = "labelSettings";
    displayName: string = "Labels";
    slices: FormattingSettingsSlice[] = [
        this.showValueLabels, this.labelPosition, this.labelFontSize,
        this.labelFontColor, this.showRunningTotal, this.showPlusMinus,
        this.valueFormat,
    ];
}

/* ═══════════════════════════════════════════════
   Card 5: Legend Settings
   ═══════════════════════════════════════════════ */

class LegendSettingsCard extends FormattingSettingsCard {
    showLegend = toggle("showLegend", "Show Legend", true);
    legendPosition = dropdown("legendPosition", "Position", ["top", "bottom"], ["Top", "Bottom"], 0);
    legendFontSize = num("legendFontSize", "Font Size", 10);
    legendFontColor = color("legendFontColor", "Font Color", "#475569");

    name: string = "legendSettings";
    displayName: string = "Legend";
    slices: FormattingSettingsSlice[] = [
        this.showLegend, this.legendPosition, this.legendFontSize, this.legendFontColor,
    ];
}

/* ═══════════════════════════════════════════════
   Card 6: Summary Settings
   ═══════════════════════════════════════════════ */

class SummarySettingsCard extends FormattingSettingsCard {
    autoStartTotal = toggle("autoStartTotal", "First Bar is Start Total", true);
    autoEndTotal = toggle("autoEndTotal", "Append End Total", true);
    endTotalLabel = text("endTotalLabel", "End Total Label", "Total");

    name: string = "summarySettings";
    displayName: string = "Summary";
    slices: FormattingSettingsSlice[] = [
        this.autoStartTotal, this.autoEndTotal, this.endTotalLabel,
    ];
}

/* ═══════════════════════════════════════════════
   Root Formatting Model
   ═══════════════════════════════════════════════ */

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    chartSettingsCard = new ChartSettingsCard();
    colorSettingsCard = new ColorSettingsCard();
    axisSettingsCard = new AxisSettingsCard();
    labelSettingsCard = new LabelSettingsCard();
    legendSettingsCard = new LegendSettingsCard();
    summarySettingsCard = new SummarySettingsCard();

    cards = [
        this.chartSettingsCard,
        this.colorSettingsCard,
        this.axisSettingsCard,
        this.labelSettingsCard,
        this.legendSettingsCard,
        this.summarySettingsCard,
    ];
}

/* ═══════════════════════════════════════════════
   buildRenderConfig()
   Single bridge from formatting model → typed config
   All percent→fraction, enum sanitisation, colour
   extraction happens HERE and nowhere else (W10).
   ═══════════════════════════════════════════════ */

function safeEnum<T extends string>(
    val: string | undefined,
    allowed: readonly T[],
    fallback: T,
): T {
    if (val && (allowed as readonly string[]).includes(val)) return val as T;
    return fallback;
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export function buildRenderConfig(model: VisualFormattingSettingsModel): RenderConfig {
    const cs = model.chartSettingsCard;
    const co = model.colorSettingsCard;
    const ax = model.axisSettingsCard;
    const lb = model.labelSettingsCard;
    const lg = model.legendSettingsCard;
    const sm = model.summarySettingsCard;

    return {
        chart: {
            orientation: safeEnum(String(cs.orientation.value?.value ?? ""), ORIENTATIONS, "vertical"),
            barWidthFraction: clamp(cs.barWidth.value, 10, 100) / 100,
            barCornerRadius: clamp(cs.barCornerRadius.value, 0, 10),
            showConnectorLines: cs.showConnectorLines.value,
            connectorLineColor: cs.connectorLineColor.value.value || "#CBD5E1",
            connectorLineWidth: clamp(cs.connectorLineWidth.value, 0.5, 3),
            connectorLineStyle: safeEnum(String(cs.connectorLineStyle.value?.value ?? ""), CONNECTOR_LINE_STYLES, "solid"),
        },
        colors: {
            increaseColor: co.increaseColor.value.value || "#10B981",
            decreaseColor: co.decreaseColor.value.value || "#EF4444",
            totalColor: co.totalColor.value.value || "#3B82F6",
            startColor: co.startColor.value.value || "#64748B",
            selectedColor: co.selectedColor.value.value || "#2563EB",
        },
        axis: {
            showXAxis: ax.showXAxis.value,
            showYAxis: ax.showYAxis.value,
            axisFontSize: clamp(ax.axisFontSize.value, 7, 16),
            axisFontColor: ax.axisFontColor.value.value || "#64748B",
            showGridlines: ax.showGridlines.value,
            gridlineColor: ax.gridlineColor.value.value || "#F1F5F9",
            xLabelRotation: safeEnum(String(ax.xLabelRotation.value?.value ?? ""), X_LABEL_ROTATIONS, "45"),
            showBaselineLine: ax.showBaselineLine.value,
            baselineColor: ax.baselineColor.value.value || "#CBD5E1",
        },
        labels: {
            showValueLabels: lb.showValueLabels.value,
            labelPosition: safeEnum(String(lb.labelPosition.value?.value ?? ""), LABEL_POSITIONS, "above"),
            labelFontSize: clamp(lb.labelFontSize.value, 7, 16),
            labelFontColor: lb.labelFontColor.value.value || "#334155",
            showRunningTotal: lb.showRunningTotal.value,
            showPlusMinus: lb.showPlusMinus.value,
            valueFormat: safeEnum(String(lb.valueFormat.value?.value ?? ""), VALUE_FORMATS, "auto"),
        },
        legend: {
            showLegend: lg.showLegend.value,
            legendPosition: safeEnum(String(lg.legendPosition.value?.value ?? ""), LEGEND_POSITIONS, "top"),
            legendFontSize: clamp(lg.legendFontSize.value, 7, 16),
            legendFontColor: lg.legendFontColor.value.value || "#475569",
        },
        summary: {
            autoStartTotal: sm.autoStartTotal.value,
            autoEndTotal: sm.autoEndTotal.value,
            endTotalLabel: sm.endTotalLabel.value || "Total",
        },
    };
}
