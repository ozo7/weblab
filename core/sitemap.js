function isValidArticleId(articleMap, articleId) {
  return typeof articleId === "string" && articleMap.has(articleId);
}

function makeNodeId(path) {
  return "node:" + path.join(".");
}

export function createSiteMap(options) {
  const articleMap = options.articleMap instanceof Map ? options.articleMap : new Map();
  const topLevel = Array.isArray(options.topLevel) ? options.topLevel : [];
  const state = {
    expandedNodeIds: new Set(),
    parentByNodeId: new Map(),
    nodeById: new Map(),
    articleIdByNodeId: new Map(),
    nodeIdByArticleId: new Map(),
    selectedArticleIDs: new Set(),
    landingArticleId: isValidArticleId(articleMap, options.landingArticleId) ? options.landingArticleId : null
  };
  const subscribers = new Set();

  function publish(event) {
    subscribers.forEach((subscriber) => {
      try {
        subscriber(event, readState());
      } catch (_) {
        // Keep sitemap resilient to one broken subscriber.
      }
    });
  }

  function readState() {
    return {
      selectedArticleIDs: Array.from(state.selectedArticleIDs),
      landingArticleId: state.landingArticleId,
      expandedNodeIds: Array.from(state.expandedNodeIds)
    };
  }

  function indexTree(entries, parentNodeId, path) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const nextPath = path.concat(index);
      const nodeId = makeNodeId(nextPath);
      state.nodeById.set(nodeId, {
        nodeId,
        path: nextPath.slice(),
        depth: nextPath.length - 1,
        type: entry.type,
        label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "",
        title: typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : "",
        articleId: typeof entry.articleId === "string" ? entry.articleId : null,
        hasChildren: Array.isArray(entry.children) && entry.children.length > 0
      });
      if (parentNodeId) {
        state.parentByNodeId.set(nodeId, parentNodeId);
      }
      if (typeof entry.articleId === "string" && entry.articleId.trim()) {
        state.articleIdByNodeId.set(nodeId, entry.articleId);
        if (!state.nodeIdByArticleId.has(entry.articleId)) {
          state.nodeIdByArticleId.set(entry.articleId, nodeId);
        }
      }
      indexTree(entry.children, nodeId, nextPath);
    });
  }

  function ensureExpandedForArticle(articleId) {
    const nodeId = state.nodeIdByArticleId.get(articleId);
    if (!nodeId) {
      return;
    }
    let current = state.parentByNodeId.get(nodeId);
    while (current) {
      state.expandedNodeIds.add(current);
      current = state.parentByNodeId.get(current);
    }
  }

  function getTreeModel(selectedArticleId) {
    const highlightedId = isValidArticleId(articleMap, selectedArticleId)
      ? selectedArticleId
      : null;
    const nodes = [];

    function walk(entries, depth, path) {
      if (!Array.isArray(entries)) {
        return;
      }
      entries.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const nextPath = path.concat(index);
        const nodeId = makeNodeId(nextPath);
        const model = state.nodeById.get(nodeId);
        if (!model) {
          return;
        }
        const articleId = model.articleId;
        const canOpen = isValidArticleId(articleMap, articleId);
        const isExpanded = model.hasChildren && state.expandedNodeIds.has(nodeId);
        nodes.push({
          nodeId,
          parentNodeId: state.parentByNodeId.get(nodeId) || null,
          depth,
          type: model.type,
          label: model.label,
          title: model.title,
          articleId,
          isClickable: canOpen,
          hasChildren: model.hasChildren,
          isExpanded,
          isActive: canOpen && highlightedId === articleId,
          isSelected: canOpen && state.selectedArticleIDs.has(articleId)
        });
        if (model.hasChildren && isExpanded) {
          walk(entry.children, depth + 1, nextPath);
        }
      });
    }

    walk(topLevel, 0, []);
    return nodes;
  }

  function toggleNode(nodeId) {
    const model = state.nodeById.get(nodeId);
    if (!model || !model.hasChildren) {
      return false;
    }
    let expanded;
    if (state.expandedNodeIds.has(nodeId)) {
      state.expandedNodeIds.delete(nodeId);
      expanded = false;
    } else {
      state.expandedNodeIds.add(nodeId);
      expanded = true;
    }
    publish({ type: "toggle", nodeId, expanded });
    return expanded;
  }

  function expandPathToArticle(articleId) {
    if (!isValidArticleId(articleMap, articleId)) {
      return false;
    }
    ensureExpandedForArticle(articleId);
    state.selectedArticleIDs.add(articleId);
    publish({ type: "expand-path", articleId });
    return true;
  }

  function openNode(nodeId) {
    const articleId = state.articleIdByNodeId.get(nodeId) || null;
    if (!isValidArticleId(articleMap, articleId)) {
      return null;
    }
    state.selectedArticleIDs.add(articleId);
    ensureExpandedForArticle(articleId);
    publish({ type: "open-node", nodeId, articleId });
    return articleId;
  }

  function nodeHasChildren(nodeId) {
    const model = state.nodeById.get(nodeId);
    return Boolean(model && model.hasChildren);
  }

  function getParent(nodeId) {
    return state.parentByNodeId.get(nodeId) || null;
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

  function setSelectedArticle(articleId) {
    if (!isValidArticleId(articleMap, articleId)) {
      return false;
    }
    state.selectedArticleIDs = new Set([articleId]);
    ensureExpandedForArticle(articleId);
    publish({ type: "set-selected", articleId });
    return true;
  }

  function setSelectedArticles(articleIds) {
    const next = new Set();
    (Array.isArray(articleIds) ? articleIds : []).forEach((articleId) => {
      if (isValidArticleId(articleMap, articleId)) {
        next.add(articleId);
        ensureExpandedForArticle(articleId);
      }
    });
    state.selectedArticleIDs = next;
    publish({ type: "set-selected-many", articleIds: Array.from(next) });
    return Array.from(next);
  }

  function addSelectedArticle(articleId) {
    if (!isValidArticleId(articleMap, articleId)) {
      return false;
    }
    state.selectedArticleIDs.add(articleId);
    ensureExpandedForArticle(articleId);
    publish({ type: "add-selected", articleId });
    return true;
  }

  function removeSelectedArticle(articleId) {
    if (!state.selectedArticleIDs.has(articleId)) {
      return false;
    }
    state.selectedArticleIDs.delete(articleId);
    publish({ type: "remove-selected", articleId });
    return true;
  }

  function clearSelectedArticles() {
    if (!state.selectedArticleIDs.size) {
      return;
    }
    state.selectedArticleIDs = new Set();
    publish({ type: "clear-selected" });
  }

  function getSelectedArticle() {
    const first = state.selectedArticleIDs.values().next();
    return first.done ? null : first.value;
  }

  function getSelectedArticles() {
    return Array.from(state.selectedArticleIDs);
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  }

  function createSnapshot() {
    return {
      selectedArticleIDs: Array.from(state.selectedArticleIDs),
      landingArticleId: state.landingArticleId,
      expandedNodeIds: Array.from(state.expandedNodeIds)
    };
  }

  function loadSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return;
    }
    const nextExpanded = Array.isArray(snapshot.expandedNodeIds) ? snapshot.expandedNodeIds : [];
    state.expandedNodeIds = new Set(nextExpanded.filter((id) => state.nodeById.has(id)));
    const selectedValues = Array.isArray(snapshot.selectedArticleIDs)
      ? snapshot.selectedArticleIDs
      : (Array.isArray(snapshot.selectedArticleIds)
        ? snapshot.selectedArticleIds
        : (isValidArticleId(articleMap, snapshot.selectedArticleId) ? [snapshot.selectedArticleId] : []));
    state.selectedArticleIDs = new Set();
    selectedValues.forEach((articleId) => {
      if (isValidArticleId(articleMap, articleId)) {
        state.selectedArticleIDs.add(articleId);
        ensureExpandedForArticle(articleId);
      }
    });
    if (isValidArticleId(articleMap, snapshot.landingArticleId)) {
      state.landingArticleId = snapshot.landingArticleId;
    }
    publish({ type: "load-snapshot" });
  }

  indexTree(topLevel, null, []);
  if (state.landingArticleId) {
    ensureExpandedForArticle(state.landingArticleId);
  }

  return {
    getTreeModel,
    toggleNode,
    expandPathToArticle,
    openNode,
    nodeHasChildren,
    getParent,
    setLandingArticleId,
    getLandingArticleId,
    setSelectedArticle,
    setSelectedArticles,
    addSelectedArticle,
    removeSelectedArticle,
    clearSelectedArticles,
    getSelectedArticle,
    getSelectedArticles,
    subscribe,
    createSnapshot,
    loadSnapshot,
    readState
  };
}
