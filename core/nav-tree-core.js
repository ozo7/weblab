function isValidArticleId(articleMap, articleId) {
  return typeof articleId === "string" && articleMap.has(articleId);
}

function getMenuKey(entry, path) {
  if (typeof entry.articleId === "string" && entry.articleId.trim()) {
    return "menu:article:" + entry.articleId.trim() + ":" + path.join(".");
  }
  return "menu:path:" + path.join(".");
}

export function createNavigationTreeCore(options) {
  const articleMap = options.articleMap;
  const topLevel = Array.isArray(options.topLevel) ? options.topLevel : [];
  const expandedMenuKeys = new Set();
  const ancestorMenusByArticleId = new Map();
  let lastSyncedArticleId = null;

  function indexTree(entries, ancestorMenuKeys, path) {
    if (!Array.isArray(entries)) {
      return;
    }

    entries.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return;
      }

      const nextPath = path.concat(index);

      if (entry.type === "menu") {
        const menuKey = getMenuKey(entry, nextPath);
        const nextAncestors = ancestorMenuKeys.concat(menuKey);

        if (isValidArticleId(articleMap, entry.articleId)) {
          ancestorMenusByArticleId.set(entry.articleId, nextAncestors.slice());
        }

        indexTree(entry.children, nextAncestors, nextPath);
        return;
      }

      if (entry.type === "article" && isValidArticleId(articleMap, entry.articleId)) {
        ancestorMenusByArticleId.set(entry.articleId, ancestorMenuKeys.slice());
      }
    });
  }

  function ensureExpandedForArticle(articleId) {
    const ancestors = ancestorMenusByArticleId.get(articleId);
    if (!ancestors) {
      return;
    }
    ancestors.forEach((key) => expandedMenuKeys.add(key));
  }

  function isExpanded(menuKey) {
    return expandedMenuKeys.has(menuKey);
  }

  function toggleExpanded(menuKey) {
    if (expandedMenuKeys.has(menuKey)) {
      expandedMenuKeys.delete(menuKey);
      return false;
    }
    expandedMenuKeys.add(menuKey);
    return true;
  }

  indexTree(topLevel, [], []);

  return {
    render(container, options) {
      const selectedArticleId = options.selectedArticleId || null;
      const renderMenu = options.renderMenu;
      const renderArticle = options.renderArticle;

      if (!container || typeof renderMenu !== "function" || typeof renderArticle !== "function") {
        return;
      }

      if (selectedArticleId && selectedArticleId !== lastSyncedArticleId) {
        ensureExpandedForArticle(selectedArticleId);
        lastSyncedArticleId = selectedArticleId;
      }
      container.innerHTML = "";

      function renderEntries(entries, depth, path) {
        if (!Array.isArray(entries)) {
          return;
        }

        entries.forEach((entry, index) => {
          if (!entry || typeof entry !== "object") {
            return;
          }

          const nextPath = path.concat(index);

          if (entry.type === "menu") {
            const menuKey = getMenuKey(entry, nextPath);
            const hasChildren = Array.isArray(entry.children) && entry.children.length > 0;
            const canOpenArticle = isValidArticleId(articleMap, entry.articleId);
            const active = canOpenArticle && selectedArticleId === entry.articleId;
            const expanded = hasChildren ? isExpanded(menuKey) : false;

            const node = renderMenu({
              entry,
              depth,
              key: menuKey,
              hasChildren,
              expanded,
              canOpenArticle,
              active,
              onToggle() {
                toggleExpanded(menuKey);
              },
              onOpen() {
                if (!canOpenArticle) {
                  return;
                }
                ensureExpandedForArticle(entry.articleId);
                options.onOpenArticle(entry.articleId);
              }
            });

            if (node) {
              container.appendChild(node);
            }

            if (hasChildren && isExpanded(menuKey)) {
              renderEntries(entry.children, depth + 1, nextPath);
            }
            return;
          }

          if (entry.type === "article" && isValidArticleId(articleMap, entry.articleId)) {
            const node = renderArticle({
              entry,
              depth,
              active: selectedArticleId === entry.articleId,
              onOpen() {
                options.onOpenArticle(entry.articleId);
              }
            });
            if (node) {
              container.appendChild(node);
            }
          }
        });
      }

      renderEntries(topLevel, 0, []);
    }
  };
}
