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
  const siteMap = options.siteMap;
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
    queue: queueCore.createSnapshot()
  };
  const session = settingsStore.getViewportSession("720", defaultSession);
  queueCore.loadSnapshot(session.queue);
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
    const tree = siteMap.getTreeModel(selectedArticleId);
    tree.forEach((node) => {
      if (node.type !== "menu" && node.type !== "article") {
        return;
      }
      const row = document.createElement("div");
      row.className = "wv720-tree-row " + (node.type === "menu" ? "is-menu" : "is-article");
      row.style.paddingLeft = String(node.depth * 12) + "px";

      if (node.type === "menu" && node.hasChildren) {
        const toggle = createButton(node.isExpanded ? "-" : "+", "wv720-tree-toggle", () => {
          siteMap.toggleNode(node.nodeId);
          renderTree();
          persistSession();
        });
        row.appendChild(toggle);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "wv720-tree-toggle-spacer";
        row.appendChild(spacer);
      }

      const label = node.type === "menu"
        ? (node.label && node.label.trim() ? node.label.trim() : "Section")
        : ((articleMap.get(node.articleId) && articleMap.get(node.articleId).title) || node.title || node.articleId);
      const canOpen = Boolean(node.isClickable && node.articleId);
      const title = createButton(
        label,
        "wv720-tree-main" + (canOpen && selectedArticleId === node.articleId ? " active" : ""),
        () => {
          if (node.type === "menu" && node.hasChildren && !node.isExpanded) {
            siteMap.toggleNode(node.nodeId);
          }
          if (canOpen) {
            const articleId = siteMap.openNode(node.nodeId);
            if (articleId) {
              openArticle(articleId);
            }
          }
          renderTree();
          persistSession();
        }
      );
      row.appendChild(title);

      if (canOpen) {
        const select = createButton(
          queueCore.isQueued(node.articleId) ? "●" : "○",
          "wv720-tree-queue-toggle",
          () => {
            queueCore.toggleSitemapSelection(node.articleId);
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
    });
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
