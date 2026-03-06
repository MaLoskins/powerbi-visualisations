# Power BI Custom Visuals - Developer Guide

> **Reference implementation:** `GanttChart/`
> Every visual in this monorepo must follow the conventions below to ensure consistent theming, code quality, and maintainability across the suite.

---

## 0. Build & Packaging Invariants (Hard Gates)

These rules are **non-negotiable**. If any rule is violated, the visual will likely fail `pbiviz package`.

### 0.1 Required `pbiviz.json` metadata (packaging WILL fail if missing)

Every visual's `pbiviz.json` MUST contain non-empty values for:

- `visual.description`
- `visual.supportUrl`
- `author.name`
- `author.email`

Do not leave placeholders blank. If you don't have a real URL yet, use a stable placeholder like `https://example.com/support`.

### 0.2 API version pinning (avoid forced reinstall + type drift)

Repository-wide rule:

- `pbiviz.json` → `apiVersion` MUST EXACTLY match `package.json` → `dependencies.powerbi-visuals-api`
- Pin a single repo-wide version and reuse it in every visual (do not “float” versions).

If these don’t match, `pbiviz` will reinstall the API during packaging and can introduce inconsistent types between visuals.

### 0.3 Dependencies MUST match features used (no implicit deps)

If the code uses any of the following, the dependency MUST exist in `package.json`:

- Uses `host.applyJsonFilter(...)` and/or Power BI filter objects (e.g., `BasicFilter`, `AdvancedFilter`)
  - MUST include: `powerbi-models`
- Uses D3 transitions (`selection.transition()`)
  - MUST include: `d3-transition` (and import it — see Section 9)

No “it works on my machine” assumptions: if a module is imported or a feature requires a package, add it explicitly.

### 0.4 TypeScript strictness gates (compile must succeed on strict settings)

Assume strict TS rules are ON.

- All class fields MUST either:
  - be initialized where declared, OR
  - be assigned in the constructor, OR
  - use definite assignment (`private host!: IVisualHost;`) when safe.
- All DataView reads MUST be null-guarded (never assume `table.rows` exists):
  - `const rows = table.rows ?? [];`
  - if `dataView?.table` is missing, render an empty state and exit cleanly.


## 1. Repository Layout

```
POWERBI/
├── DEVELOPER-README.md          <-- this file (root-level)
├── shared/                      <-- shared design system (SSoT)
│   └── theme/
│       ├── palette.ts           <-- canonical palettes & tokens
│       ├── color-utils.ts       <-- canonical colour utilities
│       └── theme-base.less      <-- shared LESS variables & mixins
├── sync_theme.sh                <-- propagates shared theme into modules
├── build_all_visuals.sh         <-- builds all visuals
├── GanttChart/                  <-- reference visual
├── advancedGauge/
├── waterfallChart/
└── …
```

Each visual is a standalone `pbiviz` project with its own `package.json`, `tsconfig.json`, and `pbiviz.json`. Visuals are independently packageable, but share a common design system via the `shared/theme/` directory (see Section 3).

---

## 2. Project Structure (per visual)

Every visual **must** follow this directory layout. The exact set of sub-folders and files scales with visual complexity - **each visual's prompt defines its own FILE STRUCTURE section that specifies which folders and files to create.** Simpler visuals may only need `visual.ts`, `settings.ts`, `types.ts`, and `constants.ts` plus a handful of modules; complex visuals (like the Gantt reference) will use the full set of sub-folders shown below. The naming conventions, separation of concerns, and import rules remain mandatory regardless of which folders are present.

```
<VisualName>/
├── assets/
│   └── icon.png
├── capabilities.json
├── eslint.config.mjs
├── package.json
├── pbiviz.json
├── tsconfig.json
├── tsconfig.dev.json              <-- optional, for `pbiviz start`
├── style/
│   └── visual.less
└── src/
    ├── visual.ts                  <-- entry point / orchestrator (always present)
    ├── settings.ts                <-- formatting model + buildRenderConfig() (always present)
    ├── types.ts                   <-- domain interfaces, literal unions, RenderConfig
    ├── constants.ts               <-- palette arrays, magic numbers, shared config
    ├── model/                     <-- data transformation pipeline
    │   ├── columns.ts             <-- resolveColumns() - data-role --> index mapping
    │   ├── parser.ts              <-- parseLeafRows() - row --> domain model
    │   └── hierarchy.ts           <-- tree building, sorting, flattening (if needed)
    ├── render/                    <-- DOM / SVG drawing functions
    │   ├── chart.ts               <-- primary chart rendering
    │   └── labels.ts              <-- data labels, legends, etc.
    ├── layout/                    <-- scale & measurement logic
    │   └── <scaleModule>.ts       <-- d3 scale construction, layout math
    ├── interactions/              <-- selection, click, drag handlers
    │   └── selection.ts           <-- applySelectionStyles(), handleClick()
    └── utils/                     <-- pure helper functions (no side-effects)
        ├── color.ts               <-- colour resolution, hex validation
        ├── dom.ts                 <-- el(), clearChildren(), clamp()
        └── format.ts              <-- number/percent/currency formatting
```

> **Note:** The tree above is the **maximum** layout showing all possible folders. Each prompt's FILE STRUCTURE section is authoritative for that visual - create exactly the folders and files it lists.

### Folder Responsibilities

| Folder | Purpose | May import from |
|--------|---------|-----------------|
| `model/` | Parse Power BI `DataViewTable` rows into typed domain objects, build hierarchy, sort, flatten | `types`, `constants`, `utils/` |
| `render/` | Produce or update DOM/SVG elements from the domain model. Stateless - receives data + config, returns nothing or a position map | `types`, `constants`, `utils/` |
| `layout/` | Compute scales, dimensions, px-per-unit. No DOM mutation | `types`, `constants`, `utils/` |
| `interactions/` | Handle selection, click-to-select, multi-select, deselect | `types` |
| `utils/` | Pure functions only. Zero Power BI imports, zero DOM side-effects (except `dom.ts` element factories) | `constants` only |
| `ui/` | Stateful UI widgets (toolbar, scrollbar styler) that own DOM and expose an `update` method | `types`, `utils/` |

### Import Rules

- `utils/` --> may only import from `constants.ts`
- `model/` --> may import `types`, `constants`, `utils/`
- `render/`, `layout/`, `interactions/`, `ui/` --> may import `types`, `constants`, `utils/`
- `settings.ts` --> imports `types` only. **`settings.ts` must not import `constants.ts`; use literal hex strings (e.g., `"#3B82F6"`) for palette default values, not imported constants.**
- `visual.ts` --> imports everything (orchestrator)
- **Circular imports are forbidden.** The dependency graph is strictly top-down from `visual.ts`.

---

## 3. Design System - "Slate + Blue"

All visuals share a single design language. The design system is defined once in `shared/theme/` and propagated to each module.

### 3.0 Shared Theme Architecture

The shared theme consists of three files at the repository root:

| File | Purpose | Consumed by |
|------|---------|-------------|
| `shared/theme/palette.ts` | Canonical palettes, design tokens, semantic colours | `sync_theme.sh` → each module's `constants.ts` |
| `shared/theme/color-utils.ts` | Colour manipulation utilities (hex validation, HSL conversion, palette generation) | `sync_theme.sh` → each module's `utils/color.ts` |
| `shared/theme/theme-base.less` | LESS variables and mixins (reset, container, error overlay, scrollbar) | `@import` from each module's `style/visual.less` |

#### How it works

- **TypeScript** (`constants.ts`, `utils/color.ts`): Because `pbiviz` cannot resolve cross-project imports, these files are synced via `sync_theme.sh`. Each module's file contains marker comments (`[SHARED THEME START]`/`[SHARED THEME END]` and `[SHARED COLOR UTILS START]`/`[SHARED COLOR UTILS END]`) that delimit the auto-generated shared section. Module-specific constants and functions live **outside** these markers.
- **LESS** (`visual.less`): Each module imports the shared base via `@import "../../shared/theme/theme-base";` at the top of its `visual.less`. The LESS preprocessor resolves this relative path at build time.

#### Workflow

1. **Edit** the shared files in `shared/theme/` to change design tokens, palettes, or utilities.
2. **Run** `./sync_theme.sh` to propagate TypeScript changes into all modules.
3. **Build** visuals normally — LESS changes are picked up automatically via `@import`.

```bash
# Sync shared theme into all modules
./sync_theme.sh

# Sync a single module
./sync_theme.sh GanttChart

# Build all
./build_all_visuals.sh
```

**Rules:**
- Never edit content between `[SHARED THEME START]` and `[SHARED THEME END]` markers in module files — it will be overwritten.
- Module-specific constants and functions go **after** the shared block's end marker.
- Always run `sync_theme.sh` after editing `shared/theme/palette.ts` or `shared/theme/color-utils.ts`.

### Base Palette (Tailwind Slate)

| Token | Hex | Usage |
|-------|-----|-------|
| `slate-50` | `#F8FAFC` | Odd row bg, toolbar bg, lightest surface |
| `slate-100` | `#F1F5F9` | Weekend shading, header bg, scrollbar track |
| `slate-200` | `#E2E8F0` | Grid lines, button borders, dividers |
| `slate-300` | `#CBD5E1` | Planned bar fill, scrollbar thumb, axis lines |
| `slate-400` | `#94A3B8` | Default bar colour (unassigned), dependency lines |
| `slate-500` | `#64748B` | Cancelled status, subtle text |
| `slate-600` | `#475569` | Group bar colour |
| `slate-700` | `#334155` | Body text, button labels |
| `slate-800` | `#1E293B` | Header backgrounds (dark), header font |
| `slate-900` | `#0F172A` | Deepest contrast |

### Accent Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `blue-50` | `#EFF6FF` | Current-week highlight |
| `blue-500` | `#3B82F6` | Selected bar highlight, "In Progress" status |
| `blue-600` | `#2563EB` | Active toolbar button bg |
| `blue-700` | `#1D4ED8` | Progress overlay |

### Semantic Colours

| Token | Hex | Usage |
|-------|-----|-------|
| `red-500` | `#EF4444` | Today line, danger, milestone fallback |
| `red-600` | `#DC2626` | Critical path, blocked status |
| `amber-500` | `#F59E0B` | On-hold / caution |
| `emerald-500` | `#10B981` | Complete / success |
| `orange-500` | `#F97316` | At-risk / warning |

### Resource & Category Palette

When bars must be distinguished by a categorical field (resource, category, segment, etc.), cycle through the shared `RESOURCE_COLORS` array defined in `constants.ts`. This array is **15 colours** chosen for WCAG AA contrast against white labels and clear mutual differentiation.

```ts
export const RESOURCE_COLORS = [
    "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444",
    "#06B6D4", "#F97316", "#EC4899", "#6366F1", "#14B8A6",
    "#84CC16", "#A855F7", "#0EA5E9", "#D946EF", "#78716C",
] as const;
```

**Rule:** If a visual needs a categorical colour cycle, it must use this exact array (or a subset). Do not invent ad-hoc palettes.

### Status Palette

Semantic RAG (Red/Amber/Green) colours for status fields, defined as a `Record<string, string>` in `constants.ts`. Visuals with a status concept must reuse `STATUS_COLORS` rather than defining their own.

### Row Striping

Even rows: `#FFFFFF` (white). Odd rows: `#F8FAFC` (slate-50). These are the defaults in every visual's colour settings.

---

## 4. TypeScript Conventions

### Language & Tooling

- **TypeScript ≥ 5.5**, strict mode enabled
- **ESLint** with `@typescript-eslint` + `eslint-plugin-powerbi-visuals`
- **No `enum` keyword** - use `as const` arrays with derived union types:

```ts
export const ZOOM_LEVELS = ["day", "week", "month", "quarter", "year", "fit"] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
```

This pattern is mandatory for every finite set of options. It enables runtime iteration (`for (const z of ZOOM_LEVELS)`) and compile-time narrowing simultaneously, and avoids TypeScript's `const enum` erasure issues with the `pbiviz` bundler.

### Naming

| Construct | Convention | Example |
|-----------|-----------|---------|
| Interfaces | `PascalCase` | `GanttTask`, `RenderConfig`, `TaskPosition` |
| Type aliases (unions) | `PascalCase` | `ZoomLevel`, `BarLabelPosition` |
| `as const` arrays | `UPPER_SNAKE_CASE` | `ZOOM_LEVELS`, `SORT_FIELDS` |
| Colour/config constants | `UPPER_SNAKE_CASE` | `RESOURCE_COLORS`, `DAY_MS` |
| Functions | `camelCase`, verb-led | `buildRenderConfig()`, `resolveColumns()`, `parseLeafRows()` |
| Boolean properties | `is`/`show`/`has` prefix | `isGroup`, `showGrid`, `hasRenderedOnce` |
| Private class fields | `camelCase` (no underscore prefix) | `private host`, `private expandedSet` |
| CSS classes | `kebab-case` with visual prefix from Appendix B | `gantt-bar-group`, `agauge-arc` |

### Type Safety

- **No `any`** except where explicitly required for Power BI SDK workarounds (document with comment).
- All settings properties must be typed to their narrowest literal union.
- Prefer `unknown` + narrowing over `any` for parsed values.
- Use `safeEnum()` to sanitize string-to-union conversions at the settings boundary:

```ts
function safeEnum<T extends string>(
    val: string | undefined,
    allowed: readonly T[],
    fallback: T,
): T {
    if (val && (allowed as readonly string[]).includes(val)) return val as T;
    return fallback;
}
```

### Module Pattern

- **One export per concern.** Files export cohesive groups of related functions or a single class.
- **No default exports** (except `Visual` as required by `pbiviz`).
- **Barrel files (`index.ts`) are not used.** Import directly from the source file.
- Prefer **pure functions** over classes. Classes are reserved for stateful widgets (`Toolbar`, `ScrollbarStyler`) and the `Visual` orchestrator.

---

## 5. The `RenderConfig` Pattern

Every visual must define a **`RenderConfig`** interface that mirrors the complete formatting surface as a plain typed object. This is the single bridge between the Power BI formatting model and all render code.

### Why

- Render modules never import `formattingSettings`. They receive a `RenderConfig` (or a sub-section of it).
- All percent-to-fraction conversions, enum sanitisation, and colour extraction happen **once** in `buildRenderConfig()`.
- Unit tests can construct a `RenderConfig` literal without mocking Power BI.

### Structure

`RenderConfig` is a flat object of named sections, each section corresponding to one formatting card:

```ts
export interface RenderConfig {
    timeline: { /* ... */ };
    task:     { /* ... */ };
    colors:   { /* ... */ };
    grid:     { /* ... */ };
    labels:   { /* ... */ };
    // ... one section per capabilities.json object
}
```

### Conversion Rules in `buildRenderConfig()`

| Setting type | Extraction | Conversion |
|-------------|-----------|------------|
| `ToggleSwitch` | `.value` | none |
| `NumUpDown` | `.value` | none (already numeric) |
| `NumUpDown` (percent) | `.value` | **÷ 100** --> 0-1 fraction |
| `ColorPicker` | `.value.value` | none (already hex string) |
| `ItemDropdown` | `.value?.value` | `safeEnum()` to literal union |

**Rule:** Render code must never see a percentage as 0-100. All percentages are converted to 0-1 fractions inside `buildRenderConfig()`.

Render and layout modules must NOT import:

- powerbi-visuals-api
- powerbi-models
- selectionManager
- host APIs
- formattingSettings

All Power BI SDK interaction must occur in visual.ts or interactions/ modules only.

---

## 6. Settings & `capabilities.json`

### Formatting Model


Settings use the `powerbi-visuals-utils-formattingmodel` package with `SimpleCard` classes. Each card corresponds to one `objects` entry in `capabilities.json`.

**Critical:** The `name` property on each Card class **must exactly match** the key in `capabilities.json` --> `objects`.

#### Formatting Model Hard Rules (prevents recurring TS errors)

1) Dropdown values MUST be strings.
- `formattingSettings.Dropdown` expects string values.
- If your "enum" is numeric (0/1/2), encode as `"0" | "1" | "2"` in the dropdown values and convert to number inside `buildRenderConfig()`.

2) Do not invent validator shapes.
- Only use validators if you are copying an existing, known-good pattern from the reference visual.
- If uncertain, omit validators entirely (prefer runtime clamping in `buildRenderConfig()`).

3) All settings conversion happens in `buildRenderConfig()`.
- Treat formatting values as untrusted input.
- Clamp numeric ranges and normalize strings there (never scatter conversions throughout render code).


### Slice Factories

To reduce boilerplate, define factory functions at the top of `settings.ts`:

```ts
function num(name, displayName, value, min, max): formattingSettings.NumUpDown { /* ... */ }
function pct(name, displayName, defaultPct): formattingSettings.NumUpDown { /* ... */ }
function color(name, displayName, hex): formattingSettings.ColorPicker { /* ... */ }
function toggle(name, displayName, value): formattingSettings.ToggleSwitch { /* ... */ }
function dropdown(name, displayName, items, labels, defaultIdx): formattingSettings.ItemDropdown { /* ... */ }
```

Every visual should copy these factories verbatim and use them for all slice declarations.

### Root Model

```ts
export class VisualFormattingSettingsModel extends Model {
    timelineCard = new TimelineCardSettings();
    // ...
    cards = [this.timelineCard, /* ... */];
}
```

### `capabilities.json` Structure

```jsonc
{
    "dataRoles": [ /* ... */ ],
    "objects": {
        "<cardName>": {
            "properties": {
                "<sliceName>": { "type": { "<kind>": true } }
            }
        }
    },
    "dataViewMappings": [ /* table mapping */ ],
    "tooltips": { "supportedTypes": { "default": true, "canvas": true }, "roles": ["tooltipFields"] },
    "privileges": []
}
```

- Always use **table** data view mapping (not categorical/matrix) unless the visual specifically requires it.
- Set `dataReductionAlgorithm.top.count` to at least `10000`.
- Include a `tooltipFields` data role for user-defined tooltip extras.

---

## 7. The `visual.ts` Orchestrator

The main `Visual` class has three responsibilities and **no rendering logic of its own**:

1. **DOM scaffolding** - build the entire DOM skeleton once in the `constructor`. All elements are created here and stored as private fields. Subsequent updates mutate existing elements, never recreate them.
2. **Data pipeline** - in `update()`, gate on `VisualUpdateType` flags to skip expensive work on resize-only or style-only changes.
3. **Render orchestration** - call into `render/`, `layout/`, `ui/`, and `interactions/` modules. The visual itself does not append SVG elements or set CSS.

### Update Type Gating

```ts
// VisualUpdateType bit flags (const enum - numeric literals)
// Data = 2, Resize = 4, ViewMode = 8, ResizeEnd = 16, Style = 32
const updateType = options.type ?? 0;
const hasData    = (updateType & 2) !== 0;
const isResizeOnly = !hasData && (updateType & (4 | 16)) !== 0;
```

| Scenario | Action |
|----------|--------|
| Resize only | Re-layout + re-render (skip data parse) |
| Style/format change only | Rebuild `RenderConfig`, re-render (skip data parse) |
| Data change | Full pipeline: parse --> hierarchy --> sort --> flatten --> render |

### DOM Creation Strategy

- Use `el()` helper from `utils/dom.ts` for HTML elements.
- Use `document.createElementNS(...)` for SVG root elements.
- CSS classes use the visual's registered prefix from Appendix B (`gantt-`, `agauge-`, `waterfall-`, etc.) to prevent collisions in dashboards with multiple custom visuals.

### Render Flow

Every path that needs a visual refresh calls `layoutAndRender()`:

```
layoutAndRender()
  └── applyLayoutConfig()      <-- set CSS layout properties
  └── renderAll()
       ├── computeAndSetPxPerDay()
       ├── renderGridHeader()
       ├── renderGridBody()
       ├── renderTimelineHeader()
       ├── renderTimelineBody()
       └── toolbar.updateState()
```

---

## 8. Data Pipeline Pattern

The data pipeline follows a strict sequence. Each stage is a pure function (or near-pure) in `model/`:

```
DataViewTable
    │
    ▼
resolveColumns(table) --> ColumnIndex
    │
    ▼
parseLeafRows(table, cols, host) --> ParseResult { tasks[], taskById, ... }
    │
    ▼
buildHierarchy(tasks, ...) --> rootTasks[]      <-- tree structure
    │
    ▼
applySortRecursive(rootTasks, sortBy, dir)     <-- in-place sort
    │
    ▼
flattenVisible(rootTasks, searchTerm) --> flatVisible[]  <-- display list
    │
    ▼
computeTimeRange(tasks, padding) --> { min, max }
    │
    ▼
computeCriticalPath(tasks, taskById) --> Set<id>         <-- optional
```

### Column Resolution

`resolveColumns()` reads `table.columns[i].roles` to map data-role names to column indices. Returns a `ColumnIndex` object. This runs once per data update.

### Row Parsing

`parseLeafRows()` iterates every row and produces typed domain objects. Key rules:

- Rows missing required fields (start/end dates) are **silently skipped** - never throw.
- Progress values are normalised to 0-1 regardless of input scale (0-1, 0-100, or ratio with a base).
- Colour assignment happens here: explicit colour field --> resource colour map --> default.
- Selection IDs are created here via `host.createSelectionIdBuilder().withTable(table, r).createSelectionId()`.

### Domain Model

Every visual must define a primary domain interface (e.g., `GanttTask`, `GaugeSegment`, `WaterfallItem`). This interface carries all parsed and computed fields needed by render modules. Render code **never** touches `DataViewTable` directly.

---

## 9. Rendering Conventions

#### D3 transitions (must be explicit)

If you call `selection.transition()` anywhere:

- Add `d3-transition` to `package.json`.
- Add a side-effect import once in the module that uses transitions:

```ts
import "d3-transition";
```

### SVG Rendering (d3)

- Use `d3-selection` for SVG element creation and attribute setting.
- Use `d3-scale` (typically `scaleTime` or `scaleLinear`) for coordinate mapping.
- Clear SVG contents at the start of each render: `d3svg.selectAll("*").remove()`.
- All SVG class names use the visual prefix: `.gantt-bar`, `.gantt-dep-line`, etc.
- Attach `data-task-id` and `data-row` attributes to interactive groups for selection lookup.

### HTML Rendering

- Use the `el()` factory from `utils/dom.ts`.
- Clear container contents with `clearChildren()` before re-rendering.
- Set inline styles from `RenderConfig` values - do not hard-code colours or dimensions.

### Interaction Callbacks

Render functions accept a callbacks object rather than importing the selection manager directly:

```ts
export interface GridBodyCallbacks {
    onToggle: (task: GanttTask) => void;
    onClick: (task: GanttTask, e: MouseEvent) => void;
}
```

This keeps render code decoupled from Power BI APIs and makes it testable.

---

## 10. Styling (`visual.less`)

### Structure

```less
/* ═══════════════════════════════════════════════
   <Visual Name> - Power BI Custom Visual Styles
   H1: Reduced nesting, reusable classes
   H2: CSS variables for dynamic styling
   ═══════════════════════════════════════════════ */
```

### Rules

1. **Flat selectors.** Avoid deep nesting. Target classes directly: `.gantt-grid-row`, not `.gantt-container .gantt-main .gantt-grid .gantt-grid-body .gantt-grid-row`.
2. **CSS custom properties** for dynamic values that change at runtime (scrollbar dimensions, colours). Set them via JS on the container element; consume them in LESS.
3. **`box-sizing: border-box`** globally on the container and all descendants.
4. **Font stack:** `"Segoe UI", "wf_segoe-ui_normal", "Helvetica Neue", Helvetica, Arial, sans-serif` - this is the Power BI system font stack.
5. **Base font size:** `11px`. All `pt` / `px` sizes in the format pane are relative to this.
6. **No colour literals in LESS** beyond structural defaults (borders, scrollbar fallbacks). All user-facing colours come from `RenderConfig` and are set via inline styles in JS.
7. **Transitions** are limited to `0.1s-0.15s` for hover/focus feedback. No animation on data changes.
8. **Scrollbar hiding** for synced panes: `scrollbar-width: none` + `::-webkit-scrollbar { width: 0; height: 0; }`.
9. **Prefix all classes** with the visual's registered prefix from Appendix B (e.g., `gantt-`, `agauge-`, `waterfall-`) to avoid dashboard collisions.

### CSS Variable Convention

```less
.gantt-container {
    --sb-width: 8px;
    --sb-track: #F0F0F0;
    --sb-thumb: #CCCCCC;
    --sb-thumb-hover: #999999;
    --sb-radius: 4px;
}
```

JS updates these at runtime:

```ts
container.style.setProperty("--sb-width", cfg.scrollbarWidth + "px");
```

---

## 11. Selection & Interactivity

### Selection Manager

- Created once in the `Visual` constructor via `host.createSelectionManager()`.
- Multi-select supported via `e.ctrlKey || e.metaKey`.
- Click on empty background clears selection.

### Selection Application

`applySelectionStyles()` operates on existing DOM - it does not recreate elements. It:

1. Reads active selection IDs from the manager.
2. Dims unselected bars (`opacity: 0.25`) and grid rows (`opacity: 0.35`).
3. Adds stroke highlight to selected bars.
4. Toggles a `.gantt-grid-row-selected` class on grid rows.

### Cross-filtering (report interactions)

When the visual must filter other visuals / the report:

- Use `host.applyJsonFilter(...)` (do not rely on selection manager for cross-filtering).
- Implement filtering using a **single-column** filter strategy:
  - choose one leaf-level identity column (e.g., `id`, `categoryKey`, `taskId`)
  - always filter on that column only

Dependency requirement:
- If you construct filter objects (e.g., `BasicFilter`, `AdvancedFilter`) you MUST include `powerbi-models` in `package.json`.

Rules:
- Keep filter construction in `interactions/` (e.g., `src/interactions/filter.ts`).
- `visual.ts` should call a single helper like `applyFilter(host, parsedData, selection)`.
- Filtering must be deterministic and reversible (clear filter on background click / clear selection).


### Tooltips

- Use `host.tooltipService.show()` / `.move()` / `.hide()`.
- Build tooltip items from domain model fields, not raw data.
- Always include the formatted date using the user's chosen `dateFormat`.
- Append user-defined `tooltipExtra` items at the end.

---

## 12. Toolbar & UI Widgets

Stateful UI components follow the **create-once, update-state** pattern:

```ts
export class Toolbar {
    constructor(parent: HTMLDivElement, callbacks: ToolbarCallbacks) {
        // Build all DOM once
    }

    updateState(cfg: RenderConfig["toolbar"], activeZoom: ZoomLevel): void {
        // Toggle visibility, update styles, highlight active state
    }
}
```

- DOM is created in the constructor and never destroyed.
- `updateState()` is called on every render cycle to sync appearance with config.
- Callbacks are passed in at construction time - the widget never imports Power BI APIs.

---

## 13. Error Handling

- Display a centred error overlay (`.gantt-error` / `.<prefix>-error`) when required fields are missing.
- Hide the toolbar and main area when in error state.
- Use `showError(msg)` / `hideError()` methods on the Visual class.
- Error messages should be user-friendly: `"Required fields missing.\nAdd at least one Task Name field, plus Start Date and End Date."`
- **Never throw** from `update()`. Catch issues and show the overlay.

---

## 14. Dependencies

### Required (all visuals)

```json
{
    "powerbi-visuals-api": "~5.3.0",
    "powerbi-visuals-utils-formattingmodel": "6.0.4"
}
```

### Approved Libraries

| Library | Version | Use for |
|---------|---------|---------|
| `d3-scale` | 4.x | Coordinate scales |
| `d3-selection` | 3.x | SVG element creation |
| `d3-shape` | 3.x | Arc generators, pie layout, line/area curves |
| `d3-hierarchy` | 3.x | Tree layout, pack layout |
| `d3-force` | 3.x | Force-directed simulation |
| `d3-zoom` | 3.x | Zoom/pan behaviour |
| `d3-drag` | 3.x | Drag interaction |
| `d3-time` | 3.x | Time intervals |
| `d3-time-format` | 4.x | Axis tick formatting |
| `powerbi-models` | latest | `BasicFilter`, `AdvancedFilter` for filter API (slicers only) |

Import only the specific d3 module needed - never import all of d3. Only add a library to `package.json` when the prompt requires it.

### Dev Dependencies

```json
{
    "typescript": "5.5.4",
    "@typescript-eslint/eslint-plugin": "8.8.0",
    "eslint": "9.11.1",
    "eslint-plugin-powerbi-visuals": "1.0.0"
}
```

### Scripts

```json
{
    "start": "pbiviz start --project tsconfig.dev.json",
    "package": "pbiviz package",
    "lint": "npx eslint ."
}
```

---

## 15. Checklist for New Visuals

When creating a new visual, verify every item:

- [ ] Folder structure matches the prompt's FILE STRUCTURE section (see Section 2 for conventions)
- [ ] `types.ts` defines domain interface + `RenderConfig` + all literal unions via `as const`
- [ ] `constants.ts` contains `[SHARED THEME START]`/`[SHARED THEME END]` markers with shared palette (run `sync_theme.sh`)
- [ ] `settings.ts` uses slice factories (`num`, `pct`, `color`, `toggle`, `dropdown`)
- [ ] `settings.ts` exports `buildRenderConfig()` with percent --> fraction conversion
- [ ] `settings.ts` does not import `constants.ts` - palette defaults use literal hex strings
- [ ] Card `name` properties match `capabilities.json` object keys exactly
- [ ] `visual.ts` builds all DOM in constructor, never in `update()`
- [ ] `visual.ts` gates on `VisualUpdateType` flags
- [ ] Render functions accept `RenderConfig` (or sub-sections), never formatting model classes
- [ ] Render functions accept callback objects for interactions
- [ ] All CSS classes use the visual's registered prefix from Appendix B
- [ ] `visual.less` uses the standard font stack and `box-sizing` reset
- [ ] `utils/color.ts` contains `[SHARED COLOR UTILS START]`/`[SHARED COLOR UTILS END]` markers (run `sync_theme.sh`)
- [ ] `visual.less` imports shared theme: `@import "../../shared/theme/theme-base";`
- [ ] Default colours draw exclusively from the Slate + Blue palette
- [ ] No `enum` keyword - use `as const` + derived union types
- [ ] No `any` except documented Power BI SDK workarounds
- [ ] `package.json` uses the same dependency versions listed in Section 14
- [ ] Error overlay exists and is shown when required fields are missing
- [ ] Tooltips use `host.tooltipService` with domain-model fields
- [ ] Selection uses `host.createSelectionManager()` with multi-select support

---

## 16. Comment & Documentation Style

### Section Headers

Use box-drawing dividers for major sections within a file:

```ts
/* ═══════════════════════════════════════════════
   Section Name
   ═══════════════════════════════════════════════ */
```

Use lighter dividers for sub-sections:

```ts
/* ── Sub-section ── */
```

### Inline Tags

Use short alphanumeric tags (e.g., `G1`, `G2`, `F2`, `H1`) to cross-reference design decisions across files. Document the tag meaning where it's first introduced:

```ts
/** Visible-row buffer for scroll virtualization (G3) */
```

### JSDoc

- Use `/** ... */` for exported functions and class methods.
- Keep descriptions to one line where possible.
- Omit `@param` / `@returns` when the types are self-documenting.

---

## 17. Version Management

- `package.json` version and `pbiviz.json` visual version must always match.
- Use the `sync-version` script to verify:

- `pbiviz.json.apiVersion` MUST match `package.json.dependencies["powerbi-visuals-api"]`.
- Add and run a `sync-api` script to fail fast when this drifts:

```json
"sync-api": "node -e \"const p=require('./package.json');const v=require('./pbiviz.json');const dep=p.dependencies&&p.dependencies['powerbi-visuals-api'];const api=v.apiVersion; if(!dep||!api||dep.replace('^','').replace('~','')!==api){console.error('API mismatch: package.json powerbi-visuals-api vs pbiviz.json apiVersion');process.exit(1)}\""
```


---

## Appendix A: Quick-Start Template

To scaffold a new visual:

```bash
pbiviz new <visualName>
cd <visualName>
# Replace generated src/ with the folder structure from Section 2
# Copy eslint.config.mjs from GanttChart/
# Copy slice factories from GanttChart/src/settings.ts
# Copy utils/ folder from GanttChart/src/utils/ (dom.ts, color.ts, date.ts)
# Run sync_theme.sh to populate shared palette and colour utilities:
cd .. && ./sync_theme.sh <visualName> && cd <visualName>
# Add @import "../../shared/theme/theme-base"; to style/visual.less
# Define your domain interface, RenderConfig, and literal unions in types.ts
# Wire everything through visual.ts
```

## Appendix B: CSS Class Prefix Registry

To prevent collisions when multiple custom visuals coexist on a single Power BI dashboard page, each visual claims a unique kebab-case prefix:

| Visual | Prefix |
|--------|--------|
| GanttChart | `gantt-` |
| advancedGauge | `agauge-` |
| advancedPieDonutChart | `apie-` |
| advancedTrellis | `trellis-` |
| bubbleScatterChart | `bscatter-` |
| bulletChart | `bullet-` |
| hierarchicalVarianceTree | `hvtree-` |
| hierarchyFilterSlicer | `hfslicer-` |
| linearGauge | `lgauge-` |
| marimekkoChart | `marimekko-` |
| multiAxesChart | `maxes-` |
| packedBubble | `pbubble-` |
| performanceFlow | `pflow-` |
| radarPolarChart | `radar-` |
| tagCloud | `tcloud-` |
| varianceChart | `variance-` |
| waterfallChart | `waterfall-` |

Register new prefixes here before starting development.