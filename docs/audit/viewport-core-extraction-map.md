# Viewport Core Extraction Audit Map (Chunk A)

Date: 2026-03-13
Scope: `viewports/viewport-1080.js`, `viewports/viewport-720.js`, `viewports/viewport-360.js`
Objective: identify reusable code that should move to `core/*` while preserving viewport-specific layout/geometry.

## 1. Inventory Snapshot

- `viewport-1080.js`: 574 lines
- `viewport-720.js`: 631 lines
- `viewport-360.js`: 848 lines
- Total: 2053 lines

Current shared core already in use:
- `core/nav-rail-utils.js` (`createButton`, `getDepthClass`)
- `core/color-picker.js`
- `core/color-schemes.js`
- `core/article-fallback.js`

## 2. Duplication Map

## A. High-confidence extraction candidates (near-identical behavior)

1. Nav mode switching controller
- Duplicated in:
  - `viewport-1080.js`: `setRailMode`
  - `viewport-720.js`: `setRailMode`
  - `viewport-360.js`: `setActiveScreen` (same role, slightly different names/states)
- Shared behavior:
  - normalize next mode
  - update navigation navArea
  - update active UI markers
  - close menu/popover
  - re-render
- Extraction target:
  - `core/viewport-nav-area-controller.js`

2. Tree node title resolver
- Duplicated in all 3 as `getNodeTitle`
- Extraction target:
  - `core/nav-tree-view-helpers.js`

3. Menu/article tree row builders
- Duplicated in 1080/720 and analogous in 360 side-pane rows
- Shared behavior:
  - expand/collapse toggle
  - open node navigation
  - active row marking
  - home-row treatment
- Extraction target:
  - `core/nav-tree-row-builders.js`
  - pass viewport class names + callbacks as params

4. Tags screen section
- Duplicated concept and mostly structure across 1080/720/360
- Shared behavior:
  - queue rendering from `pagingQueue`
  - tag stripes from `tagPool`
  - clear tags action
  - selected count
- Extraction target:
  - `core/navarea-tags-screen.js`

5. History screen section
- Duplicated concept and structure across 1080/720/360
- Extraction target:
  - `core/navarea-history-screen.js`

6. Configuration preview model builder
- Duplicated in 1080/720 (`renderConfigurationPreviewIntoPane`) and now mirrored in 360 mini preview logic
- Extraction target:
  - `core/configuration-preview-builder.js`

7. Subscription orchestration pattern
- Duplicated in all 3:
  - subscribe navigation/tagPool/pagingQueue/configuration
  - conditional re-render paths
  - teardown unsubscribers
- Extraction target:
  - `core/viewport-subscriptions.js`

8. Outside-click menu close pattern
- Duplicated in 1080/720; 360 has analogous pattern for overlays/side pane
- Extraction target:
  - `core/overlay-dismiss.js` (generic predicate-based helper)

## B. Medium-confidence extraction candidates (shared but with viewport branching)

1. Rail/dropdown menu open/close wiring
- 1080/720 almost same; 360 similar semantics with different DOM shape
- Candidate after contract stabilization.

2. Home/back special-case when leaving `configuration`
- 1080/720 have same transition policy; 360 differs by screen model.
- Could become shared policy utility.

3. Session persistence wrappers
- 720/360 use `settingsStore` similarly; 1080 currently stateless in same way.
- Candidate only if 1080 session policy aligns.

## C. Keep viewport-local (do not extract)

1. Geometry + positional interaction
- 360 side pane tri-state (`open`/`partial`/`closed`)
- 360 paging overlay placement/hide rules
- 720 rail toggle position/animation
- 1080 fixed rail layout

2. Screen composition that is intentionally product-specific
- 360 Paging Mode screen behavior and control placement
- 360 overlay/hamburger constraints

3. Viewport CSS (`styles/viewport-*.css`) for dimensions/placement
- only agnostic skin rules belong in shared scheme files

## 3. Proposed Core Module Contract Targets (for Chunk B)

1. `core/nav-tree-view-helpers.js`
- `getNodeTitle(node): string`

2. `core/nav-tree-row-builders.js`
- `createMenuRow(options): HTMLElement`
- `createArticleRow(options): HTMLElement`
- options include class names, depth class strategy, callbacks (`onToggle`, `onOpen`).

3. `core/navarea-tags-screen.js`
- `createTagsScreen(options): HTMLElement`
- required options: `navigation`, `tagPool`, `pagingQueue`, `articleMap`, `classes`, `onSelectArticle`, `onClearTags`

4. `core/navarea-history-screen.js`
- `createHistoryScreen(options): HTMLElement`

5. `core/configuration-preview-builder.js`
- `buildConfigurationPreviewModel(options): HTMLElement | string`
- `applyConfigurationPreviewModel(el, schemeState): void`

6. `core/viewport-nav-area-controller.js`
- generic mode normalization + state transition callbacks

7. `core/viewport-subscriptions.js`
- `bindViewportSubscriptions(options): teardownFn`

## 4. Risk Ranking

- Low risk:
  - `getNodeTitle`
  - history section builder
  - outside-click helper
- Medium risk:
  - tags section builder (event hooks + minor viewport deltas)
  - configuration preview builder
- High risk:
  - full nav-area controller extraction across 360 vs rail-based 1080/720
  - row builders if class contracts are not explicit enough

## 5. Extraction Sequence Recommendation

1. Extract low-risk pure helpers first (`getNodeTitle`, small utilities).
2. Extract history/tags builders with strict adapter options.
3. Extract configuration preview builder + picker cluster adapters.
4. Extract subscription orchestration.
5. Extract nav-area controller last (highest coupling/risk).

## 6. Acceptance Criteria for Each Extraction Chunk

- No viewport behavior changes (manual parity check: 1080/720/360).
- No new viewport-specific logic introduced into `core/*`.
- New core modules expose explicit input/output contracts.
- Old duplicated viewport logic removed, not shadow-retained.

## 7. Open Decisions

1. Should 360 Paging Mode stay entirely local forever, or expose a generic "overlay navigation mode" contract for future reuse?
2. Should 1080 gain session persistence parity before extracting shared persistence wrappers?
