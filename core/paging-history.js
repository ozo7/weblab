function uniqueStringList(values) {
  const seen = new Set();
  const out = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    if (typeof value !== "string" || seen.has(value)) {
      return;
    }
    seen.add(value);
    out.push(value);
  });
  return out;
}

export function createPagingHistory(options) {
  const max = Number(options && options.max) > 0 ? Number(options.max) : 20;
  const subscribers = new Set();
  const state = {
    entries: []
  };

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep history resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    return {
      entries: state.entries.slice(),
      max
    };
  }

  function recordOpen(articleId, opts) {
    if (typeof articleId !== "string" || !articleId) {
      return false;
    }
    const fromArticleId = opts && typeof opts.fromArticleId === "string" ? opts.fromArticleId : null;
    const isBackNavigation = Boolean(opts && opts.isBackNavigation);
    if (isBackNavigation || !fromArticleId || fromArticleId === articleId) {
      return false;
    }
    state.entries.unshift(fromArticleId);
    if (state.entries.length > max) {
      state.entries.length = max;
    }
    publish({ type: "record-open", articleId, fromArticleId });
    return true;
  }

  function canGoBack() {
    return state.entries.length > 0;
  }

  function goBack() {
    if (!state.entries.length) {
      publish({ type: "back-empty" });
      return null;
    }
    const previous = state.entries.shift();
    publish({ type: "go-back", articleId: previous });
    return previous;
  }

  function peekBack() {
    return state.entries.length ? state.entries[0] : null;
  }

  function clear() {
    if (!state.entries.length) {
      return;
    }
    state.entries = [];
    publish({ type: "clear" });
  }

  function createSnapshot() {
    return {
      entries: state.entries.slice(),
      max
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.entries = uniqueStringList(snapshot.entries || []).slice(0, max);
    publish({ type: "load-snapshot" });
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return {
    recordOpen,
    canGoBack,
    goBack,
    peekBack,
    clear,
    getEntries() {
      return state.entries.slice();
    },
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState
  };
}
