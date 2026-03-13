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

export function createPagingQueue(options) {
  const articleMap = options && options.articleMap instanceof Map ? options.articleMap : new Map();
  const articleIdSet = new Set(articleMap.keys());
  const subscribers = new Set();
  const state = {
    queue: []
  };

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep queue resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    return {
      queue: state.queue.slice()
    };
  }

  function normalizeQueue(queue) {
    return uniqueStringList(queue).filter((id) => articleIdSet.has(id));
  }

  function getQueue() {
    return state.queue.slice();
  }

  function getAround(articleId) {
    const idx = state.queue.indexOf(articleId);
    return {
      previousId: idx > 0 ? state.queue[idx - 1] : null,
      nextId: idx >= 0 && idx < state.queue.length - 1 ? state.queue[idx + 1] : null
    };
  }

  function addPage(articleId, position) {
    if (!articleIdSet.has(articleId)) {
      return false;
    }
    state.queue = state.queue.filter((id) => id !== articleId);
    const place = position === "front" || position === "second" || position === "end" ? position : "end";
    if (place === "front") {
      state.queue.unshift(articleId);
    } else if (place === "second") {
      const first = state.queue.shift();
      if (first) {
        state.queue.unshift(first);
        state.queue.splice(1, 0, articleId);
      } else {
        state.queue.unshift(articleId);
      }
    } else {
      state.queue.push(articleId);
    }
    publish({ type: "add-page", articleId, position: place });
    return true;
  }

  function removePage(articleId) {
    const before = state.queue.length;
    state.queue = state.queue.filter((id) => id !== articleId);
    if (state.queue.length === before) {
      return false;
    }
    publish({ type: "remove-page", articleId });
    return true;
  }

  function togglePage(articleId) {
    if (state.queue.includes(articleId)) {
      return removePage(articleId);
    }
    return addPage(articleId, "end");
  }

  function setPages(pageIds, options) {
    const requested = normalizeQueue(pageIds);
    const allowReorder = !options || options.allowReorder !== false;
    if (allowReorder) {
      state.queue = requested;
      publish({ type: "set-pages", allowReorder: true });
      return state.queue.slice();
    }

    const requestedSet = new Set(requested);
    const nextQueue = state.queue.filter((articleId) => requestedSet.has(articleId));
    const present = new Set(nextQueue);
    requested.forEach((articleId) => {
      if (!present.has(articleId)) {
        nextQueue.push(articleId);
        present.add(articleId);
      }
    });
    state.queue = nextQueue;
    publish({ type: "set-pages", allowReorder: false });
    return state.queue.slice();
  }

  function clear() {
    state.queue = [];
    publish({ type: "clear" });
  }

  function reset() {
    state.queue = [];
    publish({ type: "reset" });
  }

  function createSnapshot() {
    return {
      queue: state.queue.slice()
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.queue = Array.isArray(snapshot.queue)
      ? normalizeQueue(snapshot.queue)
      : [];
    publish({ type: "load-snapshot" });
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return {
    getQueue,
    getAround,
    setPages,
    addPage,
    removePage,
    togglePage,
    clear,
    reset,
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState
  };
}
