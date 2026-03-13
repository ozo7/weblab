import { createQueueCore } from "../core/queue-core.js";

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function uniqueArticleOrder(topLevel, articleMap) {
  const ids = [];
  const seen = new Set();
  function walk(entries) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      if (typeof entry.articleId === "string" && articleMap.has(entry.articleId) && !seen.has(entry.articleId)) {
        seen.add(entry.articleId);
        ids.push(entry.articleId);
      }
      walk(entry.children);
    });
  }
  walk(topLevel);
  return ids;
}

function getMenuKey(entry, path) {
  if (typeof entry.articleId === "string" && entry.articleId.trim()) {
    return "menu:article:" + entry.articleId + ":" + path.join(".");
  }
  return "menu:path:" + path.join(".");
}

function getQueueAround(queueIds, currentId) {
  const index = queueIds.indexOf(currentId);
  return {
    previousId: index > 0 ? queueIds[index - 1] : null,
    nextId: index >= 0 && index < queueIds.length - 1 ? queueIds[index + 1] : null
  };
}

export function createViewport720(options) {
  const host = options.host;
  const navigation = options.navigation;
  const settingsStore = options.settingsStore;
  const websiteTopLevel = Array.isArray(options.websiteTopLevel) ? options.websiteTopLevel : [];
  const articleMap = options.articleMap instanceof Map ? options.articleMap : new Map();
  const tagMap = options.tagMap && typeof options.tagMap === "object" ? options.tagMap : {};
  const homeArticleId = options.homeArticleId || null;
  const allArticleIds = uniqueArticleOrder(websiteTopLevel, articleMap);

  const queueCore = createQueueCore({
    topLevel: websiteTopLevel,
    articleMap,
    tagMap
  });

  const fallbackArticleId = homeArticleId && articleMap.has(homeArticleId)
    ? homeArticleId
    : (allArticleIds[0] || null);

  const defaultSession = {
    railOpen: true,
    currentArticleId: fallbackArticleId,
    expandedMenuKeys: [],
    queue: queueCore.createSnapshot()
  };
  const session = settingsStore.getViewportSession("720", defaultSession);
  queueCore.loadSnapshot(session.queue);
  const expandedMenuKeys = new Set(Array.isArray(session.expandedMenuKeys) ? session.expandedMenuKeys : []);
  let railOpen = session.railOpen !== false;

  host.innerHTML = [
    '<div class="wv720-shell" data-rail="closed">',
    '  <section class="wv720-content-host">',
    '    <div class="wv720-toolbar">',
    '      <button type="button" class="wv720-toolbar-btn" data-action="back" aria-label="Back">←</button>',
    '      <button type="button" class="wv720-toolbar-btn" data-action="home" aria-label="Home">⌂ Home</button>',
    '      <button type="button" class="wv720-toolbar-btn" data-action="prev" aria-label="Previous page">Prev</button>',
    '      <button type="button" class="wv720-toolbar-btn" data-action="next" aria-label="Next page">Next</button>',
    '      <button type="button" class="wv720-toolbar-btn wv720-rail-open-btn" data-action="open-rail" aria-label="Open navigation">☰</button>',
    "    </div>",
    '    <main id="pane2main"></main>',
    "  </section>",
    '  <button type="button" class="wv720-rail-edge" aria-label="Toggle navigation">☰</button>',
    '  <button type="button" class="wv720-scrim" aria-label="Close navigation"></button>',
    '  <aside class="wv720-rail" aria-label="Navigation and queue">',
    '    <div class="wv720-rail-head">',
    '      <div class="wv720-rail-title">Pages</div>',
    '      <button type="button" class="wv720-rail-close" aria-label="Close navigation">×</button>',
    "    </div>",
    '    <div class="wv720-tags" data-role="tags"></div>',
    '    <div class="wv720-queue" data-role="queue"></div>',
    '    <div class="wv720-tree" data-role="tree"></div>',
    "  </aside>",
    "</div>"
  ].join("\n");

  const shell = host.querySelector(".wv720-shell");
  const pane = host.querySelector("#pane2main");
  const treeContainer = host.querySelector('[data-role="tree"]');
  const tagsContainer = host.querySelector('[data-role="tags"]');
  const queueContainer = host.querySelector('[data-role="queue"]');
  const edgeButton = host.querySelector(".wv720-rail-edge");
  const scrim = host.querySelector(".wv720-scrim");
  const railCloseButton = host.querySelector(".wv720-rail-close");
  const backButton = host.querySelector('[data-action="back"]');
  const homeButton = host.querySelector('[data-action="home"]');
  const prevButton = host.querySelector('[data-action="prev"]');
  const nextButton = host.querySelector('[data-action="next"]');
  const openRailButton = host.querySelector('[data-action="open-rail"]');

  function persistSession() {
    settingsStore.setViewportSession("720", {
      railOpen,
      currentArticleId: navigation.readState().selectedArticleId || fallbackArticleId,
      expandedMenuKeys: Array.from(expandedMenuKeys),
      queue: queueCore.createSnapshot()
    });
    settingsStore.schedulePersist(120);
  }

  function setRailOpen(open) {
    railOpen = Boolean(open);
    shell.dataset.rail = railOpen ? "open" : "closed";
    persistSession();
  }

  function openArticle(articleId) {
    if (!articleId || !articleMap.has(articleId)) {
      return;
    }
    navigation.openArticleById(articleId);
  }

  function renderTags() {
    tagsContainer.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "wv720-tags-wrap";
    const selected = new Set(queueCore.getSelectedTags());
    queueCore.allTags.forEach((tag) => {
      const chip = createButton(tag, "wv720-tag-chip" + (selected.has(tag) ? " active" : ""), () => {
        queueCore.toggleTag(tag);
        renderAll();
        persistSession();
      });
      wrap.appendChild(chip);
    });
    const clear = createButton("Clear tags", "wv720-clear-btn", () => {
      queueCore.clearTags();
      renderAll();
      persistSession();
    });
    tagsContainer.appendChild(wrap);
    tagsContainer.appendChild(clear);
  }

  function renderQueue() {
    const queue = queueCore.getQueue();
    const runtime = navigation.readState();
    const around = getQueueAround(queue, runtime.selectedArticleId);

    queueContainer.innerHTML = "";
    const summary = document.createElement("div");
    summary.className = "wv720-queue-summary";
    summary.textContent = "Queue: " + queue.length + " / " + allArticleIds.length;
    queueContainer.appendChild(summary);

    const list = document.createElement("div");
    list.className = "wv720-queue-list";
    queue.slice(0, 8).forEach((articleId, index) => {
      const article = articleMap.get(articleId);
      if (!article) {
        return;
      }
      const item = createButton(
        String(index + 1) + ". " + article.title,
        "wv720-queue-item" + (runtime.selectedArticleId === articleId ? " active" : ""),
        () => openArticle(articleId)
      );
      list.appendChild(item);
    });
    queueContainer.appendChild(list);

    prevButton.disabled = !around.previousId;
    nextButton.disabled = !around.nextId;
  }

  function renderTree() {
    const selectedArticleId = navigation.readState().selectedArticleId;
    treeContainer.innerHTML = "";

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
          const canOpen = typeof entry.articleId === "string" && articleMap.has(entry.articleId);
          const expanded = hasChildren && expandedMenuKeys.has(menuKey);

          const row = document.createElement("div");
          row.className = "wv720-tree-row is-menu";
          row.style.paddingLeft = String(depth * 12) + "px";

          if (hasChildren) {
            const toggle = createButton(expanded ? "-" : "+", "wv720-tree-toggle", () => {
              if (expandedMenuKeys.has(menuKey)) {
                expandedMenuKeys.delete(menuKey);
              } else {
                expandedMenuKeys.add(menuKey);
              }
              renderTree();
              persistSession();
            });
            row.appendChild(toggle);
          } else {
            const spacer = document.createElement("span");
            spacer.className = "wv720-tree-toggle-spacer";
            row.appendChild(spacer);
          }

          const title = createButton(
            typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "Section",
            "wv720-tree-main" + (canOpen && selectedArticleId === entry.articleId ? " active" : ""),
            () => {
              if (hasChildren) {
                expandedMenuKeys.add(menuKey);
              }
              if (canOpen) {
                openArticle(entry.articleId);
              }
              renderTree();
              persistSession();
            }
          );
          row.appendChild(title);

          if (canOpen) {
            const select = createButton(
              queueCore.isQueued(entry.articleId) ? "●" : "○",
              "wv720-tree-queue-toggle",
              () => {
                queueCore.toggleSitemapSelection(entry.articleId);
                renderAll();
                persistSession();
              }
            );
            row.appendChild(select);
          } else {
            const spacer = document.createElement("span");
            spacer.className = "wv720-tree-queue-spacer";
            row.appendChild(spacer);
          }

          treeContainer.appendChild(row);
          if (expanded) {
            renderEntries(entry.children, depth + 1, nextPath);
          }
          return;
        }

        if (entry.type === "article" && typeof entry.articleId === "string" && articleMap.has(entry.articleId)) {
          const row = document.createElement("div");
          row.className = "wv720-tree-row is-article";
          row.style.paddingLeft = String(depth * 12) + "px";

          const spacer = document.createElement("span");
          spacer.className = "wv720-tree-toggle-spacer";
          row.appendChild(spacer);

          const article = articleMap.get(entry.articleId);
          const title = createButton(
            article.title,
            "wv720-tree-main" + (selectedArticleId === entry.articleId ? " active" : ""),
            () => openArticle(entry.articleId)
          );
          row.appendChild(title);

          const select = createButton(
            queueCore.isQueued(entry.articleId) ? "●" : "○",
            "wv720-tree-queue-toggle",
            () => {
              queueCore.toggleSitemapSelection(entry.articleId);
              renderAll();
              persistSession();
            }
          );
          row.appendChild(select);

          treeContainer.appendChild(row);
        }
      });
    }

    renderEntries(websiteTopLevel, 0, []);
  }

  function renderAll() {
    renderTags();
    renderQueue();
    renderTree();
  }

  const unsubscribe = navigation.subscribe((event) => {
    if (event.type !== "open" && event.type !== "back-empty") {
      return;
    }
    renderAll();
    persistSession();
  });

  backButton.addEventListener("click", () => navigation.goBack());
  homeButton.addEventListener("click", () => {
    if (homeArticleId && articleMap.has(homeArticleId)) {
      openArticle(homeArticleId);
    } else {
      navigation.openHome();
    }
  });
  prevButton.addEventListener("click", () => {
    const queue = queueCore.getQueue();
    const currentId = navigation.readState().selectedArticleId;
    const around = getQueueAround(queue, currentId);
    if (around.previousId) {
      openArticle(around.previousId);
    }
  });
  nextButton.addEventListener("click", () => {
    const queue = queueCore.getQueue();
    const currentId = navigation.readState().selectedArticleId;
    const around = getQueueAround(queue, currentId);
    if (around.nextId) {
      openArticle(around.nextId);
    }
  });
  openRailButton.addEventListener("click", () => setRailOpen(true));
  edgeButton.addEventListener("click", () => setRailOpen(!railOpen));
  scrim.addEventListener("click", () => setRailOpen(false));
  railCloseButton.addEventListener("click", () => setRailOpen(false));

  const onKeyDown = (event) => {
    if (event.key === "Escape" && railOpen) {
      setRailOpen(false);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  setRailOpen(railOpen);
  renderAll();

  const startupArticleId = session.currentArticleId && articleMap.has(session.currentArticleId)
    ? session.currentArticleId
    : fallbackArticleId;
  if (startupArticleId && !navigation.readState().selectedArticleId) {
    openArticle(startupArticleId);
  }

  return {
    key: "720",
    articlePane: pane,
    teardown() {
      unsubscribe();
      window.removeEventListener("keydown", onKeyDown);
      host.innerHTML = "";
    }
  };
}
