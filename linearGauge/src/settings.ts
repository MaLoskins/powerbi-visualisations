/* ═══════════════════════════════════════════════
   Linear Gauge – Formatting Settings
   Slice factories, card classes, buildRenderConfig()
   ═══════════════════════════════════════════════ */
"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

import {
    RenderConfig,
    ORIENTATIONS,
    VALUE_LABEL_POSITIONS,
    VALUE_FORMATS,
    TARGET2_STYLES,
} from "./types";

/* ═══════════════════════════════════════════════
   Slice Factories
   ═══════════════════════════════════════════════ */

function num(
    name: string,
    displayName: string,
    value: number,
    min: number,
    max: number,
): formattingSettings.NumUpDown {
    return new formattingSettings.NumUpDown({
        name,
        displayName,
        value,
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: min }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: max } },
    });
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
        options: { minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 }, maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 100 } },
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
    return new formattingSettings.ItemDropdown({
        name,
        displayName,
        items: items.map((v, i) => ({ displayName: labels[i], value: v })),
        value: { displayName: labels[defaultIdx], value: items[defaultIdx] },
    });
}

/* ═══════════════════════════════════════════════
   Safe Enum Helper
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
   Formatting Cards
   ═══════════════════════════════════════════════ */

/* ── Import powerbi for ValidatorType ── */
import powerbi from "powerbi-visuals-api";

/* ── 1. Layout Settings ── */
class LayoutSettingsCard extends FormattingSettingsCard {
    orientation = dropdown("orientation", "Orientation",
        ORIENTATIONS, ["Horizontal", "Vertical"], 0);
    gaugeHeight = num("gaugeHeight", "Gauge Height", 24, 8, 60);
    gaugeSpacing = num("gaugeSpacing", "Gauge Spacing", 12, 0, 32);
    gaugeCornerRadius = num("gaugeCornerRadius", "Corner Radius", 4, 0, 20);
    categoryWidth = num("categoryWidth", "Category Width", 100, 0, 250);
    categoryFontSize = num("categoryFontSize", "Category Font Size", 11, 7, 18);
    categoryFontColor = color("categoryFontColor", "Category Font Color", "#334155");
    showCategoryLabels = toggle("showCategoryLabels", "Show Category Labels", true);

    name: string = "layoutSettings";
    displayName: string = "Layout";
    slices: FormattingSettingsSlice[] = [
        this.orientation, this.gaugeHeight, this.gaugeSpacing,
        this.gaugeCornerRadius, this.categoryWidth, this.categoryFontSize,
        this.categoryFontColor, this.showCategoryLabels,
    ];
}

/* ── 2. Bar Settings ── */
class BarSettingsCard extends FormattingSettingsCard {
    barColor = color("barColor", "Bar Color", "#3B82F6");
    barOpacity = pct("barOpacity", "Bar Opacity (%)", 100);
    trackColor = color("trackColor", "Track Color", "#F1F5F9");
    trackBorderColor = color("trackBorderColor", "Track Border Color", "#E2E8F0");
    trackBorderWidth = num("trackBorderWidth", "Track Border Width", 1, 0, 3);

    name: string = "barSettings";
    displayName: string = "Bar";
    slices: FormattingSettingsSlice[] = [
        this.barColor, this.barOpacity, this.trackColor,
        this.trackBorderColor, this.trackBorderWidth,
    ];
}

/* ── 3. Range Settings ── */
class RangeSettingsCard extends FormattingSettingsCard {
    showRanges = toggle("showRanges", "Show Ranges", false);
    range1Color = color("range1Color", "Range 1 Color", "#10B981");
    range2Color = color("range2Color", "Range 2 Color", "#F59E0B");
    rangeBeyondColor = color("rangeBeyondColor", "Beyond Range Color", "#EF4444");

    name: string = "rangeSettings";
    displayName: string = "Ranges";
    slices: FormattingSettingsSlice[] = [
        this.showRanges, this.range1Color, this.range2Color, this.rangeBeyondColor,
    ];
}

/* ── 4. Target Settings ── */
class TargetSettingsCard extends FormattingSettingsCard {
    showTarget = toggle("showTarget", "Show Target", true);
    targetColor = color("targetColor", "Target Color", "#1E293B");
    targetWidth = num("targetWidth", "Target Width", 3, 1, 6);
    targetHeight = pct("targetHeight", "Target Height (%)", 140);
    target2Color = color("target2Color", "Target 2 Color", "#64748B");
    target2Width = num("target2Width", "Target 2 Width", 2, 1, 6);
    target2Style = dropdown("target2Style", "Target 2 Style",
        TARGET2_STYLES, ["Solid", "Dashed"], 1);

    name: string = "targetSettings";
    displayName: string = "Targets";
    slices: FormattingSettingsSlice[] = [
        this.showTarget, this.targetColor, this.targetWidth,
        this.targetHeight, this.target2Color, this.target2Width, this.target2Style,
    ];
}

/* ── 5. Label Settings ── */
class LabelSettingsCard extends FormattingSettingsCard {
    showValueLabel = toggle("showValueLabel", "Show Value Label", true);
    valueLabelPosition = dropdown("valueLabelPosition", "Label Position",
        VALUE_LABEL_POSITIONS, ["Inside", "Right", "Left", "Above"], 1);
    valueFontSize = num("valueFontSize", "Font Size", 11, 7, 18);
    valueFontColor = color("valueFontColor", "Font Color", "#334155");
    valueFormat = dropdown("valueFormat", "Value Format",
        VALUE_FORMATS, ["Auto", "Number", "Percent", "Currency"], 0);
    showTargetLabel = toggle("showTargetLabel", "Show Target Labels", false);
    showMinMax = toggle("showMinMax", "Show Min/Max", false);

    name: string = "labelSettings";
    displayName: string = "Labels";
    slices: FormattingSettingsSlice[] = [
        this.showValueLabel, this.valueLabelPosition, this.valueFontSize,
        this.valueFontColor, this.valueFormat, this.showTargetLabel, this.showMinMax,
    ];
}

/* ── 6. Color Settings ── */
class ColorSettingsCard extends FormattingSettingsCard {
    colorByCategory = toggle("colorByCategory", "Color by Category", false);
    conditionalColoring = toggle("conditionalColoring", "Conditional Coloring", false);
    aboveTargetColor = color("aboveTargetColor", "Above Target Color", "#10B981");
    belowTargetColor = color("belowTargetColor", "Below Target Color", "#EF4444");
    selectedColor = color("selectedColor", "Selected Color", "#2563EB");

    name: string = "colorSettings";
    displayName: string = "Colors";
    slices: FormattingSettingsSlice[] = [
        this.colorByCategory, this.conditionalColoring,
        this.aboveTargetColor, this.belowTargetColor, this.selectedColor,
    ];
}

/* ═══════════════════════════════════════════════
   Formatting Settings Model
   ═══════════════════════════════════════════════ */

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    layoutCard = new LayoutSettingsCard();
    barCard = new BarSettingsCard();
    rangeCard = new RangeSettingsCard();
    targetCard = new TargetSettingsCard();
    labelCard = new LabelSettingsCard();
    colorCard = new ColorSettingsCard();

    cards = [
        this.layoutCard, this.barCard, this.rangeCard,
        this.targetCard, this.labelCard, this.colorCard,
    ];
}

/* ═══════════════════════════════════════════════
   buildRenderConfig()
   Converts formatting model → plain RenderConfig
   All pct → fraction conversions happen here.
   ═══════════════════════════════════════════════ */

export function buildRenderConfig(model: VisualFormattingSettingsModel): RenderConfig {
    const l = model.layoutCard;
    const b = model.barCard;
    const r = model.rangeCard;
    const t = model.targetCard;
    const lb = model.labelCard;
    const c = model.colorCard;

    return {
        layout: {
            orientation: safeEnum(l.orientation.value?.value as string | undefined, ORIENTATIONS, "horizontal"),
            gaugeHeight: l.gaugeHeight.value,
            gaugeSpacing: l.gaugeSpacing.value,
            gaugeCornerRadius: l.gaugeCornerRadius.value,
            categoryWidth: l.categoryWidth.value,
            categoryFontSize: l.categoryFontSize.value,
            categoryFontColor: l.categoryFontColor.value.value,
            showCategoryLabels: l.showCategoryLabels.value,
        },
        bar: {
            barColor: b.barColor.value.value,
            barOpacity: b.barOpacity.value / 100,          // pct → fraction (L1)
            trackColor: b.trackColor.value.value,
            trackBorderColor: b.trackBorderColor.value.value,
            trackBorderWidth: b.trackBorderWidth.value,
        },
        range: {
            showRanges: r.showRanges.value,
            range1Color: r.range1Color.value.value,
            range2Color: r.range2Color.value.value,
            rangeBeyondColor: r.rangeBeyondColor.value.value,
        },
        target: {
            showTarget: t.showTarget.value,
            targetColor: t.targetColor.value.value,
            targetWidth: t.targetWidth.value,
            targetHeight: t.targetHeight.value / 100,       // pct → fraction (L2)
            target2Color: t.target2Color.value.value,
            target2Width: t.target2Width.value,
            target2Style: safeEnum(t.target2Style.value?.value as string | undefined, TARGET2_STYLES, "dashed"),
        },
        label: {
            showValueLabel: lb.showValueLabel.value,
            valueLabelPosition: safeEnum(lb.valueLabelPosition.value?.value as string | undefined, VALUE_LABEL_POSITIONS, "right"),
            valueFontSize: lb.valueFontSize.value,
            valueFontColor: lb.valueFontColor.value.value,
            valueFormat: safeEnum(lb.valueFormat.value?.value as string | undefined, VALUE_FORMATS, "auto"),
            showTargetLabel: lb.showTargetLabel.value,
            showMinMax: lb.showMinMax.value,
        },
        color: {
            colorByCategory: c.colorByCategory.value,
            conditionalColoring: c.conditionalColoring.value,
            aboveTargetColor: c.aboveTargetColor.value.value,
            belowTargetColor: c.belowTargetColor.value.value,
            selectedColor: c.selectedColor.value.value,
        },
    };
}
