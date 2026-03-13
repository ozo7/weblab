import { createRuntimeState } from "./state.js";
import {
  buildArticleMap,
  ensureExportAssetsLoaded,
  getLandingArticleId,
  loadJson,
  loadArticleHtml,
  loadContentCatalog,
  mountArticleIntoPane,
  mountErrorIntoPane
} from "./content.js";
import { createNavigationCore } from "./navigation-core.js";
import { createNavigationObject } from "./navigation-object.js";
import { createPagingHistory } from "./paging-history.js";
import { createPagingQueue } from "./paging-queue.js";
import { createInternalLinks } from "./internal-links.js";
import { createSiteMap } from "./sitemap.js";
import { createSettingsStore } from "./settings-store.js";
import { createTagPool } from "./tag-pool.js";

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
    objects: {
      navigation: null,
      tagPool: null,
      pagingQueue: null,
      pagingHistory: null,
      internalLinks: null
    },
    settingsStore: createSettingsStore(),
    articleRenderToken: 0,
    objectPersistenceWired: false
  };

  async function loadInternalLinksData(sourceFolder) {
    try {
      return await loadJson(sourceFolder + "/internal-links.json");
    } catch (_) {
      return {
        meta: {},
        links: [],
        brokenLinks: [],
        inbound: {},
        outbound: {}
      };
    }
  }

  function wireObjectPersistence() {
    if (runtime.objectPersistenceWired) {
      return;
    }
    runtime.objectPersistenceWired = true;

    const objectEntries = [
      ["siteMap", runtime.siteMap],
      ["navigation", runtime.objects.navigation],
      ["tagPool", runtime.objects.tagPool],
      ["pagingQueue", runtime.objects.pagingQueue],
      ["pagingHistory", runtime.objects.pagingHistory],
      ["internalLinks", runtime.objects.internalLinks]
    ];

    objectEntries.forEach(([key, object]) => {
      if (!object || typeof object.subscribe !== "function" || typeof object.createSnapshot !== "function") {
        return;
      }
      object.subscribe(() => {
        runtime.settingsStore.setObjectSnapshot(key, object.createSnapshot());
        runtime.settingsStore.schedulePersist(120);
      });
    });
  }

  async function ensureLoaded() {
    if (runtimeState.website && runtime.navigation && runtime.siteMap) {
      return;
    }

    await ensureExportAssetsLoaded(runtimeState.sourceFolder);
    await runtime.settingsStore.load();

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
    runtime.objects.pagingHistory = createPagingHistory({ max: 20 });
    runtime.objects.navigation = createNavigationObject({
      articleMap: runtimeState.articleMap,
      landingArticleId,
      pagingHistory: runtime.objects.pagingHistory
    });
    runtime.objects.tagPool = createTagPool({
      tagMap: runtimeState.tags
    });
    runtime.objects.pagingQueue = createPagingQueue({
      topLevel: runtimeState.website.topLevel,
      articleMap: runtimeState.articleMap,
      tagMap: runtimeState.tags,
      tagPool: runtime.objects.tagPool
    });
    runtime.objects.internalLinks = createInternalLinks({
      data: await loadInternalLinksData(runtimeState.sourceFolder)
    });

    const siteMapSnapshot = runtime.settingsStore.getObjectSnapshot("siteMap", runtime.siteMap.createSnapshot());
    runtime.siteMap.loadSnapshot(siteMapSnapshot);
    runtime.objects.navigation.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("navigation", runtime.objects.navigation.createSnapshot())
    );
    runtime.objects.navigation.history.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("pagingHistory", runtime.objects.pagingHistory.createSnapshot())
    );
    runtime.objects.tagPool.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("tagPool", runtime.objects.tagPool.createSnapshot())
    );
    runtime.objects.pagingQueue.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("pagingQueue", runtime.objects.pagingQueue.createSnapshot())
    );
    runtime.objects.internalLinks.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("internalLinks", runtime.objects.internalLinks.createSnapshot())
    );

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

    wireObjectPersistence();
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
    getNavigationObject() {
      return runtime.objects.navigation;
    },
    getTagPool() {
      return runtime.objects.tagPool;
    },
    getPagingQueue() {
      return runtime.objects.pagingQueue;
    },
    getPagingHistory() {
      return runtime.objects.pagingHistory;
    },
    getInternalLinks() {
      return runtime.objects.internalLinks;
    },
    getSettingsStore() {
      return runtime.settingsStore;
    },
    getDefaultArticleId,
    bindLinkDelegation
  };
}
