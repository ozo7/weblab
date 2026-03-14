## Recent Session Updates

### Latest Updates (Architect-Led Core Extraction Audit Chunks)

1. Added audit planning docs:
   - `docs/audit/viewport-core-extraction-map.md`
   - `docs/audit/viewport-core-contracts.md`
2. Extracted shared nav tree/title/history/outside-dismiss helpers into core and wired all 3 viewports:
   - `core/nav-tree-view-helpers.js`
   - `core/navarea-history-screen.js`
   - `core/overlay-dismiss.js`
3. Extracted shared nav row builders and tree rendering helpers, reused by 1080/720/360:
   - `core/nav-tree-row-builders.js`
   - `core/nav-tree-renderer.js`
   - `core/nav-tree-builder-factory.js`
4. Extracted shared nav area mode/menu activation helpers for 1080/720:
   - `core/nav-area-controller.js`
   - `core/nav-area-mode.js`
5. Extracted shared nav area tags and configuration UI helpers:
   - `core/navarea-tags-screen.js`
   - `core/navarea-configuration-panel.js`
   - `core/configuration-controls.js`
   - `core/configuration-preview-builder.js`
6. Extracted shared subscription helper and wired teardown consistency:
   - `core/viewport-subscriptions.js`
7. Viewports now keep viewport-specific geometry/behavior while reusing shared object/UI core across 1080/720/360.

### Latest Updates (360 NavArea/Paging + Shared Fallback Reuse)

1. Reworked `360` hamburger dropdown to match `720` style/behavior: vertical menu box, left of hamburger on same baseline, with `home` as first item.
2. Rebuilt `360` navArea screens around shared objects (`Navigation`, `TagPool`, `PagingQueue`, `Configuration`) and removed legacy queue/tag chooser paths.
3. Added `360` Paging Mode flow:
   - `Enter Pagination Mode` commits selected tag pages to `PagingQueue`.
   - first queued page is navigated on mode entry.
   - bottom overlay paging controls (`<`, `Paging i / X`, `>`) navigate via `Navigation`.
   - top-right close exits paging mode.
4. Converted paging controls to true overlay behavior so normal article content keeps loading/interaction under controls.
5. Hid conflicting controls in `360` navArea/paging contexts (hamburger/menu/side-toggle according to mode rules).
6. Updated `360` History selection to open selected page and close navArea.
7. Updated `360` Configuration screen:
   - removed duplicate title.
   - enlarged illustration model with 3 style-category blocks.
   - added diagonal `Illustration Demo` watermark.
   - grouped Pastell picker + Pastell scheme button together; Pastell shown first.
   - fixed picker drag/render loop by avoiding full-screen rebuild on pastel color drag and updating preview in place.
8. Enforced no-empty-content fallback when leaving navAreas, then refactored to reusable shared helper:
   - new shared module: `core/article-fallback.js`.
   - reused in `viewports/viewport-1080.js`, `viewports/viewport-720.js`, `viewports/viewport-360.js`.
   - wired `articleMap` into 1080 viewport creation in `lab/lab.js`.
9. Removed obsolete always-visible `360` overlay buttons (`Home`, old `<`, old `>`).
10. Pushed integrated changes in commit `98725c6` (`master`).

### Latest Updates (Shared Color Scheme Contract Across 1080/720/360)

1. Added a shared color-scheme stylesheet loader `core/color-scheme-style.js` and wired it in app/lab startup so selected scheme CSS is loaded dynamically.
2. Locked active selectable scheme to `minty-premature` in `Configuration` object while keeping other scheme buttons visible but disabled for staged rollout.
3. Added dedicated shared scheme file `styles/colorschemes/minty-premature.css` and moved extracted visual skin rules into agnostic `cs-*` classes.
4. Replaced viewport-coupled tree depth selectors with generic depth contract (`.cs-nav-row.is-depth-*`) used by all viewports.
5. Increased nested tree darkening to 15% per depth and capped effective darkening at depth 4.
6. Updated Home/Back icon rendering to icon+label spans and styled icons via shared class (`.cs-head-icon`) at 50% larger + bold.
7. Migrated 1080 viewport to shared contract classes (`cs-shell`, `cs-content-host`, `cs-rail`, `cs-menu-*`, `cs-nav-btn`, `cs-chip-btn`, `cs-section-head`, `cs-preview-*`, etc.) and removed extracted visual literals from `styles/viewport-1080.css`.
8. Migrated 720 viewport to the same shared contract classes and removed extracted visual literals from `styles/viewport-720.css` (keeping viewport-specific toggle/geometry styles local).
9. Migrated 360 viewport to shared contract classes for side nav/sitemap/queue/chips/overlay actions and removed scheme-specific viewport selectors from shared scheme file.
10. Normalized shared style contract so `styles/colorschemes/minty-premature.css` no longer depends on any `wv1080-*`, `wv720-*`, or `wv360-*` selectors.

### Latest Updates (Configuration + Shared Color System)

1. Added object-based `Configuration` model: `core/configuration-object.js` with persisted state (`selectedSchemeKey`, `pastelBaseColor`, `colorSchemesVisible`) and API methods for scheme selection/toggle.
2. Centralized color scheme definitions and helpers in `core/color-schemes.js` (10 schemes total, including dynamic pastel resolution and readable text helper).
3. Added reusable shared picker module `core/color-picker.js` with smooth pointer drag, hue slider, hex sync, and one-time shared style injection.
4. Refactored 1080 configuration nav area to use `Configuration` object + shared picker; `Color Schemes` panel now shows 10 styled scheme buttons and a dynamic pastel picker.
5. Added configuration illustration rendering into the content pane (preview-only) when `navArea=configuration`.
6. Updated runtime wiring in `core/shared-runtime.js`: loads/persists `Configuration` object and suppresses article mounting while nav area is `configuration`.
7. Updated 1080 `Home`/`Back` behavior to exit `configuration` back to `menus` and then perform normal navigation.
8. Refactored tag-to-queue orchestration ownership:
   - `TagPool` now identifies pages from selected tags and feeds `PagingQueue`.
   - `PagingQueue` exposes generic `setPages(pageIds, { allowReorder })`.
   - 1080 viewport no longer manually rebuilds queue logic in click handlers.
9. Added lab/static references for scheme exploration:
   - `lab/tag-color-orders.html`
   - `lab/theme-color-schemes.html`
   - `lab/theme-color-strategies.html`
   - `lab/theme-color-strategies-v2.html`
10. Added `Configuration` object to lab internals inspector so live state is inspectable and heat-color tracked.

1. Switched from static `python -m http.server` to Node server `server.js` for local runtime parity and media alias support.
2. Kept central editable config in `config/manual-settings.json`; server reads `paths.mediaAlias` and serves `/zz-media-files/*` from that filesystem alias.
3. Removed frontend media-root remap logic from content mount flow; media path resolution is now server-owned.
4. Added shared navigation tree core `core/nav-tree-core.js` and shared runtime bootstrap `core/shared-runtime.js`.
5. Viewport contract tightened: tree behavior/state in core, layout/rendering/styling in `viewports/*` and `styles/viewport-*.css` only.
6. Added shared stylesheet readiness loader `core/style-loader.js` so viewport render waits for CSS load (prevents switch-time visual race glitches).
7. Added file-backed settings API in `server.js` using `config/settings.json` (`GET/POST /api/settings`) and configured path in `config/manual-settings.json`.
8. Added shared settings persistence core `core/settings-store.js` (no `localStorage`) and queue logic core `core/queue-core.js`.
9. Activated real `720` viewport (`viewports/viewport-720.js` + `styles/viewport-720.css`) with slide-over rail, Esc/scrim close, persisted rail/session state, and sitemap/tag-driven queue.
10. Split host alignment by viewport rule: `1080` stays flush-left; `720` and `360` are centered in their viewport CSS files.
11. Activated real `360` viewport (`viewports/viewport-360.js` + `styles/viewport-360.css`) reusing core queue/sitemap/tag logic (same behavior model as 720) with 360-specific overlay layout.
12. Fixed 360 overlay visibility by honoring `[hidden]` state in CSS and defaulting nav overlay open for quick access.
13. Fixed 360 mock behavior: Lab now applies fixed height for viewport `360` from profile so mobile overlays stay pinned while content scrolls inside the mock screen.

## Always-Enforced Guidelines

1. `lab/*` is strictly lab-only overhead and must never contain production-required runtime or configuration.
2. Shared CSS goes in `styles/all.css`; viewport CSS files contain only viewport-specific finetuning/deviations.
3. Any class or identifier used in a viewport CSS file must not be defined outside that viewport's CSS file.
4. Shared JS valid for all viewports lives in `core/*`; never place deployment-required logic in `lab/*`.
5. Viewport-specific JS lives only in `viewports/viewport-*.js`; shared core files must stay viewport-agnostic.
6. Never use `!important` in project-owned CSS; fix selector scope and load/order instead.
7. Never use `localStorage`; persistence must be file-backed through server settings APIs.
8. For mobile viewport mocks, keep the simulated viewport height fixed from profile settings so overlay controls stay anchored to the mock screen.

# Next Steps Summary

1. Baseline lock: manually verify 1080 in Lab (home, back, nav click, in-article links, MP3 hydrate) and freeze this as reference.
2. Extract parity gaps: compare current Lab 1080 behavior vs `rail1080` and list missing features only.
3. Fill shared core first: move any missing link resolution/runtime hooks into `core/*` (no viewport-specific logic there).
4. Harden viewport contract: keep `viewports/viewport-1080.js` UI-only; no direct fetch/state logic.
5. Run a manual parity pass for 360 overlay UX against `../webview-360` and list intentional deltas.
6. Add a small “profile smoke test” checklist and run it for all 3 viewports before deployment work.
