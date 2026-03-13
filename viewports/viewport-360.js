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

export function createViewport360(options) {
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
    navOpen: false,
    activeScreen: null,
    tagsEnabled: false,
    tagChooserOpen: false,
    selectedArticleId: fallbackArticleId,
    expandedMenuKeys: [],
    queue: queueCore.createSnapshot()
  };
  const session = settingsStore.getViewportSession("360", defaultSession);
  queueCore.loadSnapshot(session.queue);
  const expandedMenuKeys = new Set(Array.isArray(session.expandedMenuKeys) ? session.expandedMenuKeys : []);
  let navOpen = true;
  let activeScreen = session.activeScreen === "sitemap" || session.activeScreen === "queue" ? session.activeScreen : null;
  let tagsEnabled = session.tagsEnabled === true;
  let tagChooserOpen = tagsEnabled && session.tagChooserOpen === true;
  let tagSessionDeselectCount = 0;
  let draftSelectedTags = null;
  let sitemapClickTimer = null;

  host.innerHTML = [
    '<section class="wv360-shell" data-nav="closed">',
    '  <section class="wv360-nav-pane">',
    '    <div class="wv360-overlay-stack">',
    '      <button type="button" class="wv360-overlay-action" data-action="sitemap">Sitemap</button>',
    '      <button type="button" class="wv360-overlay-action" data-action="tags">Tags: hidden</button>',
    '      <button type="button" class="wv360-overlay-action" data-action="queue">Selected Pages (0)</button>',
    '      <button type="button" class="wv360-overlay-action wv360-close-half" data-action="close-nav">Close</button>',
    "    </div>",
    "  </section>",
    '  <section class="wv360-content-pane">',
    '    <section class="wv360-article-view">',
    '      <main id="pane2main"></main>',
    "    </section>",
    '    <div class="wv360-quick-nav">',
    '      <button type="button" class="wv360-pill" data-action="home" aria-label="Home">⌂</button>',
    '      <button type="button" class="wv360-pill" data-action="prev" aria-label="Previous"><</button>',
    '      <button type="button" class="wv360-pill" data-action="next" aria-label="Next">></button>',
    "    </div>",
    '    <div class="wv360-tag-chooser" hidden></div>',
    '    <button type="button" class="wv360-tag-action" data-action="tag-anchor" hidden>Tags</button>',
    '    <button type="button" class="wv360-tag-action wv360-clear-all" data-action="clear-tags" hidden>Clear All</button>',
    '    <button type="button" class="wv360-hamburger" data-action="open-nav" aria-label="Open navigation">☰</button>',
    "  </section>",
    '  <section class="wv360-screen-layer" hidden aria-hidden="true">',
    '    <header class="wv360-screen-head">',
    '      <h2 class="wv360-screen-title"></h2>',
    '      <button type="button" class="wv360-overlay-action wv360-screen-clear" data-action="clear-queue" hidden>Clear All</button>',
    '      <button type="button" class="wv360-overlay-action wv360-close-half" data-action="close-screen">></button>',
    "    </header>",
    '    <div class="wv360-screen-body"></div>',
    "  </section>",
    "</section>"
  ].join("\n");

  const shell = host.querySelector(".wv360-shell");
  const pane = host.querySelector("#pane2main");
  const navPane = host.querySelector(".wv360-nav-pane");
  const tagChooser = host.querySelector(".wv360-tag-chooser");
  const tagAnchor = host.querySelector('[data-action="tag-anchor"]');
  const clearTagsButton = host.querySelector('[data-action="clear-tags"]');
  const screenLayer = host.querySelector(".wv360-screen-layer");
  const screenTitle = host.querySelector(".wv360-screen-title");
  const screenBody = host.querySelector(".wv360-screen-body");
  const clearQueueButton = host.querySelector('[data-action="clear-queue"]');
  const queueButton = host.querySelector('[data-action="queue"]');
  const tagsToggleButton = host.querySelector('[data-action="tags"]');
  const prevButton = host.querySelector('[data-action="prev"]');
  const nextButton = host.querySelector('[data-action="next"]');

  function persistSession() {
    settingsStore.setViewportSession("360", {
      navOpen,
      activeScreen,
      tagsEnabled,
      tagChooserOpen,
      selectedArticleId: navigation.readState().selectedArticleId || fallbackArticleId,
      expandedMenuKeys: Array.from(expandedMenuKeys),
      queue: queueCore.createSnapshot()
    });
    settingsStore.schedulePersist(120);
  }

  function setNavOpen(open) {
    navOpen = Boolean(open);
    shell.dataset.nav = navOpen ? "open" : "closed";
    persistSession();
  }

  function openArticle(articleId) {
    if (!articleId || !articleMap.has(articleId)) {
      return;
    }
    navigation.openArticleById(articleId);
  }

  function renderQuickNav() {
    const queue = queueCore.getQueue();
    const runtime = navigation.readState();
    const around = getQueueAround(queue, runtime.selectedArticleId);
    prevButton.disabled = !around.previousId;
    nextButton.disabled = !around.nextId;
  }

  function renderTagChooser() {
    tagChooser.innerHTML = "";
    if (!(tagsEnabled && tagChooserOpen)) {
      tagChooser.hidden = true;
      return;
    }
    tagChooser.hidden = false;
    const selected = draftSelectedTags instanceof Set
      ? new Set(draftSelectedTags)
      : new Set(queueCore.getSelectedTags());
    queueCore.allTags.forEach((tag) => {
      const chip = createButton(tag, "wv360-chooser-chip" + (selected.has(tag) ? " is-selected" : ""), () => {
        const hadTag = selected.has(tag);
        if (!(draftSelectedTags instanceof Set)) {
          draftSelectedTags = new Set(queueCore.getSelectedTags());
        }
        if (hadTag) {
          draftSelectedTags.delete(tag);
        } else {
          draftSelectedTags.add(tag);
        }
        if (hadTag) {
          tagSessionDeselectCount += 1;
        }
        renderAll();
      });
      tagChooser.appendChild(chip);
    });
  }

  function renderTagsUi() {
    const selectedTags = draftSelectedTags instanceof Set
      ? Array.from(draftSelectedTags)
      : queueCore.getSelectedTags();
    tagsToggleButton.textContent = tagsEnabled ? "Tags: On" : "Tags: hidden";
    queueButton.textContent = "Selected Pages (" + queueCore.getQueue().length + ")";
    tagAnchor.hidden = !tagsEnabled;
    tagAnchor.textContent = selectedTags.length ? "Tags (" + selectedTags.length + ")" : "Tags";
    clearTagsButton.hidden = !tagsEnabled || !tagChooserOpen || tagSessionDeselectCount < 2 || selectedTags.length === 0;
    renderTagChooser();
  }

  function createQueueList(queueIds, className, itemClassName) {
    const wrap = document.createElement("div");
    wrap.className = className;
    if (!queueIds.length) {
      const empty = document.createElement("div");
      empty.className = "wv360-empty";
      empty.textContent = "No queued articles yet.";
      wrap.appendChild(empty);
      return wrap;
    }
    queueIds.forEach((articleId, index) => {
      const article = articleMap.get(articleId);
      if (!article) {
        return;
      }
      const button = createButton(
        String(index + 1) + ". " + article.title,
        itemClassName + (navigation.readState().selectedArticleId === articleId ? " is-current" : "") + (queueCore.isQueued(articleId) ? " is-queued" : ""),
        () => openArticle(articleId)
      );
      wrap.appendChild(button);
    });
    return wrap;
  }

  function renderTree(container) {
    container.innerHTML = "";
    const selectedArticleId = navigation.readState().selectedArticleId;

    function toggleSitemapSelection(articleId) {
      queueCore.toggleSitemapSelection(articleId);
      renderAll();
      persistSession();
    }

    function clearSitemapClickTimer() {
      if (sitemapClickTimer) {
        window.clearTimeout(sitemapClickTimer);
        sitemapClickTimer = null;
      }
    }

    function bindSitemapButton(button, articleId) {
      button.addEventListener("click", () => {
        clearSitemapClickTimer();
        sitemapClickTimer = window.setTimeout(() => {
          toggleSitemapSelection(articleId);
          sitemapClickTimer = null;
        }, 220);
      });
      button.addEventListener("dblclick", () => {
        clearSitemapClickTimer();
        openArticle(articleId);
      });
    }

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
          row.className = "wv360-sitemap-row is-menu";
          row.style.paddingLeft = String(Math.min(20 + depth * 14, 68)) + "px";

          const main = document.createElement(canOpen ? "button" : "div");
          if (canOpen) {
            main.type = "button";
          }
          main.className = "wv360-sitemap-main";
          main.textContent = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "Section";
          if (canOpen && selectedArticleId === entry.articleId && !queueCore.isQueued(entry.articleId)) {
            main.classList.add("is-current");
          }
          if (canOpen && queueCore.isQueued(entry.articleId)) {
            main.classList.add("is-queued");
          }
          if (canOpen) {
            bindSitemapButton(main, entry.articleId);
          } else {
            main.classList.add("is-static");
          }
          row.appendChild(main);

          if (hasChildren) {
            const expandButton = createButton(expanded ? "-" : "+", "wv360-sitemap-toggle", () => {
              if (expandedMenuKeys.has(menuKey)) {
                expandedMenuKeys.delete(menuKey);
              } else {
                expandedMenuKeys.add(menuKey);
              }
              renderScreen();
              persistSession();
            });
            row.appendChild(expandButton);
          } else {
            const spacer = document.createElement("div");
            spacer.className = "wv360-sitemap-toggle-spacer";
            row.appendChild(spacer);
          }

          container.appendChild(row);
          if (expanded) {
            renderEntries(entry.children, depth + 1, nextPath);
          }
          return;
        }

        if (entry.type === "article" && typeof entry.articleId === "string" && articleMap.has(entry.articleId)) {
          const row = document.createElement("div");
          row.className = "wv360-sitemap-row is-article";
          row.style.paddingLeft = String(Math.min(20 + depth * 14, 68)) + "px";

          const button = createButton(articleMap.get(entry.articleId).title, "wv360-sitemap-main", () => {});
          if (selectedArticleId === entry.articleId && !queueCore.isQueued(entry.articleId)) {
            button.classList.add("is-current");
          }
          if (queueCore.isQueued(entry.articleId)) {
            button.classList.add("is-queued");
          }
          bindSitemapButton(button, entry.articleId);
          row.appendChild(button);

          const spacer = document.createElement("div");
          spacer.className = "wv360-sitemap-toggle-spacer";
          row.appendChild(spacer);

          container.appendChild(row);
        }
      });
    }

    renderEntries(websiteTopLevel, 0, []);
  }

  function collectExpandableMenuKeys() {
    const keys = [];
    function walk(entries, path) {
      if (!Array.isArray(entries)) {
        return;
      }
      entries.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || entry.type !== "menu") {
          return;
        }
        const nextPath = path.concat(index);
        if (Array.isArray(entry.children) && entry.children.length > 0) {
          keys.push(getMenuKey(entry, nextPath));
        }
        walk(entry.children, nextPath);
      });
    }
    walk(websiteTopLevel, []);
    return keys;
  }

  function renderScreen() {
    screenBody.innerHTML = "";
    clearQueueButton.hidden = activeScreen !== "sitemap";
    if (!activeScreen) {
      screenLayer.hidden = true;
      screenLayer.setAttribute("aria-hidden", "true");
      return;
    }

    screenLayer.hidden = false;
    screenLayer.setAttribute("aria-hidden", "false");

    if (activeScreen === "queue") {
      screenTitle.textContent = "Selected Pages (" + queueCore.getQueue().length + ")";
      screenBody.appendChild(createQueueList(queueCore.getQueue(), "wv360-queue-list", "wv360-queue-item"));
      return;
    }

    screenTitle.textContent = "Sitemap";
    const tree = document.createElement("div");
    tree.className = "wv360-sitemap-tree";
    renderTree(tree);
    screenBody.appendChild(tree);
  }

  function renderAll() {
    renderQuickNav();
    renderTagsUi();
    renderScreen();
  }

  function closeScreen() {
    activeScreen = null;
    renderAll();
    persistSession();
  }

  const unsubscribe = navigation.subscribe((event) => {
    if (event.type !== "open" && event.type !== "back-empty") {
      return;
    }
    renderAll();
    persistSession();
  });

  host.querySelector('[data-action="open-nav"]').addEventListener("click", () => setNavOpen(true));
  host.querySelector('[data-action="close-nav"]').addEventListener("click", () => setNavOpen(false));
  navPane.addEventListener("click", (event) => {
    if (event.target === navPane) {
      setNavOpen(false);
    }
  });
  host.querySelector('[data-action="sitemap"]').addEventListener("click", () => {
    activeScreen = "sitemap";
    if (!expandedMenuKeys.size) {
      collectExpandableMenuKeys().forEach((key) => expandedMenuKeys.add(key));
    }
    setNavOpen(false);
    renderAll();
    persistSession();
  });
  host.querySelector('[data-action="queue"]').addEventListener("click", () => {
    activeScreen = "queue";
    setNavOpen(false);
    renderAll();
    persistSession();
  });
  tagsToggleButton.addEventListener("click", () => {
    tagsEnabled = !tagsEnabled;
    if (!tagsEnabled) {
      tagChooserOpen = false;
      tagSessionDeselectCount = 0;
      draftSelectedTags = null;
    }
    renderAll();
    persistSession();
  });
  tagAnchor.addEventListener("click", () => {
    if (!tagsEnabled) {
      return;
    }
    if (!tagChooserOpen) {
      tagChooserOpen = true;
      tagSessionDeselectCount = 0;
      draftSelectedTags = new Set(queueCore.getSelectedTags());
      renderAll();
      persistSession();
      return;
    }
    tagChooserOpen = false;
    const selectedTags = draftSelectedTags instanceof Set ? Array.from(draftSelectedTags) : queueCore.getSelectedTags();
    queueCore.clearTags();
    selectedTags.forEach((tag) => {
      if (!queueCore.getSelectedTags().includes(tag)) {
        queueCore.toggleTag(tag);
      }
    });
    draftSelectedTags = null;
    tagSessionDeselectCount = 0;
    renderAll();
    persistSession();
  });
  clearTagsButton.addEventListener("click", () => {
    if (!(draftSelectedTags instanceof Set)) {
      draftSelectedTags = new Set(queueCore.getSelectedTags());
    }
    draftSelectedTags.clear();
    tagSessionDeselectCount = 0;
    renderAll();
  });
  host.querySelector('[data-action="close-screen"]').addEventListener("click", closeScreen);
  clearQueueButton.addEventListener("click", () => {
    queueCore.loadSnapshot({
      selectedTags: [],
      sitemapSelectedIds: [],
      useDefaultQueue: false,
      nextQueue: []
    });
    draftSelectedTags = null;
    tagSessionDeselectCount = 0;
    renderAll();
    persistSession();
  });
  host.querySelector('[data-action="home"]').addEventListener("click", () => {
    if (homeArticleId && articleMap.has(homeArticleId)) {
      openArticle(homeArticleId);
      return;
    }
    navigation.openHome();
  });
  prevButton.addEventListener("click", () => {
    const around = getQueueAround(queueCore.getQueue(), navigation.readState().selectedArticleId);
    if (around.previousId) {
      openArticle(around.previousId);
    }
  });
  nextButton.addEventListener("click", () => {
    const around = getQueueAround(queueCore.getQueue(), navigation.readState().selectedArticleId);
    if (around.nextId) {
      openArticle(around.nextId);
    }
  });

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      if (navOpen) {
        setNavOpen(false);
        return;
      }
      if (activeScreen) {
        closeScreen();
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);

  setNavOpen(navOpen);
  renderAll();

  const startupArticleId = session.selectedArticleId && articleMap.has(session.selectedArticleId)
    ? session.selectedArticleId
    : fallbackArticleId;
  if (startupArticleId && !navigation.readState().selectedArticleId) {
    openArticle(startupArticleId);
  }
  persistSession();

  return {
    key: "360",
    articlePane: pane,
    teardown() {
      if (sitemapClickTimer) {
        window.clearTimeout(sitemapClickTimer);
      }
      unsubscribe();
      window.removeEventListener("keydown", onKeyDown);
      host.innerHTML = "";
    }
  };
}
