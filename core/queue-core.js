function uniqueStringList(values) {
  const seen = new Set();
  const output = [];
  (Array.isArray(values) ? values : []).forEach((value) => {
    if (typeof value !== "string" || seen.has(value)) {
      return;
    }
    seen.add(value);
    output.push(value);
  });
  return output;
}

function invertTagMap(tagMap) {
  const articleTags = new Map();
  const source = tagMap && typeof tagMap === "object" ? tagMap : {};
  Object.keys(source).forEach((tag) => {
    const articleIds = Array.isArray(source[tag]) ? source[tag] : [];
    articleIds.forEach((articleId) => {
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
  articleTags.forEach((tags) => tags.sort((a, b) => a.localeCompare(b)));
  return articleTags;
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

export function listAllTags(tagMap) {
  const source = tagMap && typeof tagMap === "object" ? tagMap : {};
  return Object.keys(source).sort((a, b) => a.localeCompare(b));
}

export function createQueueCore(options) {
  const topLevel = Array.isArray(options.topLevel) ? options.topLevel : [];
  const articleMap = options.articleMap instanceof Map ? options.articleMap : new Map();
  const tagsByArticleId = invertTagMap(options.tagMap || {});
  const articleIdSet = new Set(articleMap.keys());
  const allOrderedArticleIds = flattenArticleOrder(topLevel, articleIdSet);
  const allTags = listAllTags(options.tagMap || {});
  const allTagSet = new Set(allTags);

  const state = {
    selectedTags: new Set(),
    sitemapSelectedIds: new Set(),
    useDefaultQueue: true,
    nextQueue: []
  };

  function ensureValidSelection() {
    state.selectedTags = new Set(Array.from(state.selectedTags).filter((tag) => allTagSet.has(tag)));
    state.sitemapSelectedIds = new Set(Array.from(state.sitemapSelectedIds).filter((id) => articleIdSet.has(id)));
    state.nextQueue = state.nextQueue.filter((id, index, arr) => articleIdSet.has(id) && arr.indexOf(id) === index);
  }

  function sortByTagMatch(selectedTags) {
    const tags = Array.from(selectedTags);
    if (!tags.length) {
      return [];
    }
    return allOrderedArticleIds
      .map((articleId) => {
        const articleTags = tagsByArticleId.get(articleId) || [];
        let score = 0;
        tags.forEach((tag) => {
          if (articleTags.includes(tag)) {
            score += 1;
          }
        });
        return { articleId, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => (right.score - left.score))
      .map((entry) => entry.articleId);
  }

  function setQueueFromList(articleIds) {
    const unique = uniqueStringList(articleIds).filter((id) => articleIdSet.has(id));
    state.useDefaultQueue = false;
    state.nextQueue = unique;
    state.sitemapSelectedIds = new Set(unique);
  }

  function applyTags(tags) {
    const nextTags = uniqueStringList(tags).filter((tag) => allTagSet.has(tag));
    state.selectedTags = new Set(nextTags);
    if (!nextTags.length) {
      state.useDefaultQueue = true;
      state.nextQueue = [];
      state.sitemapSelectedIds = new Set();
      return;
    }
    state.useDefaultQueue = false;
    state.nextQueue = sortByTagMatch(nextTags);
    state.sitemapSelectedIds = new Set(state.nextQueue);
  }

  function getQueue() {
    if (state.useDefaultQueue) {
      return allOrderedArticleIds.slice();
    }
    return state.nextQueue.slice();
  }

  function toggleSitemapSelection(articleId) {
    if (!articleIdSet.has(articleId)) {
      return getQueue();
    }
    const next = new Set(state.useDefaultQueue ? [] : state.sitemapSelectedIds);
    if (next.has(articleId)) {
      next.delete(articleId);
    } else {
      next.add(articleId);
    }
    setQueueFromList(Array.from(next));
    return getQueue();
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    state.selectedTags = new Set(uniqueStringList(snapshot.selectedTags || []));
    state.sitemapSelectedIds = new Set(uniqueStringList(snapshot.sitemapSelectedIds || []));
    state.useDefaultQueue = snapshot.useDefaultQueue !== false;
    state.nextQueue = uniqueStringList(snapshot.nextQueue || []);
    ensureValidSelection();
    if (state.useDefaultQueue) {
      state.nextQueue = [];
      state.sitemapSelectedIds = new Set();
    }
  }

  function createSnapshot() {
    return {
      selectedTags: Array.from(state.selectedTags),
      sitemapSelectedIds: Array.from(state.sitemapSelectedIds),
      useDefaultQueue: state.useDefaultQueue,
      nextQueue: state.nextQueue.slice()
    };
  }

  ensureValidSelection();

  return {
    allTags: allTags.slice(),
    allArticleIds: allOrderedArticleIds.slice(),
    getQueue,
    getSelectedTags() {
      return Array.from(state.selectedTags);
    },
    isQueued(articleId) {
      return getQueue().includes(articleId);
    },
    toggleTag(tag) {
      const next = new Set(state.selectedTags);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      applyTags(Array.from(next));
      return getQueue();
    },
    clearTags() {
      applyTags([]);
      return getQueue();
    },
    toggleSitemapSelection,
    loadSnapshot,
    createSnapshot
  };
}
