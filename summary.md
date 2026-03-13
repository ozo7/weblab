## Always-Enforced Guidelines

1. `lab/*` is strictly lab-only overhead and must never contain production-required runtime or configuration.
2. Shared CSS goes in `styles/all.css`; viewport CSS files contain only viewport-specific finetuning/deviations.
3. Any class or identifier used in a viewport CSS file must not be defined outside that viewport's CSS file.
4. Shared JS valid for all viewports lives only in `core/content.js`, `core/navigation-core.js`, and `core/state.js`.
5. Viewport-specific JS lives only in `viewports/viewport-*.js`; shared core files must stay viewport-agnostic.
6. Never use `!important` in project-owned CSS; fix selector scope and load/order instead.

# Next Steps Summary

1. Baseline lock: manually verify 1080 in Lab (home, back, nav click, in-article links, MP3 hydrate) and freeze this as reference.
2. Extract parity gaps: compare current Lab 1080 behavior vs `rail1080` and list missing features only.
3. Fill shared core first: move any missing link resolution/runtime hooks into `core/*` (no viewport-specific logic there).
4. Harden viewport contract: keep `viewports/viewport-1080.js` UI-only; no direct fetch/state logic.
5. Implement `720` adapter + CSS on same core APIs, test in Lab toggle.
6. Implement `360` adapter + CSS on same core APIs, test in Lab toggle.
7. Add a small “profile smoke test” checklist and run it for all 3 viewports before deployment work.
