# Merging Spec

## Objective

Build a standalone Viewport Lab application that mocks `360`, `720`, and `1080` layouts while sharing:
- content data (`zz-export` migration output + JSON)
- `export.css` and `export.js` behavior targeting `main#pane2main`
- runtime core logic for article loading and internal article navigation

The production app must be deployable without Lab overhead.

## Architecture Direction

1. Keep `rail1080` untouched as a reference implementation.
2. Create a new independent app stack (Lab + App) that extracts the proven shared core behavior.
3. Separate shared runtime/content from viewport-specific navigation UI.

## File Architecture

### Shared Core

- `core/content.js`
  - loads `website.json`, `tags.json`, `runtime.json`
  - loads article HTML
  - loads `export.css` and `export.js`
  - mounts content into host `#pane2main`
- `core/navigation-core.js`
  - exposes `openArticleById(articleId, options)`
  - shared internal link delegation via `a[data-article-id]`
  - shared landing/home resolution
- `core/state.js`
  - shared runtime state and persistence contract

### Viewport-Specific Modules

- `viewports/viewport-1080.js`
- `viewports/viewport-720.js`
- `viewports/viewport-360.js`

- `styles/viewport-1080.css`
- `styles/viewport-720.css`
- `styles/viewport-360.css`

Each viewport module contains only unique navigation structure/interaction and styling.

### Lab-Only Overhead

- `lab/lab.html`
- `lab/lab.js`
- `lab/lab.css`

Lab provides right-side viewport switch controls and mock framing behavior.

### Production Entry

- `app/app.html`
- `app/app.js`

Production entry must not depend on `lab/*`.

### Config and Scripts

- `config/viewport-profiles.json`
  - declares `360/720/1080` profiles (adapter, css, sizing metadata)
- `scripts/build-production.sh`
  - builds deploy artifact excluding `lab/*`
- `scripts/check-links.sh`
  - validates internal article links resolve to known article IDs

## Hard Rules

1. Shared article loading must mount into host `#pane2main` only.
2. One open-article function path (`openArticleById`) must be used by:
- nav entries
- in-article internal links
- quick navigation controls
3. Internal article links must follow migration + runtime contract:
- migration resolves `internal-nav-ref="resolved:<articleId>"`
- migration writes valid `data-article-id`
- runtime delegates clicks on `a[data-article-id]` and prevents default
4. Viewport differences belong only in `viewports/*` and `styles/viewport-*.css`.
5. Lab overhead belongs only in `lab/*` and must be removable from production deployment.

## First Implementation Steps

1. Scaffold directories/files for `core/`, `viewports/`, `styles/`, `lab/`, `app/`, `config/`.
2. Implement `core/content.js` with article mount and export asset loading.
3. Implement `core/navigation-core.js` with:
- `openArticleById`
- in-pane `a[data-article-id]` delegation
- landing/home resolver
4. Create `lab/lab.html` + `lab/lab.js` + `lab/lab.css`:
- right-side switch (`360/720/1080`)
- load only `1080` profile first
5. Create `app/app.html` + `app/app.js` using same core + `1080` profile, no Lab UI.
6. Add `config/viewport-profiles.json` and drive adapter/css selection from it.
7. Add `scripts/check-links.sh` and run it against `zz-export/articles`.
8. Manual baseline verification for `1080` in both Lab and App entrypoints before adding `720`.
