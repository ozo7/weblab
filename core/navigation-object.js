function isValidArticleId(articleMap, articleId) {
  return typeof articleId === "string" && articleMap.has(articleId);
}

export function createNavigationObject(options) {
  const articleMap = options && options.articleMap instanceof Map ? options.articleMap : new Map();
  const navigationHistoryMax = Number(options && options.navigationHistoryMax) > 0
    ? Number(options.navigationHistoryMax)
    : 20;
  const subscribers = new Set();
  const state = {
    selectedArticleId: null,
    landingArticleId: isValidArticleId(articleMap, options && options.landingArticleId) ? options.landingArticleId : null,
    expandedNodeIds: new Set(),
    navigationHistoryEntries: [],
    navArea: "menus"
  };

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep navigation object resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    const historyList = state.navigationHistoryEntries.slice();
    return {
      selectedArticleId: state.selectedArticleId,
      landingArticleId: state.landingArticleId,
      navigationHistory: historyList,
      expandedNodeIds: Array.from(state.expandedNodeIds),
      navArea: state.navArea
    };
  }

  function setNavArea(area) {
    const normalized = area === "queue" ? "tags" : area;
    const next = normalized === "tags" || normalized === "history" || normalized === "menus" || normalized === "configuration"
      ? normalized
      : "menus";
    if (state.navArea === next) {
      return next;
    }
    state.navArea = next;
    publish({ type: "set-nav-area", navArea: next });
    return next;
  }

  function getNavArea() {
    return state.navArea;
  }

  function recordHistoryOpen(articleId, opts) {
    const fromArticleId = opts && typeof opts.fromArticleId === "string" ? opts.fromArticleId : null;
    const isBackNavigation = Boolean(opts && opts.isBackNavigation);
    if (isBackNavigation || !fromArticleId || fromArticleId === articleId) {
      return false;
    }
    state.navigationHistoryEntries.unshift(fromArticleId);
    if (state.navigationHistoryEntries.length > navigationHistoryMax) {
      state.navigationHistoryEntries.length = navigationHistoryMax;
    }
    publish({ type: "navigation-history-record-open", articleId, fromArticleId });
    return true;
  }

  function openArticle(articleId, opts) {
    if (!isValidArticleId(articleMap, articleId)) {
      publish({ type: "open-failed", articleId });
      return false;
    }
    const previous = state.selectedArticleId;
    recordHistoryOpen(articleId, {
      fromArticleId: previous,
      isBackNavigation: Boolean(opts && opts.isBackNavigation)
    });
    state.selectedArticleId = articleId;
    publish({ type: "open", articleId, previous });
    return true;
  }

  function openHome() {
    if (!state.landingArticleId) {
      return false;
    }
    return openArticle(state.landingArticleId);
  }

  function setLandingArticleId(articleId) {
    if (!isValidArticleId(articleMap, articleId)) {
      return false;
    }
    state.landingArticleId = articleId;
    publish({ type: "set-landing", articleId });
    return true;
  }

  function getLandingArticleId() {
    return state.landingArticleId;
  }

  function getSelectedArticleId() {
    return state.selectedArticleId;
  }

  function canGoBack() {
    return state.navigationHistoryEntries.length > 0;
  }

  function goBack() {
    if (!state.navigationHistoryEntries.length) {
      publish({ type: "navigation-history-back-empty" });
      publish({ type: "back-empty" });
      return false;
    }
    const previous = state.navigationHistoryEntries.shift();
    if (!previous) {
      publish({ type: "back-empty" });
      return false;
    }
    publish({ type: "navigation-history-go-back", articleId: previous });
    return openArticle(previous, { isBackNavigation: true });
  }

  function getNavigationHistory() {
    return state.navigationHistoryEntries.slice();
  }

  function getNavigationHistoryState() {
    return {
      entries: state.navigationHistoryEntries.slice(),
      max: navigationHistoryMax
    };
  }

  function setCurrentArticleId(articleId) {
    if (!isValidArticleId(articleMap, articleId)) {
      return false;
    }
    const previous = state.selectedArticleId;
    state.selectedArticleId = articleId;
    publish({ type: "set-current", articleId, previous });
    return true;
  }

  function setExpandedNodeIds(nodeIds) {
    const next = new Set();
    (Array.isArray(nodeIds) ? nodeIds : []).forEach((nodeId) => {
      if (typeof nodeId === "string" && nodeId) {
        next.add(nodeId);
      }
    });
    state.expandedNodeIds = next;
    publish({ type: "set-expanded-nodes", expandedNodeIds: Array.from(next) });
    return Array.from(next);
  }

  function toggleExpandedNode(nodeId) {
    if (typeof nodeId !== "string" || !nodeId) {
      return false;
    }
    if (state.expandedNodeIds.has(nodeId)) {
      state.expandedNodeIds.delete(nodeId);
      publish({ type: "toggle-expanded-node", nodeId, expanded: false });
      return false;
    }
    state.expandedNodeIds.add(nodeId);
    publish({ type: "toggle-expanded-node", nodeId, expanded: true });
    return true;
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  function resolveArticleIdFromAnchor(anchor) {
    const dataArticleId = anchor.getAttribute("data-article-id");
    if (isValidArticleId(articleMap, dataArticleId)) {
      return dataArticleId;
    }

    const internalRef = anchor.getAttribute("internal-nav-ref");
    if (internalRef && internalRef.startsWith("resolved:")) {
      const resolvedId = internalRef.slice("resolved:".length).trim();
      if (isValidArticleId(articleMap, resolvedId)) {
        return resolvedId;
      }
    }

    const href = anchor.getAttribute("href") || "";
    const match = href.match(/\/articles\/([^/?#]+)\.htm/i);
    if (match && isValidArticleId(articleMap, match[1])) {
      return match[1];
    }

    return null;
  }

  function bindArticleLinkDelegation(container) {
    if (!container || typeof container.addEventListener !== "function") {
      return () => {};
    }

    const handler = (event) => {
      const anchor = event.target && event.target.closest
        ? event.target.closest("a[data-article-id], a[internal-nav-ref], a[href]")
        : null;
      if (!anchor) {
        return;
      }
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const targetId = resolveArticleIdFromAnchor(anchor);
      if (!targetId) {
        return;
      }
      event.preventDefault();
      openArticle(targetId);
    };

    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }

  function createSnapshot() {
    return {
      selectedArticleId: state.selectedArticleId,
      landingArticleId: state.landingArticleId,
      expandedNodeIds: Array.from(state.expandedNodeIds),
      navArea: state.navArea,
      navigationHistory: {
        entries: state.navigationHistoryEntries.slice(),
        max: navigationHistoryMax
      }
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    if (isValidArticleId(articleMap, snapshot.landingArticleId)) {
      state.landingArticleId = snapshot.landingArticleId;
    }
    if (isValidArticleId(articleMap, snapshot.selectedArticleId)) {
      state.selectedArticleId = snapshot.selectedArticleId;
    }
    state.expandedNodeIds = new Set(
      (Array.isArray(snapshot.expandedNodeIds) ? snapshot.expandedNodeIds : [])
        .filter((id) => typeof id === "string" && id)
    );
    setNavArea(snapshot.navArea);
    const historySnapshot = snapshot.navigationHistory;
    const entries = historySnapshot && Array.isArray(historySnapshot.entries) ? historySnapshot.entries : [];
    state.navigationHistoryEntries = entries
      .filter((id, index, arr) => typeof id === "string" && id && arr.indexOf(id) === index)
      .slice(0, navigationHistoryMax);
    publish({ type: "load-snapshot" });
  }

  return {
    setLandingArticleId,
    getLandingArticleId,
    openArticleById: openArticle,
    openArticle,
    openHome,
    canGoBack,
    goBack,
    getSelectedArticleId,
    getNavigationHistory,
    getNavigationHistoryState,
    setNavArea,
    getNavArea,
    setCurrentArticleId,
    setExpandedNodeIds,
    toggleExpandedNode,
    bindArticleLinkDelegation,
    subscribe,
    createSnapshot,
    loadSnapshot,
    readState
  };
}
