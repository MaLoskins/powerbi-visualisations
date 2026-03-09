/* ═══════════════════════════════════════════════
   Hierarchy Filter Slicer – Settings
   Formatting model + buildRenderConfig()
   Note: No imports from constants.ts (S1)
   ═══════════════════════════════════════════════ */

"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import {
    RenderConfig,
    FONT_FAMILIES,
    FONT_WEIGHTS,
    FontFamily,
    FontWeight,
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
    min: number,
    max: number,
): formattingSettings.NumUpDown {
    return new formattingSettings.NumUpDown({
        name,
        displayName,
        value,
        options: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any — ValidatorType const enum workaround
            minValue: { value: min, type: 0 as any },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            maxValue: { value: max, type: 1 as any },
        },
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
    defaultIdx: number,
): formattingSettings.ItemDropdown {
    const dropdownItems = items.map((item) => ({ value: item, displayName: item }));
    return new formattingSettings.ItemDropdown({
        name,
        displayName,
        items: dropdownItems,
        value: dropdownItems[defaultIdx],
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

/* ── Safe enum sanitiser (S2) ── */

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

/* ── Tree Settings Card ── */

class TreeSettingsCard extends FormattingSettingsCard {
    indentSize = num("indentSize", "Indent Size (px)", 20, 8, 40);
    rowHeight = num("rowHeight", "Row Height (px)", 28, 20, 48);
    fontSize = num("fontSize", "Font Size", 11, 8, 18);
    fontColor = color("fontColor", "Font Color", "#334155");
    fontFamily = dropdown("fontFamily", "Font Family", ["Segoe UI", "Arial", "Calibri"], 0);
    selectedFontWeight = dropdown("selectedFontWeight", "Selected Font Weight", ["normal", "bold"], 1);
    showIcons = toggle("showIcons", "Show Icons", true);
    iconSize = num("iconSize", "Icon Size (px)", 14, 10, 24);

    name: string = "treeSettings";
    displayName: string = "Tree Appearance";
    slices: FormattingSettingsSlice[] = [
        this.indentSize,
        this.rowHeight,
        this.fontSize,
        this.fontColor,
        this.fontFamily,
        this.selectedFontWeight,
        this.showIcons,
        this.iconSize,
    ];
}

/* ── Checkbox Settings Card ── */

class CheckboxSettingsCard extends FormattingSettingsCard {
    checkboxSize = num("checkboxSize", "Checkbox Size (px)", 16, 12, 24);
    checkedColor = color("checkedColor", "Checked Color", "#3B82F6");
    uncheckedBorder = color("uncheckedBorder", "Unchecked Border", "#CBD5E1");
    indeterminateColor = color("indeterminateColor", "Indeterminate Color", "#93C5FD");
    checkboxRadius = num("checkboxRadius", "Border Radius (px)", 3, 0, 8);

    name: string = "checkboxSettings";
    displayName: string = "Checkboxes";
    slices: FormattingSettingsSlice[] = [
        this.checkboxSize,
        this.checkedColor,
        this.uncheckedBorder,
        this.indeterminateColor,
        this.checkboxRadius,
    ];
}

/* ── Search Settings Card ── */

class SearchSettingsCard extends FormattingSettingsCard {
    showSearchBox = toggle("showSearchBox", "Show Search Box", true);
    searchPlaceholder = text("searchPlaceholder", "Placeholder Text", "Search…");
    highlightMatches = toggle("highlightMatches", "Highlight Matches", true);

    name: string = "searchSettings";
    displayName: string = "Search";
    slices: FormattingSettingsSlice[] = [
        this.showSearchBox,
        this.searchPlaceholder,
        this.highlightMatches,
    ];
}

/* ── Header Settings Card ── */

class HeaderSettingsCard extends FormattingSettingsCard {
    showHeader = toggle("showHeader", "Show Header", true);
    showSelectAll = toggle("showSelectAll", "Show Select All", true);
    showExpandCollapse = toggle("showExpandCollapse", "Show Expand/Collapse", true);
    headerBackground = color("headerBackground", "Background", "#F8FAFC");
    headerFontColor = color("headerFontColor", "Font Color", "#475569");
    headerFontSize = num("headerFontSize", "Font Size", 10, 8, 14);
    headerBorderColor = color("headerBorderColor", "Border Color", "#E2E8F0");

    name: string = "headerSettings";
    displayName: string = "Header";
    slices: FormattingSettingsSlice[] = [
        this.showHeader,
        this.showSelectAll,
        this.showExpandCollapse,
        this.headerBackground,
        this.headerFontColor,
        this.headerFontSize,
        this.headerBorderColor,
    ];
}

/* ── Container Settings Card ── */

class ContainerSettingsCard extends FormattingSettingsCard {
    background = color("background", "Background", "#FFFFFF");
    borderWidth = num("borderWidth", "Border Width (px)", 1, 0, 4);
    borderColor = color("borderColor", "Border Color", "#E2E8F0");
    borderRadius = num("borderRadius", "Border Radius (px)", 4, 0, 12);
    scrollbarWidth = num("scrollbarWidth", "Scrollbar Width (px)", 6, 4, 14);
    scrollbarThumbColor = color("scrollbarThumbColor", "Scrollbar Thumb", "#CBD5E1");
    scrollbarTrackColor = color("scrollbarTrackColor", "Scrollbar Track", "#F8FAFC");

    name: string = "containerSettings";
    displayName: string = "Container";
    slices: FormattingSettingsSlice[] = [
        this.background,
        this.borderWidth,
        this.borderColor,
        this.borderRadius,
        this.scrollbarWidth,
        this.scrollbarThumbColor,
        this.scrollbarTrackColor,
    ];
}

/* ═══════════════════════════════════════════════
   Root Formatting Settings Model
   ═══════════════════════════════════════════════ */

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    treeSettingsCard = new TreeSettingsCard();
    checkboxSettingsCard = new CheckboxSettingsCard();
    searchSettingsCard = new SearchSettingsCard();
    headerSettingsCard = new HeaderSettingsCard();
    containerSettingsCard = new ContainerSettingsCard();

    cards = [
        this.treeSettingsCard,
        this.checkboxSettingsCard,
        this.searchSettingsCard,
        this.headerSettingsCard,
        this.containerSettingsCard,
    ];
}

/* ═══════════════════════════════════════════════
   buildRenderConfig()
   Converts formatting model into a plain typed
   RenderConfig. All extraction and sanitisation
   happens here (R1).
   ═══════════════════════════════════════════════ */

export function buildRenderConfig(model: VisualFormattingSettingsModel): RenderConfig {
    const t = model.treeSettingsCard;
    const c = model.checkboxSettingsCard;
    const s = model.searchSettingsCard;
    const h = model.headerSettingsCard;
    const cn = model.containerSettingsCard;

    return {
        tree: {
            indentSize: t.indentSize.value,
            rowHeight: t.rowHeight.value,
            fontSize: t.fontSize.value,
            fontColor: t.fontColor.value.value,
            fontFamily: safeEnum<FontFamily>(t.fontFamily.value?.value as string, FONT_FAMILIES, "Segoe UI"),
            selectedFontWeight: safeEnum<FontWeight>(t.selectedFontWeight.value?.value as string, FONT_WEIGHTS, "bold"),
            showIcons: t.showIcons.value,
            iconSize: t.iconSize.value,
        },
        checkbox: {
            checkboxSize: c.checkboxSize.value,
            checkedColor: c.checkedColor.value.value,
            uncheckedBorder: c.uncheckedBorder.value.value,
            indeterminateColor: c.indeterminateColor.value.value,
            checkboxRadius: c.checkboxRadius.value,
        },
        search: {
            showSearchBox: s.showSearchBox.value,
            searchPlaceholder: s.searchPlaceholder.value,
            highlightMatches: s.highlightMatches.value,
        },
        header: {
            showHeader: h.showHeader.value,
            showSelectAll: h.showSelectAll.value,
            showExpandCollapse: h.showExpandCollapse.value,
            headerBackground: h.headerBackground.value.value,
            headerFontColor: h.headerFontColor.value.value,
            headerFontSize: h.headerFontSize.value,
            headerBorderColor: h.headerBorderColor.value.value,
        },
        container: {
            background: cn.background.value.value,
            borderWidth: cn.borderWidth.value,
            borderColor: cn.borderColor.value.value,
            borderRadius: cn.borderRadius.value,
            scrollbarWidth: cn.scrollbarWidth.value,
            scrollbarThumbColor: cn.scrollbarThumbColor.value.value,
            scrollbarTrackColor: cn.scrollbarTrackColor.value.value,
        },
    };
}
