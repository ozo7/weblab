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

function flattenArticleOrder(topLevel, validArticleIds) {
  const ordered = [];
  const seen = new Set();

  function add(articleId) {
    if (typeof articleId !== "string" || seen.has(articleId)) {
      return;
    }
    if (validArticleIds && !validArticleIds.has(articleId)) {
      return;
    }
    seen.add(articleId);
    ordered.push(articleId);
  }

  function walk(entries) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      if (typeof entry.articleId === "string") {
        add(entry.articleId);
      }
      walk(entry.children);
    });
  }

  walk(topLevel);
  return ordered;
}

function invertTagMap(tagMap) {
  const articleTags = new Map();
  const source = tagMap && typeof tagMap === "object" ? tagMap : {};
  Object.keys(source).forEach((tag) => {
    const ids = Array.isArray(source[tag]) ? source[tag] : [];
    ids.forEach((articleId) => {
      if (typeof articleId !== "string") {
        return;
      }
      if (!articleTags.has(articleId)) {
        articleTags.set(articleId, []);
      }
      const tags = articleTags.get(articleId);
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    });
  });
  return articleTags;
}

export function createPagingQueue(options) {
  const topLevel = Array.isArray(options && options.topLevel) ? options.topLevel : [];
  const articleMap = options && options.articleMap instanceof Map ? options.articleMap : new Map();
  const tagPool = options && options.tagPool ? options.tagPool : null;
  const articleIdSet = new Set(articleMap.keys());
  const defaultQueue = flattenArticleOrder(topLevel, articleIdSet);
  const tagsByArticleId = invertTagMap(options && options.tagMap ? options.tagMap : {});
  const subscribers = new Set();
  const state = {
    queue: defaultQueue.slice()
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
      queue: state.queue.slice(),
      defaultQueue: defaultQueue.slice()
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

  function rebuildFromTags() {
    const selectedTags = tagPool && typeof tagPool.getSelectedTags === "function"
      ? tagPool.getSelectedTags()
      : [];
    const tags = new Set(selectedTags);
    if (!tags.size) {
      reset();
      return state.queue.slice();
    }
    const scored = defaultQueue
      .map((articleId) => {
        const articleTags = tagsByArticleId.get(articleId) || [];
        let score = 0;
        articleTags.forEach((tag) => {
          if (tags.has(tag)) {
            score += 1;
          }
        });
        return { articleId, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || defaultQueue.indexOf(a.articleId) - defaultQueue.indexOf(b.articleId))
      .map((entry) => entry.articleId);
    state.queue = normalizeQueue(scored);
    publish({ type: "rebuild-from-tags", selectedTags: Array.from(tags) });
    return state.queue.slice();
  }

  function clear() {
    state.queue = [];
    publish({ type: "clear" });
  }

  function reset() {
    state.queue = defaultQueue.slice();
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
    state.queue = normalizeQueue(snapshot.queue || defaultQueue);
    publish({ type: "load-snapshot" });
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  return {
    getQueue,
    getAround,
    addPage,
    removePage,
    togglePage,
    rebuildFromTags,
    clear,
    reset,
    createSnapshot,
    loadSnapshot,
    subscribe,
    readState
  };
}
