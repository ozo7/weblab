import { createColorPicker } from "../core/color-picker.js";
import { getReadableTextColor } from "../core/color-schemes.js";
import { createButton, getDepthClass } from "../core/nav-rail-utils.js";

function getQueueAround(queueIds, currentId) {
  const index = queueIds.indexOf(currentId);
  return {
    previousId: index > 0 ? queueIds[index - 1] : null,
    nextId: index >= 0 && index < queueIds.length - 1 ? queueIds[index + 1] : null
  };
}

function asPreviewColor(value, fallback) {
  return typeof value === "string" && value ? value : fallback;
}

export function createViewport360(options) {
  const host = options.host;
  const navigation = options.navigation;
  const siteMap = options.siteMap;
  const tagPool = options.tagPool || null;
  const pagingQueue = options.pagingQueue || null;
  const configuration = options.configuration || null;
  const settingsStore = options.settingsStore;
  const articleMap = options.articleMap instanceof Map ? options.articleMap : new Map();
  const homeArticleId = options.homeArticleId || null;

  const fallbackArticleId = homeArticleId && articleMap.has(homeArticleId)
    ? homeArticleId
    : (navigation.readState().landingArticleId || null);

  const defaultSession = {
    navOpen: false,
    sidePaneMode: "closed",
    activeScreen: null,
    selectedArticleId: fallbackArticleId
  };
  const session = settingsStore.getViewportSession("360", defaultSession);

  let navOpen = session.navOpen === true;
  let sidePaneMode = session.sidePaneMode === "open" || session.sidePaneMode === "partial" || session.sidePaneMode === "closed"
    ? session.sidePaneMode
    : "closed";
  let activeScreen = session.activeScreen === "tags" || session.activeScreen === "history" || session.activeScreen === "configuration"
    ? session.activeScreen
    : null;
  let configPreviewKey = configuration && typeof configuration.readState === "function"
    ? configuration.readState().selectedSchemeKey
    : "minty-premature";

  host.innerHTML = [
    '<section class="wv360-shell cs-shell" data-nav="closed" data-side-pane="closed">',
    '  <section class="wv360-nav-pane">',
    '    <div class="wv360-overlay-stack">',
    '      <button type="button" class="wv360-overlay-action cs-action-btn" data-action="open-tags">tags</button>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn" data-action="open-history">history</button>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn" data-action="open-configuration">configuration</button>',
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
    '    <button type="button" class="wv360-side-toggle cs-floating-btn" data-action="toggle-side-pane" aria-label="Open side pane"></button>',
    '    <aside class="wv360-side-pane cs-rail" aria-label="Side pane">',
    '      <div class="wv360-side-pane-scroll" data-role="side-menus"></div>',
    "    </aside>",
    '    <button type="button" class="wv360-hamburger cs-floating-btn" data-action="open-nav" aria-label="Open navigation">☰</button>',
    "  </section>",
    '  <section class="wv360-screen-layer" hidden aria-hidden="true">',
    '    <header class="wv360-screen-head cs-panel-head">',
    '      <h2 class="wv360-screen-title cs-section-head"></h2>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn wv360-close-half" data-action="close-screen">></button>',
    "    </header>",
    '    <div class="wv360-screen-body"></div>',
    "  </section>",
    "</section>"
  ].join("\n");

  const shell = host.querySelector(".wv360-shell");
  const pane = host.querySelector("#pane2main");
  const navPane = host.querySelector(".wv360-nav-pane");
  const screenLayer = host.querySelector(".wv360-screen-layer");
  const screenTitle = host.querySelector(".wv360-screen-title");
  const screenBody = host.querySelector(".wv360-screen-body");
  const sidePane = host.querySelector(".wv360-side-pane");
  const sideToggleButton = host.querySelector('[data-action="toggle-side-pane"]');
  const sideMenus = host.querySelector('[data-role="side-menus"]');
  const tagsOpenButton = host.querySelector('[data-action="open-tags"]');
  const historyOpenButton = host.querySelector('[data-action="open-history"]');
  const configurationOpenButton = host.querySelector('[data-action="open-configuration"]');
  const prevButton = host.querySelector('[data-action="prev"]');
  const nextButton = host.querySelector('[data-action="next"]');

  function persistSession() {
    settingsStore.setViewportSession("360", {
      navOpen,
      sidePaneMode,
      activeScreen,
      selectedArticleId: navigation.readState().selectedArticleId || fallbackArticleId
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
    if (sidePaneMode === "open") {
      sideToggleButton.setAttribute("aria-label", "Partially hide side pane");
    } else if (sidePaneMode === "partial") {
      sideToggleButton.setAttribute("aria-label", "Close side pane");
    } else {
      sideToggleButton.setAttribute("aria-label", "Open side pane");
    }
    persistSession();
  }

  function setActiveScreen(nextScreen) {
    activeScreen = nextScreen === "tags" || nextScreen === "history" || nextScreen === "configuration" ? nextScreen : null;
    const navArea = activeScreen || "menus";
    if (typeof navigation.setNavArea === "function") {
      navigation.setNavArea(navArea);
    }
    renderAll();
    persistSession();
  }

  function openArticle(articleId, options) {
    if (!articleId || !articleMap.has(articleId)) {
      return;
    }
    navigation.openArticleById(articleId);
    if (!(options && options.fromSidePane)) {
      return;
    }
    if (sidePaneMode === "open") {
      setSidePaneMode("closed");
      return;
    }
    if (sidePaneMode === "partial") {
      setSidePaneMode("partial");
    }
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
          if (typeof navigation.setNavArea === "function") {
            navigation.setNavArea("menus");
          }
          const articleId = siteMap.openNode(node.nodeId);
          if (articleId) {
            openArticle(articleId, { fromSidePane: true });
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
        if (typeof navigation.setNavArea === "function") {
          navigation.setNavArea("menus");
        }
        const articleId = siteMap.openNode(node.nodeId);
        if (articleId) {
          openArticle(articleId, { fromSidePane: true });
        }
      }
    );
    row.appendChild(button);

    return row;
  }

  function renderSideMenus() {
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

  function renderQuickNav() {
    const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
      ? pagingQueue.getQueue()
      : [];
    const runtime = navigation.readState();
    const around = getQueueAround(queue, runtime.selectedArticleId);
    prevButton.disabled = !around.previousId;
    nextButton.disabled = !around.nextId;
  }

  function createTagsScreenContent() {
    const wrap = document.createElement("div");
    wrap.className = "wv360-fullscreen-panel";

    const head = document.createElement("div");
    head.className = "wv360-history-head cs-section-head";
    head.textContent = "Pages to read, selected by tags:";
    wrap.appendChild(head);

    const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
      ? pagingQueue.getQueue()
      : [];
    const selectedTagColors = tagPool && typeof tagPool.getSelectedTagColors === "function"
      ? tagPool.getSelectedTagColors()
      : {};
    const selectedId = navigation.readState().selectedArticleId;
    const currentIndex = queue.indexOf(selectedId);
    const hasCurrentInQueue = currentIndex >= 0;

    const queueList = document.createElement("div");
    queueList.className = "wv360-history-list wv360-tags-queue-list";
    if (!queue.length) {
      const empty = document.createElement("div");
      empty.className = "wv360-history-empty cs-empty";
      empty.textContent = "No selected pages.";
      queueList.appendChild(empty);
    } else {
      queue.forEach((articleId) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "wv360-history-item cs-list-btn" + (articleId === selectedId ? " active" : "");
        item.addEventListener("click", () => navigation.openArticleById(articleId));

        const selectedTagsFromPool = tagPool && typeof tagPool.getSelectedTagsForArticle === "function"
          ? tagPool.getSelectedTagsForArticle(articleId)
          : [];

        const label = document.createElement("span");
        label.className = "wv360-queue-label";
        const article = articleMap.get(articleId);
        label.textContent = article && article.title ? article.title : articleId;
        item.appendChild(label);

        const stripeWrap = document.createElement("span");
        stripeWrap.className = "wv360-queue-stripes";
        selectedTagsFromPool.forEach((tag) => {
          const stripe = document.createElement("span");
          stripe.className = "wv360-queue-stripe cs-queue-stripe";
          stripe.style.backgroundColor = selectedTagColors[tag] || "#111111";
          stripe.title = tag;
          stripeWrap.appendChild(stripe);
        });
        item.appendChild(stripeWrap);
        queueList.appendChild(item);
      });
    }
    wrap.appendChild(queueList);

    const controls = document.createElement("div");
    controls.className = "wv360-tags-controls";
    const prevId = hasCurrentInQueue && currentIndex > 0 ? queue[currentIndex - 1] : null;
    const nextId = hasCurrentInQueue
      ? (currentIndex < queue.length - 1 ? queue[currentIndex + 1] : null)
      : (queue.length ? queue[0] : null);

    const prevQueueButton = createButton("<", "wv360-tags-nav-btn cs-mini-nav-btn", () => {
      if (prevId) {
        navigation.openArticleById(prevId);
      }
    });
    prevQueueButton.disabled = !prevId;
    controls.appendChild(prevQueueButton);

    const nextQueueButton = createButton(">", "wv360-tags-nav-btn cs-mini-nav-btn", () => {
      if (nextId) {
        navigation.openArticleById(nextId);
      }
    });
    nextQueueButton.disabled = !nextId;
    controls.appendChild(nextQueueButton);

    const selectedCount = document.createElement("div");
    selectedCount.className = "wv360-tags-selected cs-section-head";
    selectedCount.textContent = "Selected: " + queue.length;
    controls.appendChild(selectedCount);

    const selectedTags = new Set(
      tagPool && typeof tagPool.getSelectedTags === "function"
        ? tagPool.getSelectedTags()
        : []
    );
    const clearTags = createButton("Clear", "wv360-tag-clear wv360-tag-clear-inline cs-chip-btn", () => {
      if (tagPool && typeof tagPool.clear === "function") {
        tagPool.clear();
      }
    });
    clearTags.disabled = selectedTags.size === 0;
    controls.appendChild(clearTags);
    wrap.appendChild(controls);

    const tagWrap = document.createElement("div");
    tagWrap.className = "wv360-tagpool";
    const tagHead = document.createElement("div");
    tagHead.className = "wv360-tagpool-head cs-section-head";
    tagHead.textContent = "Tag pool:";
    tagWrap.appendChild(tagHead);

    const tags = tagPool && typeof tagPool.getAllTags === "function" ? tagPool.getAllTags() : [];
    const tagList = document.createElement("div");
    tagList.className = "wv360-tagpool-list";
    tags.forEach((tag) => {
      const color = selectedTagColors[tag];
      const tagButton = createButton(
        tag,
        "wv360-tag-btn cs-chip-btn" + (selectedTags.has(tag) ? " active" : ""),
        () => {
          if (tagPool && typeof tagPool.toggleTag === "function") {
            tagPool.toggleTag(tag);
          }
        }
      );
      if (color && selectedTags.has(tag)) {
        tagButton.style.borderColor = color;
        tagButton.style.backgroundColor = color;
        tagButton.style.color = getReadableTextColor(color);
      }
      tagList.appendChild(tagButton);
    });
    tagWrap.appendChild(tagList);
    wrap.appendChild(tagWrap);

    return wrap;
  }

  function createHistoryScreenContent() {
    const wrap = document.createElement("div");
    wrap.className = "wv360-fullscreen-panel";

    const head = document.createElement("div");
    head.className = "wv360-history-head cs-section-head";
    head.textContent = "Your last visited pages (max. 20):";
    wrap.appendChild(head);

    const historyList = Array.isArray(navigation.readState().navigationHistory)
      ? navigation.readState().navigationHistory
      : [];
    if (!historyList.length) {
      const empty = document.createElement("div");
      empty.className = "wv360-history-empty cs-empty";
      empty.textContent = "No visited pages yet.";
      wrap.appendChild(empty);
      return wrap;
    }

    const list = document.createElement("div");
    list.className = "wv360-history-list";
    historyList.forEach((articleId, index) => {
      const item = createButton(
        String(index + 1) + ". " + articleId,
        "wv360-history-item cs-list-btn",
        () => navigation.openArticleById(articleId)
      );
      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function getConfigurationPreviewByKey(key) {
    if (!configuration || typeof configuration.readState !== "function") {
      return null;
    }
    const state = configuration.readState();
    const schemes = Array.isArray(state.schemes) ? state.schemes : [];
    return schemes.find((scheme) => scheme && scheme.key === key) || schemes[0] || null;
  }

  function createConfigurationScreenContent() {
    const wrap = document.createElement("div");
    wrap.className = "wv360-fullscreen-panel";

    const sectionTitle = document.createElement("div");
    sectionTitle.className = "wv360-history-head cs-section-head";
    sectionTitle.textContent = "Configuration";
    wrap.appendChild(sectionTitle);

    const previewScheme = getConfigurationPreviewByKey(configPreviewKey);
    const preview = previewScheme && previewScheme.preview ? previewScheme.preview : null;
    if (preview) {
      const mini = document.createElement("div");
      mini.className = "wv360-config-mini cs-preview-card";
      mini.style.maxWidth = "100%";
      mini.style.background = asPreviewColor(preview.surface, "#F8FCF8");
      mini.style.color = asPreviewColor(preview.text, "#17301F");
      mini.style.borderColor = asPreviewColor(preview.border, "#B8CABC");
      mini.innerHTML = [
        '<div class="wv360-config-mini-top">',
        '  <span class="cs-preview-btn" style="background:' + asPreviewColor(preview.interactive, "#E5F1E8") + ";border-color:" + asPreviewColor(preview.border, "#B8CABC") + ";">menus / sitemap</span>',
        '  <span class="cs-preview-btn" style="background:' + asPreviewColor(preview.interactive, "#E5F1E8") + ";border-color:" + asPreviewColor(preview.border, "#B8CABC") + ";">☰</span>',
        "</div>",
        '<div class="wv360-config-mini-title">Theme Illustration: ' + previewScheme.label + "</div>"
      ].join("\n");
      wrap.appendChild(mini);
    }

    const state = configuration && typeof configuration.readState === "function" ? configuration.readState() : null;

    const pastelRow = document.createElement("div");
    pastelRow.className = "wv360-config-pastel-row";
    const pastelLabel = document.createElement("label");
    pastelLabel.className = "wv360-config-pastel-label cs-section-head";
    pastelLabel.textContent = "Pastel base:";
    pastelRow.appendChild(pastelLabel);
    const pickerHost = document.createElement("div");
    pastelRow.appendChild(pickerHost);
    createColorPicker({
      host: pickerHost,
      initialHex: state && typeof state.pastelBaseColor === "string" ? state.pastelBaseColor : "#B76DC9",
      onChange(nextHex) {
        if (configuration && typeof configuration.setPastelBaseColor === "function") {
          configuration.setPastelBaseColor(nextHex);
        }
      }
    });
    wrap.appendChild(pastelRow);

    const schemeList = document.createElement("div");
    schemeList.className = "wv360-config-scheme-list";
    const schemes = state && Array.isArray(state.schemes) ? state.schemes : [];
    const selectedKey = state && typeof state.selectedSchemeKey === "string" ? state.selectedSchemeKey : "";
    schemes.forEach((scheme) => {
      const previewModel = scheme && scheme.preview ? scheme.preview : {};
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wv360-config-scheme-btn cs-scheme-btn" + (selectedKey === scheme.key ? " active" : "");
      button.textContent = scheme.label;
      button.style.background = asPreviewColor(previewModel.interactive, "#E5F1E8");
      button.style.color = getReadableTextColor(asPreviewColor(previewModel.interactive, "#E5F1E8"));
      button.style.borderColor = asPreviewColor(previewModel.border, "#B8CABC");
      button.addEventListener("click", () => {
        configPreviewKey = scheme.key;
        renderScreen();
      });
      schemeList.appendChild(button);
    });
    wrap.appendChild(schemeList);

    return wrap;
  }

  function renderScreen() {
    screenBody.innerHTML = "";
    if (!activeScreen) {
      screenLayer.hidden = true;
      screenLayer.setAttribute("aria-hidden", "true");
      return;
    }

    screenLayer.hidden = false;
    screenLayer.setAttribute("aria-hidden", "false");

    if (activeScreen === "tags") {
      screenTitle.textContent = "Tags";
      screenBody.appendChild(createTagsScreenContent());
      return;
    }

    if (activeScreen === "history") {
      screenTitle.textContent = "History";
      screenBody.appendChild(createHistoryScreenContent());
      return;
    }

    if (activeScreen === "configuration") {
      screenTitle.textContent = "Configuration";
      screenBody.appendChild(createConfigurationScreenContent());
    }
  }

  function renderAll() {
    renderQuickNav();
    renderSideMenus();
    renderScreen();
  }

  function closeScreen() {
    setActiveScreen(null);
  }

  const unsubscribeNavigation = navigation.subscribe((event) => {
    if (event.type !== "open" && event.type !== "back-empty") {
      return;
    }
    renderAll();
    persistSession();
  });
  const unsubscribeTagPool = tagPool && typeof tagPool.subscribe === "function"
    ? tagPool.subscribe(() => renderAll())
    : () => {};
  const unsubscribePagingQueue = pagingQueue && typeof pagingQueue.subscribe === "function"
    ? pagingQueue.subscribe(() => renderAll())
    : () => {};
  const unsubscribeConfiguration = configuration && typeof configuration.subscribe === "function"
    ? configuration.subscribe(() => {
      if (activeScreen === "configuration") {
        renderScreen();
      }
    })
    : () => {};

  host.querySelector('[data-action="open-nav"]').addEventListener("click", () => setNavOpen(true));
  navPane.addEventListener("click", (event) => {
    if (event.target === navPane) {
      setNavOpen(false);
    }
  });

  tagsOpenButton.addEventListener("click", () => {
    setNavOpen(false);
    setActiveScreen("tags");
  });
  historyOpenButton.addEventListener("click", () => {
    setNavOpen(false);
    setActiveScreen("history");
  });
  configurationOpenButton.addEventListener("click", () => {
    setNavOpen(false);
    setActiveScreen("configuration");
  });

  host.querySelector('[data-action="close-screen"]').addEventListener("click", closeScreen);

  host.querySelector('[data-action="home"]').addEventListener("click", () => {
    if (homeArticleId && articleMap.has(homeArticleId)) {
      openArticle(homeArticleId);
      return;
    }
    navigation.openHome();
  });

  prevButton.addEventListener("click", () => {
    const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
      ? pagingQueue.getQueue()
      : [];
    const around = getQueueAround(queue, navigation.readState().selectedArticleId);
    if (around.previousId) {
      openArticle(around.previousId);
    }
  });

  nextButton.addEventListener("click", () => {
    const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
      ? pagingQueue.getQueue()
      : [];
    const around = getQueueAround(queue, navigation.readState().selectedArticleId);
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
    setSidePaneMode("closed");
  };
  document.addEventListener("click", onDocumentClick);

  const onKeyDown = (event) => {
    if (event.key !== "Escape") {
      return;
    }
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
      unsubscribeNavigation();
      unsubscribeTagPool();
      unsubscribePagingQueue();
      unsubscribeConfiguration();
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocumentClick);
      host.innerHTML = "";
    }
  };
}
