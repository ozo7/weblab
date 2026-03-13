# Shared Style Contract (`cs-*`)

This project uses a shared color-scheme contract for extracted visual styles.

## Rule

1. Viewport CSS files (`styles/viewport-*.css`) keep viewport-specific layout/positioning and behavior-only visuals.
2. Shared visual skin (colors, borders, radii, common button/row treatments) belongs to scheme CSS files in `styles/colorschemes/`.
3. Scheme CSS must be viewport-agnostic: no `wv1080-*`, `wv720-*`, `wv360-*` selectors.
4. Viewports opt into shared skin by adding `cs-*` classes in their markup/renderers.

## Core Shared Classes

1. `cs-shell`: base viewport surface/text skin.
2. `cs-content-host`: content pane shell.
3. `cs-rail`: nav/side pane shell.
4. `cs-rail-head`: rail head divider/skin.
5. `cs-nav-row`: nav row base for depth shading.

## Shared Controls

1. `cs-head-btn`: top rail action button.
2. `cs-head-icon`: icon span inside head button.
3. `cs-menu-trigger`: menu open button.
4. `cs-menu-list`: dropdown list shell.
5. `cs-menu-item`: dropdown entry.
6. `cs-menu-toggle`: tree expand/collapse button.
7. `cs-nav-btn`: nav article button.
8. `cs-list-btn`: list item button (history/queue/sitemap).
9. `cs-mini-nav-btn`: compact prev/next button.
10. `cs-chip-btn`: chip/tag style button.
11. `cs-action-btn`: panel action button.
12. `cs-scheme-btn`: color-scheme option button.
13. `cs-floating-btn`: floating circular controls (mobile overlays).

## Shared Text/State Helpers

1. `cs-section-head`: section headings/labels.
2. `cs-menu-label`: non-clickable menu labels.
3. `cs-empty`: empty-state card.

## Preview Helpers (Configuration Preview)

1. `cs-preview-card`
2. `cs-preview-btn`
3. `cs-preview-queue`
4. `cs-preview-qrow`
5. `cs-preview-tag`
6. `cs-preview-placeholder`
7. `cs-queue-stripe`

## Depth Contract

1. Rows that need nested shading must include `cs-nav-row` plus `is-depth-N`.
2. Supported range is `N = 0..6`; scheme may cap effective darkening.
3. Current `Minty premature` uses 15% per depth, capped at depth 4.
