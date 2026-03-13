import { createQueueCore } from "../core/queue-core.js";
import { createButton, getDepthClass } from "../core/nav-rail-utils.js";

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

export function createViewport360(options) {
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
    navOpen: false,
    sidePaneMode: "closed",
    activeScreen: null,
    tagsEnabled: false,
    tagChooserOpen: false,
    selectedArticleId: fallbackArticleId,
    queue: queueCore.createSnapshot()
  };
  const session = settingsStore.getViewportSession("360", defaultSession);
  queueCore.loadSnapshot(session.queue);
  let navOpen = true;
  const initialSidePaneMode = typeof session.sidePaneMode === "string"
    ? session.sidePaneMode
    : (session.sidePanelOpen === true ? "open" : "closed");
  let sidePaneMode = initialSidePaneMode === "open" || initialSidePaneMode === "partial" || initialSidePaneMode === "closed"
    ? initialSidePaneMode
    : "closed";
  let activeScreen = session.activeScreen === "sitemap" || session.activeScreen === "queue" ? session.activeScreen : null;
  let tagsEnabled = session.tagsEnabled === true;
  let tagChooserOpen = tagsEnabled && session.tagChooserOpen === true;
  let tagSessionDeselectCount = 0;
  let draftSelectedTags = null;
  let sitemapClickTimer = null;

  host.innerHTML = [
    '<section class="wv360-shell cs-shell" data-nav="closed">',
    '  <section class="wv360-nav-pane">',
    '    <div class="wv360-overlay-stack">',
    '      <button type="button" class="wv360-overlay-action cs-action-btn" data-action="sitemap">Sitemap</button>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn" data-action="tags">Tags: hidden</button>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn" data-action="queue">Selected Pages (0)</button>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn wv360-close-half" data-action="close-nav">Close</button>',
    "    </div>",
    "  </section>",
    '  <section class="wv360-content-pane">',
    '    <section class="wv360-article-view cs-content-host">',
    '      <main id="pane2main"></main>',
    "    </section>",
    '    <div class="wv360-quick-nav">',
    '      <button type="button" class="wv360-pill cs-floating-btn" data-action="home" aria-label="Home">⌂</button>',
    '      <button type="button" class="wv360-pill cs-floating-btn" data-action="prev" aria-label="Previous"><</button>',
    '      <button type="button" class="wv360-pill cs-floating-btn" data-action="next" aria-label="Next">></button>',
    "    </div>",
    '    <div class="wv360-tag-chooser" hidden></div>',
    '    <button type="button" class="wv360-tag-action" data-action="tag-anchor" hidden>Tags</button>',
    '    <button type="button" class="wv360-tag-action wv360-clear-all" data-action="clear-tags" hidden>Clear All</button>',
    '    <button type="button" class="wv360-side-toggle cs-floating-btn" data-action="toggle-side-pane" aria-label="Open side pane"></button>',
    '    <aside class="wv360-side-pane cs-rail" aria-label="Side pane">',
    '      <div class="wv360-side-pane-scroll" data-role="side-menus"></div>',
    "    </aside>",
    '    <button type="button" class="wv360-hamburger cs-floating-btn" data-action="open-nav" aria-label="Open navigation">☰</button>',
    "  </section>",
    '  <section class="wv360-screen-layer" hidden aria-hidden="true">',
    '    <header class="wv360-screen-head cs-panel-head">',
    '      <h2 class="wv360-screen-title cs-section-head"></h2>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn wv360-screen-clear" data-action="clear-queue" hidden>Clear All</button>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn wv360-close-half" data-action="close-screen">></button>',
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
  const sidePane = host.querySelector(".wv360-side-pane");
  const sideToggleButton = host.querySelector('[data-action="toggle-side-pane"]');
  const sideMenus = host.querySelector('[data-role="side-menus"]');
  const clearQueueButton = host.querySelector('[data-action="clear-queue"]');
  const queueButton = host.querySelector('[data-action="queue"]');
  const tagsToggleButton = host.querySelector('[data-action="tags"]');
  const prevButton = host.querySelector('[data-action="prev"]');
  const nextButton = host.querySelector('[data-action="next"]');

  function persistSession() {
    settingsStore.setViewportSession("360", {
      navOpen,
      sidePaneMode,
      activeScreen,
      tagsEnabled,
      tagChooserOpen,
      selectedArticleId: navigation.readState().selectedArticleId || fallbackArticleId,
      queue: queueCore.createSnapshot()
    });
    settingsStore.schedulePersist(120);
  }

  function setNavOpen(open) {
    navOpen = Boolean(open);
    shell.dataset.nav = navOpen ? "open" : "closed";
    persistSession();
  }

  function setSidePaneMode(mode) {
    sidePaneMode = mode === "open" || mode === "partial" || mode === "closed" ? mode : "closed";
    shell.dataset.sidePane = sidePaneMode;
    if (sideToggleButton) {
      if (sidePaneMode === "open") {
        sideToggleButton.setAttribute("aria-label", "Partially hide side pane");
      } else if (sidePaneMode === "partial") {
        sideToggleButton.setAttribute("aria-label", "Close side pane");
      } else {
        sideToggleButton.setAttribute("aria-label", "Open side pane");
      }
    }
    persistSession();
  }

  function openArticle(articleId, options) {
    if (!articleId || !articleMap.has(articleId)) {
      return;
    }
    const sidePaneModeOnClick = options && typeof options.sidePaneModeOnClick === "string"
      ? options.sidePaneModeOnClick
      : null;
    navigation.openArticleById(articleId);
    const fromSidePane = Boolean(options && options.fromSidePane);
    if (!fromSidePane) {
      return;
    }
    if (sidePaneModeOnClick === "open") {
      setSidePaneMode("closed");
      return;
    }
    if (sidePaneModeOnClick === "partial") {
      setSidePaneMode("partial");
    }
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
      const chip = createButton(tag, "wv360-chooser-chip cs-chip-btn" + (selected.has(tag) ? " is-selected active" : ""), () => {
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
      empty.className = "wv360-empty cs-empty";
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
        itemClassName + " cs-list-btn" + (navigation.readState().selectedArticleId === articleId ? " is-current active" : "") + (queueCore.isQueued(articleId) ? " is-queued" : ""),
        () => openArticle(articleId)
      );
      wrap.appendChild(button);
    });
    return wrap;
  }

  function renderTree(container) {
    container.innerHTML = "";
    const selectedArticleId = navigation.readState().selectedArticleId;
    const tree = siteMap.getTreeModel(selectedArticleId);

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

    tree.forEach((node) => {
      if (node.type !== "menu" && node.type !== "article") {
        return;
      }
      const canOpen = Boolean(node.isClickable && node.articleId);
      const row = document.createElement("div");
      row.className = "wv360-sitemap-row " + (node.type === "menu" ? "is-menu" : "is-article");
      row.style.paddingLeft = String(Math.min(20 + node.depth * 14, 68)) + "px";

      const main = document.createElement(canOpen ? "button" : "div");
      if (canOpen) {
        main.type = "button";
      }
      main.className = "wv360-sitemap-main cs-list-btn";
      const title = node.type === "article"
        ? ((articleMap.get(node.articleId) && articleMap.get(node.articleId).title) || node.title || node.articleId)
        : (node.label && node.label.trim() ? node.label.trim() : "Section");
      main.textContent = title;
      if (canOpen && selectedArticleId === node.articleId && !queueCore.isQueued(node.articleId)) {
        main.classList.add("is-current", "active");
      }
      if (canOpen && queueCore.isQueued(node.articleId)) {
        main.classList.add("is-queued");
      }
      if (canOpen) {
        bindSitemapButton(main, node.articleId);
      } else {
        main.classList.add("is-static");
      }
      row.appendChild(main);

      if (node.type === "menu" && node.hasChildren) {
        const expandButton = createButton(node.isExpanded ? "-" : "+", "wv360-sitemap-toggle cs-menu-toggle", () => {
          siteMap.toggleNode(node.nodeId);
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
    });
  }

  function getNodeTitle(node) {
    if (typeof node.title === "string" && node.title.trim()) {
      return node.title.trim();
    }
    if (typeof node.label === "string" && node.label.trim()) {
      return node.label.trim();
    }
    return typeof node.articleId === "string" && node.articleId ? node.articleId : "Menu";
  }

  function createSideMenuRow(node) {
    const row = document.createElement("div");
    row.className = "cs-nav-row wv360-side-nav-row wv360-side-menu-row " + getDepthClass(node.depth);
    row.style.paddingLeft = node.depth * 10 + "px";

    if (node.hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "wv360-side-menu-toggle cs-menu-toggle";
      toggle.textContent = node.isExpanded ? "-" : "+";
      toggle.setAttribute("aria-label", node.isExpanded ? "Collapse section" : "Expand section");
      toggle.setAttribute("aria-expanded", node.isExpanded ? "true" : "false");
      toggle.addEventListener("click", () => {
        siteMap.toggleNode(node.nodeId);
        renderAll();
        persistSession();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "wv360-side-menu-toggle-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    if (node.isClickable) {
      const button = createButton(
        getNodeTitle(node),
        "wv360-side-nav-btn cs-nav-btn" + (node.isActive ? " active" : ""),
        () => {
          navigation.setNavArea("menus");
          const articleId = siteMap.openNode(node.nodeId);
          if (articleId) {
            openArticle(articleId, { fromSidePane: true, sidePaneModeOnClick: sidePaneMode });
          }
        }
      );
      row.appendChild(button);
    } else {
      const label = document.createElement("div");
      label.className = "wv360-side-menu-label cs-menu-label";
      label.textContent = getNodeTitle(node);
      row.appendChild(label);
    }

    return row;
  }

  function createSideArticleRow(node) {
    const isHomeRow = Boolean(homeArticleId) && node.depth === 0 && node.articleId === homeArticleId;
    const row = document.createElement("div");
    row.className = "cs-nav-row wv360-side-nav-row wv360-side-article-row " + getDepthClass(node.depth) + (isHomeRow ? " wv360-side-home-row" : "");
    row.style.paddingLeft = node.depth * 10 + "px";

    const spacer = document.createElement("span");
    spacer.className = "wv360-side-menu-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);

    const button = createButton(
      (isHomeRow ? "⌂ " : "") + getNodeTitle(node),
      "wv360-side-nav-btn cs-nav-btn" + (node.isActive ? " active" : ""),
      () => {
        navigation.setNavArea("menus");
        const articleId = siteMap.openNode(node.nodeId);
        if (articleId) {
          openArticle(articleId, { fromSidePane: true, sidePaneModeOnClick: sidePaneMode });
        }
      }
    );
    row.appendChild(button);

    return row;
  }

  function renderSideMenus() {
    if (typeof navigation.setNavArea === "function" && navigation.readState().navArea !== "menus") {
      navigation.setNavArea("menus");
    }
    sideMenus.innerHTML = "";
    const tree = siteMap.getTreeModel(navigation.readState().selectedArticleId);
    tree.forEach((node) => {
      if (node.type === "menu") {
        sideMenus.appendChild(createSideMenuRow(node));
        return;
      }
      if (node.type === "article") {
        sideMenus.appendChild(createSideArticleRow(node));
      }
    });
  }

  function expandAllSitemapMenus() {
    let changed = false;
    let safety = 0;
    while (safety < 500) {
      safety += 1;
      const visible = siteMap.getTreeModel(navigation.readState().selectedArticleId);
      const nextCollapsed = visible.find((node) => node.type === "menu" && node.hasChildren && !node.isExpanded);
      if (!nextCollapsed) {
        break;
      }
      siteMap.toggleNode(nextCollapsed.nodeId);
      changed = true;
    }
    return changed;
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
    renderSideMenus();
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
    if (expandAllSitemapMenus()) {
      persistSession();
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
  sideToggleButton.addEventListener("click", () => {
    if (sidePaneMode === "closed") {
      setSidePaneMode("open");
      return;
    }
    if (sidePaneMode === "open") {
      setSidePaneMode("partial");
      return;
    }
    setSidePaneMode("closed");
  });

  const onDocumentClick = (event) => {
    if (sidePaneMode === "closed") {
      return;
    }
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const clickedInsidePane = Boolean(sidePane && path.includes(sidePane));
    const clickedToggle = Boolean(sideToggleButton && path.includes(sideToggleButton));
    if (clickedInsidePane || clickedToggle) {
      return;
    }
    if (!(event.target instanceof Node)) {
      setSidePaneMode("closed");
      return;
    }
    setSidePaneMode("closed");
  };
  document.addEventListener("click", onDocumentClick);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      if (navOpen) {
        setNavOpen(false);
        return;
      }
      if (activeScreen) {
        closeScreen();
        return;
      }
      if (sidePaneMode !== "closed") {
        setSidePaneMode("closed");
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);

  setNavOpen(navOpen);
  setSidePaneMode(sidePaneMode);
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
      document.removeEventListener("click", onDocumentClick);
      host.innerHTML = "";
    }
  };
}
