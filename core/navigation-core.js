export function createNavigationCore(options) {
  const articleMap = options.articleMap;
  const state = {
    selectedArticleId: null,
    articleHistory: [],
    landingArticleId: options.landingArticleId || null
  };
  const subscribers = new Set();

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep navigation resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    return {
      selectedArticleId: state.selectedArticleId,
      articleHistory: state.articleHistory.slice(),
      landingArticleId: state.landingArticleId
    };
  }

  function openArticleById(articleId, opts) {
    if (!articleId || !articleMap.has(articleId)) {
      publish({ type: "open-failed", articleId });
      return false;
    }

    const isBackNavigation = Boolean(opts && opts.isBackNavigation);
    const previous = state.selectedArticleId;

    if (!isBackNavigation && previous && previous !== articleId) {
      state.articleHistory.unshift(previous);
      if (state.articleHistory.length > 20) {
        state.articleHistory.length = 20;
      }
    }

    state.selectedArticleId = articleId;
    publish({ type: "open", articleId, previous });
    return true;
  }

  function openHome() {
    if (!state.landingArticleId) {
      return false;
    }
    return openArticleById(state.landingArticleId);
  }

  function goBack() {
    if (!state.articleHistory.length) {
      publish({ type: "back-empty" });
      return false;
    }
    const previous = state.articleHistory.shift();
    return openArticleById(previous, { isBackNavigation: true });
  }

  function setLandingArticleId(articleId) {
    if (!articleId || !articleMap.has(articleId)) {
      return;
    }
    state.landingArticleId = articleId;
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  function resolveArticleIdFromAnchor(anchor) {
    const dataArticleId = anchor.getAttribute("data-article-id");
    if (dataArticleId && articleMap.has(dataArticleId)) {
      return dataArticleId;
    }

    const internalRef = anchor.getAttribute("internal-nav-ref");
    if (internalRef && internalRef.startsWith("resolved:")) {
      const resolvedId = internalRef.slice("resolved:".length).trim();
      if (resolvedId && articleMap.has(resolvedId)) {
        return resolvedId;
      }
    }

    const href = anchor.getAttribute("href") || "";
    const match = href.match(/\/articles\/([^/?#]+)\.htm/i);
    if (match && articleMap.has(match[1])) {
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
      openArticleById(targetId);
    };

    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }

  return {
    openArticleById,
    openHome,
    goBack,
    subscribe,
    readState,
    setLandingArticleId,
    bindArticleLinkDelegation
  };
}
