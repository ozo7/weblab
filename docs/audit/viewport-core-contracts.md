# Viewport Core Contracts (Chunk B)

Date: 2026-03-13
Scope: reusable contracts to extract shared logic from `1080/720/360` viewports into `core/*`.

## 1. Decision Summary

- Contracts below are implementation-facing and designed for incremental extraction.
- Contract priority follows risk order: pure helpers -> screen builders -> subscriptions -> nav-area controller.
- Viewport-specific geometry/placement remains local to viewport files and CSS.

## 2. Shared Contract Modules

## 2.1 `core/nav-tree-view-helpers.js`

### Responsibility
Provide pure helpers for nav-tree label/title resolution.

### API
- `resolveNodeTitle(node): string`

### Input
- `node: { title?: string, label?: string, articleId?: string }`

### Output
- stable non-empty title string.

### Invariants
- No DOM access.
- No side effects.
- Deterministic for same input.

### Error Surface
- Invalid input yields fallback string (`"Menu"`).

---

## 2.2 `core/nav-tree-row-builders.js`

### Responsibility
Build menu/article row DOM nodes with behavior injected by callbacks.

### API
- `createMenuRow(options): HTMLElement`
- `createArticleRow(options): HTMLElement`

### Input (common)
- `node` (tree model entry)
- `classNames` (object of required class tokens)
- `depthClassName(depth): string`
- `onToggle(node): void`
- `onOpen(node): void`
- `resolveTitle(node): string`
- `isHomeRow(node): boolean` (article row)

### Output
- Fully wired row element.

### Invariants
- Builder does not mutate external state directly.
- All mutations occur through callbacks.
- No hardcoded viewport class names in core.

### Error Surface
- Throws only on missing required callbacks.
- Invalid node fields degrade to non-clickable row.

---

## 2.3 `core/navarea-history-screen.js`

### Responsibility
Render history list screen body used by navArea history modes.

### API
- `createHistoryScreen(options): HTMLElement`

### Input
- `historyIds: string[]`
- `classes` (head/list/item/empty class tokens)
- `createButton` helper
- `onOpenArticle(articleId): void`
- `headerText?: string`

### Output
- Screen section root element.

### Invariants
- No direct navigation object calls inside core.
- Empty state rendered when no history.

### Error Surface
- Invalid history array treated as empty.

---

## 2.4 `core/navarea-tags-screen.js`

### Responsibility
Render tags-driven queue + controls section shared across viewports.

### API
- `createTagsScreen(options): HTMLElement`

### Input
- `queueIds: string[]`
- `selectedArticleId: string | null`
- `articleMap?: Map<string, { title?: string }>`
- `selectedTagColors: Record<string, string>`
- `selectedTagsByArticle(articleId): string[]`
- `allTags: string[]`
- `selectedTags: Set<string>`
- `onOpenArticle(articleId): void`
- `onToggleTag(tag): void`
- `onClearTags(): void`
- `renderExtras?(context): HTMLElement | null` (for viewport-specific addons like 360 paging-mode entry)
- `classes` token map

### Output
- Screen section root element.

### Invariants
- No direct object mutation except through callbacks.
- Tag/queue rendering deterministic from inputs.

### Error Surface
- Missing optional fields degrade gracefully.

---

## 2.5 `core/configuration-preview-builder.js`

### Responsibility
Build and patch shared configuration preview model (illustration only).

### API
- `createConfigurationPreview(options): HTMLElement`
- `applyConfigurationPreview(previewEl, options): void`

### Input
- `scheme: { key, label, preview }`
- `mode: "full" | "mini"`
- `labels` text map
- optional watermark text

### Output
- Preview root element or patched existing preview.

### Invariants
- Uses preview model fields only.
- No `configuration` object writes.

### Error Surface
- Invalid scheme -> no-op placeholder preview.

---

## 2.6 `core/viewport-subscriptions.js`

### Responsibility
Centralize object subscription wiring and teardown composition.

### API
- `bindViewportSubscriptions(options): () => void`

### Input
- `navigation`, `tagPool`, `pagingQueue`, `configuration` (optional)
- `onNavigationEvent(event): void`
- `onTagPoolEvent(event): void`
- `onPagingQueueEvent(event): void`
- `onConfigurationEvent(event): void`

### Output
- single teardown function.

### Invariants
- Safe when any object is absent.
- Teardown idempotent.

### Error Surface
- Subscriber callback exceptions isolated per source.

---

## 2.7 `core/viewport-nav-area-controller.js`

### Responsibility
Normalize and transition nav-area/screen modes while delegating rendering and menu state updates.

### API
- `createNavAreaController(options): { setMode, getMode }`

### Input
- `allowedModes: string[]`
- `initialMode: string`
- `normalize(mode): string`
- `onBeforeChange(prev, next): void`
- `onAfterChange(prev, next): void`

### Output
- stateful controller interface.

### Invariants
- Single source of truth for active mode.
- Deterministic mode normalization.

### Error Surface
- Invalid mode falls back via `normalize`.

---

## 2.8 `core/overlay-dismiss.js`

### Responsibility
Provide generic outside-click dismissal behavior for menus/overlays.

### API
- `bindOutsideDismiss(options): () => void`

### Input
- `root: Element`
- `isEnabled(): boolean`
- `isInside(target, path): boolean`
- `onDismiss(event): void`

### Output
- teardown fn for document listener.

### Invariants
- Uses `composedPath` when available.
- Never dismisses when disabled.

### Error Surface
- Invalid event target safely ignored.

## 3. Cross-Module Invariants

1. Core modules must not import viewport files or viewport CSS classes.
2. Core modules can render DOM only with class tokens passed in via options.
3. Navigation/tag/config/paging state mutation must happen via callbacks or provided object methods.
4. Every extracted module must include a deterministic empty-state behavior.

## 4. Versioning / Migration Notes

- Contract version baseline: `v1` (document-level).
- During migration, keep temporary adapters in viewport files until each module is fully adopted.
- Remove old duplicated viewport code immediately after each module adoption.

## 5. Recommended Implementation Order (Chunk C onward)

1. `nav-tree-view-helpers` (low risk).
2. `navarea-history-screen`.
3. `overlay-dismiss`.
4. `navarea-tags-screen`.
5. `configuration-preview-builder`.
6. `viewport-subscriptions`.
7. `viewport-nav-area-controller`.

## 6. Open Decisions

1. Whether to include 360 Paging Mode as pluggable `renderExtras` in shared tags-screen contract (recommended) or keep entirely local.
2. Whether 1080 should adopt persistent session contract (to align with 720/360) before subscription/controller extraction.
