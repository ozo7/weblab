import { createPagingHistory } from "./paging-history.js";

function isValidArticleId(articleMap, articleId) {
  return typeof articleId === "string" && articleMap.has(articleId);
}

export function createNavigationObject(options) {
  const articleMap = options && options.articleMap instanceof Map ? options.articleMap : new Map();
  const history = options && options.pagingHistory ? options.pagingHistory : createPagingHistory({ max: 20 });
  const subscribers = new Set();
  const state = {
    selectedArticleId: null,
    landingArticleId: isValidArticleId(articleMap, options && options.landingArticleId) ? options.landingArticleId : null
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
    return {
      selectedArticleId: state.selectedArticleId,
      landingArticleId: state.landingArticleId,
      history: history.getEntries()
    };
  }

  function openArticle(articleId, opts) {
    if (!isValidArticleId(articleMap, articleId)) {
      publish({ type: "open-failed", articleId });
      return false;
    }
    const previous = state.selectedArticleId;
    history.recordOpen(articleId, {
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

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  function createSnapshot() {
    return {
      selectedArticleId: state.selectedArticleId,
      landingArticleId: state.landingArticleId
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
    publish({ type: "load-snapshot" });
  }

  return {
    setLandingArticleId,
    getLandingArticleId,
    openArticle,
    openHome,
    getSelectedArticleId,
    subscribe,
    createSnapshot,
    loadSnapshot,
    readState,
    history
  };
}
