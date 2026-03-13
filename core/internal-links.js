function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createInternalLinks(options) {
  const subscribers = new Set();
  const state = {
    data: {
      meta: {},
      links: [],
      brokenLinks: [],
      inbound: {},
      outbound: {}
    }
  };

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep internal links resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    return cloneJson(state.data);
  }

  function loadFromMigration(data) {
    if (!data || typeof data !== "object") {
      return false;
    }
    const next = {
      meta: data.meta && typeof data.meta === "object" ? cloneJson(data.meta) : {},
      links: Array.isArray(data.links) ? cloneJson(data.links) : [],
      brokenLinks: Array.isArray(data.brokenLinks) ? cloneJson(data.brokenLinks) : [],
      inbound: data.inbound && typeof data.inbound === "object" ? cloneJson(data.inbound) : {},
      outbound: data.outbound && typeof data.outbound === "object" ? cloneJson(data.outbound) : {}
    };
    state.data = next;
    publish({ type: "load-from-migration" });
    return true;
  }

  function resolveAnchor(anchorLike) {
    if (!anchorLike || typeof anchorLike !== "object") {
      return null;
    }
    const href = typeof anchorLike.href === "string" ? anchorLike.href : "";
    const dataArticleId = typeof anchorLike.dataArticleId === "string" ? anchorLike.dataArticleId : "";
    if (dataArticleId) {
      return dataArticleId;
    }
    const match = href.match(/\/articles\/([^/?#]+)\.htm/i);
    return match ? match[1] : null;
  }

  function getOutbound(articleId) {
    const out = state.data.outbound && state.data.outbound[articleId];
    return Array.isArray(out) ? out.slice() : [];
  }

  function getInbound(articleId) {
    const input = state.data.inbound && state.data.inbound[articleId];
    return Array.isArray(input) ? input.slice() : [];
  }

  function getBrokenLinks() {
    return Array.isArray(state.data.brokenLinks) ? cloneJson(state.data.brokenLinks) : [];
  }

  function createSnapshot() {
    return readState();
  }

  function loadSnapshot(snapshot) {
    return loadFromMigration(snapshot);
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  if (options && options.data) {
    loadFromMigration(options.data);
  }

  return {
    loadFromMigration,
    resolveAnchor,
    getOutbound,
    getInbound,
    getBrokenLinks,
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState
  };
}
