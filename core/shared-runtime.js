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
import { createPagingQueue } from "./paging-queue.js";
import { createInternalLinks } from "./internal-links.js";
import { createSiteMap } from "./sitemap.js";
import { createSettingsStore } from "./settings-store.js";
import { createTagPool } from "./tag-pool.js";
import { createConfigurationObject } from "./configuration-object.js";

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

function normalizeHexColor(color) {
  if (typeof color !== "string") {
    return null;
  }
  const value = color.trim();
  const shortHex = value.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    const parts = shortHex[1].split("");
    return "#" + parts.map((part) => part + part).join("").toUpperCase();
  }
  const longHex = value.match(/^#([0-9a-f]{6})$/i);
  if (longHex) {
    return "#" + longHex[1].toUpperCase();
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",").slice(0, 3).map((part) => Number(part.trim()));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return null;
    }
    return "#" + parts.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return null;
}

function collectThemeColorCandidates() {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") {
    return [];
  }
  const selectors = ["body", "#appViewportHost", "#labViewportHost"];
  const props = ["backgroundColor", "color", "borderColor"];
  const out = [];
  selectors.forEach((selector) => {
    const node = document.querySelector(selector);
    if (!node) {
      return;
    }
    const style = getComputedStyle(node);
    props.forEach((prop) => {
      const raw = style[prop];
      const normalized = normalizeHexColor(raw);
      if (normalized) {
        out.push(normalized);
      }
    });
  });
  return out;
}

function derivePrevalentColor(candidates) {
  const values = Array.isArray(candidates) ? candidates : [];
  if (!values.length) {
    return "#F8FCF8";
  }
  const counts = new Map();
  values.forEach((value) => {
    const key = normalizeHexColor(value);
    if (!key) {
      return;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  if (!counts.size) {
    return "#F8FCF8";
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

export function createSharedRuntimeSession(options) {
  const runtimeState = createRuntimeState();
  const getActivePane = options && typeof options.getActivePane === "function"
    ? options.getActivePane
    : () => null;
  const useNavigationObject = Boolean(options && options.useNavigationObject);

  const runtime = {
    navigation: null,
    siteMap: null,
    objects: {
      navigation: null,
      tagPool: null,
      pagingQueue: null,
      internalLinks: null,
      configuration: null
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

  async function loadTagColorsConfig() {
    try {
      const config = await loadJson("/config/tag-colors.json");
      return Array.isArray(config && config.colors) ? config.colors : [];
    } catch (_) {
      return [];
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
      ["internalLinks", runtime.objects.internalLinks],
      ["configuration", runtime.objects.configuration]
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

  function wireArticleRendering(navigator) {
    if (!navigator || typeof navigator.subscribe !== "function") {
      return;
    }
    navigator.subscribe((event) => {
      if (event.type !== "open") {
        return;
      }
      if (typeof navigator.readState === "function") {
        const navState = navigator.readState();
        if (navState && navState.navArea === "configuration") {
          return;
        }
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
    runtime.objects.navigation = createNavigationObject({
      articleMap: runtimeState.articleMap,
      landingArticleId
    });
    runtime.objects.tagPool = createTagPool({
      tagMap: runtimeState.tags,
      articleOrder: flattenTopLevelArticleIds(runtimeState.website.topLevel),
      palette: await loadTagColorsConfig(),
      prevalentColor: derivePrevalentColor(collectThemeColorCandidates())
    });
    runtime.objects.pagingQueue = createPagingQueue({
      articleMap: runtimeState.articleMap
    });
    runtime.objects.internalLinks = createInternalLinks({
      data: await loadInternalLinksData(runtimeState.sourceFolder)
    });
    runtime.objects.configuration = createConfigurationObject({});

    const siteMapSnapshot = runtime.settingsStore.getObjectSnapshot("siteMap", runtime.siteMap.createSnapshot());
    runtime.siteMap.loadSnapshot(siteMapSnapshot);
    const navigationSnapshot = runtime.settingsStore.getObjectSnapshot("navigation", runtime.objects.navigation.createSnapshot());
    if (
      (!navigationSnapshot.navigationHistory || typeof navigationSnapshot.navigationHistory !== "object")
      && runtime.settingsStore.hasObjectSnapshot("pagingHistory")
    ) {
      navigationSnapshot.navigationHistory = runtime.settingsStore.getObjectSnapshot("pagingHistory", { entries: [], max: 20 });
    }
    runtime.objects.navigation.loadSnapshot(navigationSnapshot);
    runtime.objects.tagPool.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("tagPool", runtime.objects.tagPool.createSnapshot())
    );
    runtime.objects.pagingQueue.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("pagingQueue", runtime.objects.pagingQueue.createSnapshot())
    );
    runtime.objects.tagPool.bindPagingQueue(runtime.objects.pagingQueue, { syncNow: true });
    runtime.objects.internalLinks.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("internalLinks", runtime.objects.internalLinks.createSnapshot())
    );
    runtime.objects.configuration.loadSnapshot(
      runtime.settingsStore.getObjectSnapshot("configuration", runtime.objects.configuration.createSnapshot())
    );

    // Navigation object owns current navigation state for inspector/next migrations.
    const siteMapState = runtime.siteMap.readState();
    runtime.objects.navigation.setExpandedNodeIds(siteMapState.expandedNodeIds || []);

    runtime.navigation.subscribe((event) => {
      if (event.type !== "open") {
        return;
      }
      runtime.objects.navigation.openArticle(event.articleId);
    });

    runtime.siteMap.subscribe((event, stateSnapshot) => {
      runtime.objects.navigation.setExpandedNodeIds(stateSnapshot.expandedNodeIds || []);
    });

    wireArticleRendering(runtime.navigation);
    wireArticleRendering(runtime.objects.navigation);

    wireObjectPersistence();
  }

  function getDefaultArticleId() {
    const navigator = useNavigationObject ? runtime.objects.navigation : runtime.navigation;
    if (!navigator || !runtimeState.website) {
      return null;
    }
    const first = flattenTopLevelArticleIds(runtimeState.website.topLevel)[0];
    if (first) {
      return first;
    }
    return navigator.readState().landingArticleId || null;
  }

  function bindLinkDelegation(container, navigatorOverride) {
    const navigator = navigatorOverride || (useNavigationObject ? runtime.objects.navigation : runtime.navigation);
    if (!navigator || typeof navigator.bindArticleLinkDelegation !== "function") {
      return () => {};
    }
    return navigator.bindArticleLinkDelegation(container);
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
    getNavigationHistory() {
      return runtime.objects.navigation;
    },
    getInternalLinks() {
      return runtime.objects.internalLinks;
    },
    getConfiguration() {
      return runtime.objects.configuration;
    },
    getSettingsStore() {
      return runtime.settingsStore;
    },
    getDefaultArticleId,
    bindLinkDelegation
  };
}
