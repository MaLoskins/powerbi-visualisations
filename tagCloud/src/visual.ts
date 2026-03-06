/* ═══════════════════════════════════════════════
   Tag Cloud – Visual Entry Point (Orchestrator)
   ═══════════════════════════════════════════════ */

"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { VisualFormattingSettingsModel, buildRenderConfig } from "./settings";
import { RenderConfig, WordItem, PlacedWord, CloudCallbacks } from "./types";
import { resolveColumns } from "./model/columns";
import { parseRows, ParseResult } from "./model/parser";
import { computePlacement } from "./layout/placement";
import { renderCloud, applySelectionStyles } from "./render/cloud";
import { handleWordClick, clearSelection, getSelectedIdSet } from "./interactions/selection";
import { el } from "./utils/dom";
import { formatNumber } from "./utils/format";

/* ═══════════════════════════════════════════════
   Visual Class
   ═══════════════════════════════════════════════ */

export class Visual implements IVisual {
    /* ── Power BI SDK ── */
    private host!: IVisualHost;
    private selectionManager!: ISelectionManager;
    private tooltipService!: ITooltipService;
    private formattingSettingsService!: FormattingSettingsService;
    private formattingSettings!: VisualFormattingSettingsModel;

    /* ── DOM ── */
    private container!: HTMLElement;
    private svg!: SVGSVGElement;
    private errorOverlay!: HTMLElement;

    /* ── State ── */
    private parseResult: ParseResult | null = null;
    private placedWords: PlacedWord[] = [];
    private renderConfig!: RenderConfig;
    private selectedIds: Set<string> = new Set();
    private hasRenderedOnce = false;

    /* ═══════════════════════════════════════════════
       Constructor – build all DOM once (V1)
       ═══════════════════════════════════════════════ */

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = this.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();

        /* Container */
        this.container = el("div", "tcloud-container");
        options.element.appendChild(this.container);

        /* SVG canvas */
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.classList.add("tcloud-svg");
        this.container.appendChild(this.svg);

        /* Error overlay (hidden by default) */
        this.errorOverlay = el("div", "tcloud-error");
        this.errorOverlay.style.display = "none";
        this.container.appendChild(this.errorOverlay);

        /* Background click clears selection */
        this.svg.addEventListener("click", (e: MouseEvent) => {
            if (e.target === this.svg) {
                clearSelection(this.selectionManager).then(ids => {
                    this.selectedIds = ids;
                    applySelectionStyles(this.svg, this.selectedIds, this.renderConfig);
                });
            }
        });

        /* Register context menu */
        this.selectionManager.registerOnSelectCallback(() => {
            this.selectedIds = getSelectedIdSet(this.selectionManager);
            applySelectionStyles(this.svg, this.selectedIds, this.renderConfig);
        });
    }

    /* ═══════════════════════════════════════════════
       Update – gate on VisualUpdateType (V2)
       ═══════════════════════════════════════════════ */

    public update(options: VisualUpdateOptions): void {
        try {
            const updateType = options.type ?? 0;
            const hasData = (updateType & 2) !== 0;
            /* Always rebuild config */
            const dv = options.dataViews?.[0];
            if (dv) {
                this.formattingSettings = this.formattingSettingsService
                    .populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);
            }
            this.renderConfig = buildRenderConfig(
                this.formattingSettings ?? new VisualFormattingSettingsModel(),
            );

            /* Data change: full pipeline */
            if (hasData || !this.hasRenderedOnce) {
                if (!dv?.table) {
                    this.showError("Required fields missing.\nAdd a Word field and a Size measure.");
                    return;
                }

                const cols = resolveColumns(dv.table);
                if (!cols) {
                    this.showError("Required fields missing.\nAdd a Word field and a Size measure.");
                    return;
                }

                this.hideError();
                this.parseResult = parseRows(dv.table, cols, this.host);
            }

            /* Layout and render */
            if (this.parseResult) {
                this.layoutAndRender(options.viewport);
            }
        } catch (_err) {
            this.showError("An unexpected error occurred.");
        }
    }

    /* ═══════════════════════════════════════════════
       Layout & Render
       ═══════════════════════════════════════════════ */

    private layoutAndRender(viewport: powerbi.IViewport): void {
        const width = viewport.width;
        const height = viewport.height;

        /* Size the SVG */
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));

        if (!this.parseResult || this.parseResult.words.length === 0) {
            this.showError("No data to display.\nCheck your data fields.");
            return;
        }

        this.hideError();

        /* Compute placement */
        this.placedWords = computePlacement(
            this.parseResult.words,
            width,
            height,
            this.renderConfig,
        );

        if (this.placedWords.length === 0) {
            this.showError("Could not place any words.\nTry reducing font sizes or increasing visual size.");
            return;
        }

        /* Build interaction callbacks */
        const callbacks: CloudCallbacks = {
            onClick: (item: WordItem, e: MouseEvent) => {
                handleWordClick(item, e, this.selectionManager).then(ids => {
                    this.selectedIds = ids;
                    applySelectionStyles(this.svg, this.selectedIds, this.renderConfig);
                });
            },
            onMouseOver: (item: WordItem, x: number, y: number, e: MouseEvent) => {
                this.showTooltip(item, x, y, e);
            },
            onMouseMove: (item: WordItem, x: number, y: number, e: MouseEvent) => {
                this.showTooltip(item, x, y, e);
            },
            onMouseOut: () => {
                this.tooltipService.hide({ immediately: true, isTouchEvent: false });
            },
        };

        /* Render SVG */
        renderCloud(this.svg, this.placedWords, this.renderConfig, callbacks);

        /* Reapply selection styles */
        applySelectionStyles(this.svg, this.selectedIds, this.renderConfig);

        this.hasRenderedOnce = true;
    }

    /* ═══════════════════════════════════════════════
       Tooltips
       ═══════════════════════════════════════════════ */

    private showTooltip(item: WordItem, x: number, y: number, _e: MouseEvent): void {
        const tooltipItems: VisualTooltipDataItem[] = [
            { displayName: "Word", value: item.text },
            { displayName: "Size", value: formatNumber(item.value) },
        ];

        if (item.colorFieldValue != null) {
            tooltipItems.push({ displayName: "Colour Field", value: item.colorFieldValue });
        }

        for (const extra of item.tooltipExtras) {
            tooltipItems.push({ displayName: extra.displayName, value: extra.value });
        }

        const svgRect = this.svg.getBoundingClientRect();

        this.tooltipService.show({
            dataItems: tooltipItems,
            identities: [item.selectionId],
            coordinates: [svgRect.left + x, svgRect.top + y],
            isTouchEvent: false,
        });
    }

    /* ═══════════════════════════════════════════════
       Error Overlay
       ═══════════════════════════════════════════════ */

    private showError(msg: string): void {
        this.errorOverlay.textContent = msg;
        this.errorOverlay.style.display = "flex";
        this.svg.style.display = "none";
    }

    private hideError(): void {
        this.errorOverlay.style.display = "none";
        this.svg.style.display = "block";
    }

    /* ═══════════════════════════════════════════════
       Formatting Model
       ═══════════════════════════════════════════════ */

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
