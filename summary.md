## Recent Session Updates

1. Switched from static `python -m http.server` to Node server `server.js` for local runtime parity and media alias support.
2. Kept central editable config in `config/manual-settings.json`; server reads `paths.mediaAlias` and serves `/zz-media-files/*` from that filesystem alias.
3. Removed frontend media-root remap logic from content mount flow; media path resolution is now server-owned.
4. Added shared navigation tree core `core/nav-tree-core.js` and shared runtime bootstrap `core/shared-runtime.js`.
5. Viewport contract tightened: tree behavior/state in core, layout/rendering/styling in `viewports/*` and `styles/viewport-*.css` only.
6. Added shared stylesheet readiness loader `core/style-loader.js` so viewport render waits for CSS load (prevents switch-time visual race glitches).
7. Added file-backed settings API in `server.js` using `config/settings.json` (`GET/POST /api/settings`) and configured path in `config/manual-settings.json`.
8. Added shared settings persistence core `core/settings-store.js` (no `localStorage`) and queue logic core `core/queue-core.js`.
9. Activated real `720` viewport (`viewports/viewport-720.js` + `styles/viewport-720.css`) with slide-over rail, Esc/scrim close, persisted rail/session state, and sitemap/tag-driven queue.

## Always-Enforced Guidelines

1. `lab/*` is strictly lab-only overhead and must never contain production-required runtime or configuration.
2. Shared CSS goes in `styles/all.css`; viewport CSS files contain only viewport-specific finetuning/deviations.
3. Any class or identifier used in a viewport CSS file must not be defined outside that viewport's CSS file.
4. Shared JS valid for all viewports lives in `core/*`; never place deployment-required logic in `lab/*`.
5. Viewport-specific JS lives only in `viewports/viewport-*.js`; shared core files must stay viewport-agnostic.
6. Never use `!important` in project-owned CSS; fix selector scope and load/order instead.
7. Never use `localStorage`; persistence must be file-backed through server settings APIs.

# Next Steps Summary

1. Baseline lock: manually verify 1080 in Lab (home, back, nav click, in-article links, MP3 hydrate) and freeze this as reference.
2. Extract parity gaps: compare current Lab 1080 behavior vs `rail1080` and list missing features only.
3. Fill shared core first: move any missing link resolution/runtime hooks into `core/*` (no viewport-specific logic there).
4. Harden viewport contract: keep `viewports/viewport-1080.js` UI-only; no direct fetch/state logic.
5. Implement `720` adapter + CSS on same core APIs, test in Lab toggle.
6. Implement `360` adapter + CSS on same core APIs, test in Lab toggle.
7. Add a small “profile smoke test” checklist and run it for all 3 viewports before deployment work.
