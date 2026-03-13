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
    selectedArticleId: null,
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
      selectedArticleId: state.selectedArticleId,
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
    const targetSelected = isValidArticleId(articleMap, selectedArticleId)
      ? selectedArticleId
      : (isValidArticleId(articleMap, state.selectedArticleId) ? state.selectedArticleId : null);
    if (targetSelected) {
      ensureExpandedForArticle(targetSelected);
      state.selectedArticleId = targetSelected;
    }

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
          isActive: canOpen && targetSelected === articleId
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
    publish({ type: "expand-path", articleId });
    return true;
  }

  function openNode(nodeId) {
    const articleId = state.articleIdByNodeId.get(nodeId) || null;
    if (!isValidArticleId(articleMap, articleId)) {
      return null;
    }
    state.selectedArticleId = articleId;
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
    state.selectedArticleId = articleId;
    ensureExpandedForArticle(articleId);
    publish({ type: "set-selected", articleId });
    return true;
  }

  function getSelectedArticle() {
    return state.selectedArticleId;
  }

  function subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
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
    getSelectedArticle,
    subscribe,
    readState
  };
}
