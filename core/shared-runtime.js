import { createRuntimeState } from "./state.js";
import {
  buildArticleMap,
  ensureExportAssetsLoaded,
  getLandingArticleId,
  loadArticleHtml,
  loadContentCatalog,
  mountArticleIntoPane,
  mountErrorIntoPane
} from "./content.js";
import { createNavigationCore } from "./navigation-core.js";
import { createSiteMap } from "./sitemap.js";
import { createSettingsStore } from "./settings-store.js";

function flattenTopLevelArticleIds(topLevel) {
  const ids = [];
  function walk(entries) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      if (entry.type === "article" && typeof entry.articleId === "string") {
        ids.push(entry.articleId);
      }
      walk(entry.children);
    });
  }
  walk(topLevel);
  return ids;
}

export function createSharedRuntimeSession(options) {
  const runtimeState = createRuntimeState();
  const getActivePane = options && typeof options.getActivePane === "function"
    ? options.getActivePane
    : () => null;

  const runtime = {
    navigation: null,
    siteMap: null,
    settingsStore: createSettingsStore(),
    articleRenderToken: 0
  };

  async function ensureLoaded() {
    if (runtimeState.website && runtime.navigation && runtime.siteMap) {
      return;
    }

    await ensureExportAssetsLoaded(runtimeState.sourceFolder);

    const catalog = await loadContentCatalog(runtimeState.sourceFolder);
    runtimeState.website = catalog.website;
    runtimeState.tags = catalog.tags;
    runtimeState.runtime = catalog.runtime;
    runtimeState.articleMap = buildArticleMap(runtimeState.website.topLevel, runtimeState.sourceFolder);

    const landingArticleId = getLandingArticleId(runtimeState.website, runtimeState.articleMap);
    runtime.navigation = createNavigationCore({
      articleMap: runtimeState.articleMap,
      landingArticleId
    });
    runtime.siteMap = createSiteMap({
      articleMap: runtimeState.articleMap,
      topLevel: runtimeState.website.topLevel,
      landingArticleId
    });

    runtime.navigation.subscribe((event) => {
      if (event.type !== "open") {
        return;
      }

      const article = runtimeState.articleMap.get(event.articleId);
      const pane = getActivePane();
      if (!article || !pane) {
        return;
      }

      const token = runtime.articleRenderToken + 1;
      runtime.articleRenderToken = token;

      loadArticleHtml(article, runtimeState.articleCache)
        .then((html) => {
          if (token !== runtime.articleRenderToken) {
            return;
          }
          mountArticleIntoPane(pane, html);
        })
        .catch((error) => {
          if (token !== runtime.articleRenderToken) {
            return;
          }
          mountErrorIntoPane(pane, "Unable to load article: " + error.message);
        });
    });
  }

  function getDefaultArticleId() {
    if (!runtime.navigation || !runtimeState.website) {
      return null;
    }
    const first = flattenTopLevelArticleIds(runtimeState.website.topLevel)[0];
    if (first) {
      return first;
    }
    return runtime.navigation.readState().landingArticleId || null;
  }

  function bindLinkDelegation(container) {
    if (!runtime.navigation) {
      return () => {};
    }
    return runtime.navigation.bindArticleLinkDelegation(container);
  }

  return {
    ensureLoaded,
    runtimeState,
    getNavigation() {
      return runtime.navigation;
    },
    getSiteMap() {
      return runtime.siteMap;
    },
    getSettingsStore() {
      return runtime.settingsStore;
    },
    getDefaultArticleId,
    bindLinkDelegation
  };
}
