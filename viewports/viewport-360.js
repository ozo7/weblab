import { getReadableTextColor } from "../core/color-schemes.js";
import { createButton, getDepthClass } from "../core/nav-rail-utils.js";
import { ensureSelectedArticleOrFallback } from "../core/article-fallback.js";
import { createHistoryScreen } from "../core/navarea-history-screen.js";
import { bindOutsideDismiss } from "../core/overlay-dismiss.js";
import { createTagsScreen } from "../core/navarea-tags-screen.js";
import { createConfigurationPastelRow, createConfigurationSchemeList } from "../core/configuration-controls.js";
import { bindViewportSubscriptions } from "../core/viewport-subscriptions.js";
import { createNavAreaController } from "../core/nav-area-controller.js";
import { renderTreeRows } from "../core/nav-tree-renderer.js";
import { createNavTreeRowBuilders } from "../core/nav-tree-builder-factory.js";

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
  let activeScreen = session.activeScreen === "tags" || session.activeScreen === "history" || session.activeScreen === "configuration" || session.activeScreen === "paging"
    ? session.activeScreen
    : null;
  let configPreviewKey = configuration && typeof configuration.readState === "function"
    ? configuration.readState().selectedSchemeKey
    : "minty-premature";
  let configurationPanelMode = "overview";
  const screenModeController = createNavAreaController({
    allowedModes: ["tags", "history", "configuration", "paging"],
    fallbackMode: null,
    allowNull: true
  });

  host.innerHTML = [
    '<section class="wv360-shell cs-shell" data-nav="closed" data-side-pane="closed">',
    '  <section class="wv360-nav-pane">',
    '    <div class="wv360-overlay-stack cs-menu-list">',
    '      <button type="button" class="wv360-overlay-action cs-menu-item" data-action="open-home">home</button>',
    '      <button type="button" class="wv360-overlay-action cs-menu-item" data-action="open-tags">tags</button>',
    '      <button type="button" class="wv360-overlay-action cs-menu-item" data-action="open-history">history</button>',
    '      <button type="button" class="wv360-overlay-action cs-menu-item" data-action="open-configuration">configuration</button>',
    "    </div>",
    "  </section>",
    '  <section class="wv360-content-pane">',
    '    <section class="wv360-article-view cs-content-host">',
    '      <main id="pane2main"></main>',
    "    </section>",
    '    <button type="button" class="wv360-side-toggle cs-floating-btn" data-action="toggle-side-pane" aria-label="Open side pane"></button>',
    '    <aside class="wv360-side-pane cs-rail" aria-label="Side pane">',
    '      <div class="wv360-side-pane-scroll" data-role="side-menus"></div>',
    "    </aside>",
    '    <button type="button" class="wv360-hamburger cs-floating-btn" data-action="open-nav" aria-label="Open navigation">☰</button>',
    "  </section>",
    '  <section class="wv360-screen-layer" hidden aria-hidden="true">',
    '    <header class="wv360-screen-head cs-panel-head">',
    '      <h2 class="wv360-screen-title cs-section-head"></h2>',
    '      <button type="button" class="wv360-overlay-action cs-action-btn wv360-close-half" data-action="close-screen">⤫</button>',
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
  const homeOpenButton = host.querySelector('[data-action="open-home"]');
  const tagsOpenButton = host.querySelector('[data-action="open-tags"]');
  const historyOpenButton = host.querySelector('[data-action="open-history"]');
  const configurationOpenButton = host.querySelector('[data-action="open-configuration"]');

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
    const previousScreen = activeScreen;
    activeScreen = screenModeController.normalize(nextScreen);
    if (activeScreen === "configuration" && previousScreen !== "configuration") {
      configurationPanelMode = "overview";
      if (configuration && typeof configuration.setColorSchemesVisible === "function") {
        configuration.setColorSchemesVisible(false);
      }
    }
    if (activeScreen !== "configuration") {
      configurationPanelMode = "overview";
      if (configuration && typeof configuration.setColorSchemesVisible === "function") {
        configuration.setColorSchemesVisible(false);
      }
    }
    const navArea = activeScreen === "paging" ? "tags" : (activeScreen || "menus");
    if (typeof navigation.setNavArea === "function") {
      navigation.setNavArea(navArea);
    }
    renderAll();
    persistSession();
  }

  function ensurePagingModeSelection() {
    if (activeScreen !== "paging") {
      return;
    }
    const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
      ? pagingQueue.getQueue()
      : [];
    if (!queue.length) {
      return;
    }
    const selectedId = navigation.readState().selectedArticleId;
    if (!selectedId || !queue.includes(selectedId)) {
      navigation.openArticleById(queue[0]);
    }
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

  const sideRowBuilders = createNavTreeRowBuilders({
    siteMap,
    createButton,
    depthClassName: getDepthClass,
    homeArticleId,
    menuRowClassName: "cs-nav-row wv360-side-nav-row wv360-side-menu-row",
    articleRowClassName: "cs-nav-row wv360-side-nav-row wv360-side-article-row",
    homeRowClassName: "wv360-side-home-row",
    menuToggleClassName: "wv360-side-menu-toggle cs-menu-toggle",
    toggleSpacerClassName: "wv360-side-menu-toggle-spacer",
    menuLabelClassName: "wv360-side-menu-label cs-menu-label",
    navButtonClassName: "wv360-side-nav-btn cs-nav-btn",
    onMenuToggle(node) {
      siteMap.toggleNode(node.nodeId);
      renderAll();
      persistSession();
    },
    onNodeOpen(articleId) {
      if (typeof navigation.setNavArea === "function") {
        navigation.setNavArea("menus");
      }
      openArticle(articleId, { fromSidePane: true });
    }
  });

  function renderSideMenus() {
    renderTreeRows({
      container: sideMenus,
      tree: siteMap.getTreeModel(navigation.readState().selectedArticleId),
      createMenuRow: sideRowBuilders.createMenuRow,
      createArticleRow: sideRowBuilders.createArticleRow
    });
  }

  function createTagsScreenContent() {
    return createTagsScreen({
      classes: {
        wrap: "wv360-fullscreen-panel",
        head: "wv360-history-head cs-section-head",
        queueList: "wv360-history-list wv360-tags-queue-list",
        empty: "wv360-history-empty cs-empty",
        queueItem: "wv360-history-item cs-list-btn",
        queueLabel: "wv360-queue-label",
        queueStripes: "wv360-queue-stripes",
        queueStripe: "wv360-queue-stripe cs-queue-stripe",
        controls: "wv360-tags-controls",
        selectedCount: "wv360-tags-selected cs-section-head",
        clearButton: "wv360-tag-clear wv360-tag-clear-inline cs-chip-btn",
        tagWrap: "wv360-tagpool",
        tagHead: "wv360-tagpool-head cs-section-head",
        tagList: "wv360-tagpool-list",
        tagButton: "wv360-tag-btn cs-chip-btn"
      },
      headText: "Pages to read, selected by tags:",
      emptyText: "No selected pages.",
      queue: pagingQueue && typeof pagingQueue.getQueue === "function" ? pagingQueue.getQueue() : [],
      selectedArticleId: navigation.readState().selectedArticleId,
      selectedTagColors: tagPool && typeof tagPool.getSelectedTagColors === "function" ? tagPool.getSelectedTagColors() : {},
      getSelectedTagsForArticle(articleId) {
        return tagPool && typeof tagPool.getSelectedTagsForArticle === "function"
          ? tagPool.getSelectedTagsForArticle(articleId)
          : [];
      },
      getAllTags() {
        return tagPool && typeof tagPool.getAllTags === "function" ? tagPool.getAllTags() : [];
      },
      getSelectedTags() {
        return tagPool && typeof tagPool.getSelectedTags === "function" ? tagPool.getSelectedTags() : [];
      },
      onOpenArticle(articleId) {
        navigation.openArticleById(articleId);
      },
      onToggleTag(tag) {
        if (tagPool && typeof tagPool.toggleTag === "function") {
          tagPool.toggleTag(tag);
        }
      },
      onClearTags() {
        if (tagPool && typeof tagPool.clear === "function") {
          tagPool.clear();
        }
      },
      articleMap,
      createButton,
      showPager: false,
      renderAfterTagPool({ queue }) {
        const extra = document.createElement("div");
        const paginationDivider = document.createElement("div");
        paginationDivider.className = "wv360-tags-divider";
        extra.appendChild(paginationDivider);

        const modeWrap = document.createElement("div");
        modeWrap.className = "wv360-pagination-mode-wrap";
        const pagesForPagination = tagPool && typeof tagPool.getPagesForSelectedTags === "function"
          ? tagPool.getPagesForSelectedTags()
          : queue.slice();
        const enterPaginationButton = createButton(
          "Enter Pagination Mode",
          "wv360-pagination-mode-btn cs-action-btn",
          () => {
            const selectedPages = tagPool && typeof tagPool.getPagesForSelectedTags === "function"
              ? tagPool.getPagesForSelectedTags()
              : [];
            if (pagingQueue && typeof pagingQueue.setPages === "function") {
              pagingQueue.setPages(selectedPages, { allowReorder: false });
            }
            const committedQueue = pagingQueue && typeof pagingQueue.getQueue === "function"
              ? pagingQueue.getQueue()
              : selectedPages;
            if (committedQueue.length > 0) {
              setActiveScreen("paging");
              navigation.openArticleById(committedQueue[0]);
            }
          }
        );
        enterPaginationButton.disabled = pagesForPagination.length === 0;
        modeWrap.appendChild(enterPaginationButton);
        extra.appendChild(modeWrap);
        return extra;
      }
    });
  }

  function createPagingScreenContent() {
    const wrap = document.createElement("div");
    wrap.className = "wv360-fullscreen-panel wv360-paging-screen";

    const queue = pagingQueue && typeof pagingQueue.getQueue === "function"
      ? pagingQueue.getQueue()
      : [];
    const selectedId = navigation.readState().selectedArticleId;
    const currentIndex = queue.indexOf(selectedId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const total = queue.length;
    const hasPrev = safeIndex > 0;
    const hasNext = safeIndex >= 0 && safeIndex < total - 1;

    const body = document.createElement("div");
    body.className = "wv360-paging-body";
    wrap.appendChild(body);

    const controls = document.createElement("div");
    controls.className = "wv360-paging-controls";

    const prevButton = createButton("<", "wv360-paging-btn cs-mini-nav-btn", () => {
      if (!hasPrev) {
        return;
      }
      navigation.openArticleById(queue[safeIndex - 1]);
    });
    prevButton.disabled = !hasPrev;
    controls.appendChild(prevButton);

    const center = document.createElement("div");
    center.className = "wv360-paging-indicator cs-section-head";
    center.textContent = "Paging " + (total ? String(safeIndex + 1) : "0") + " / " + String(total);
    controls.appendChild(center);

    const nextButton = createButton(">", "wv360-paging-btn cs-mini-nav-btn", () => {
      if (!hasNext) {
        return;
      }
      navigation.openArticleById(queue[safeIndex + 1]);
    });
    nextButton.disabled = !hasNext;
    controls.appendChild(nextButton);

    wrap.appendChild(controls);
    return wrap;
  }

  function createHistoryScreenContent() {
    return createHistoryScreen({
      wrapClassName: "wv360-fullscreen-panel",
      headClassName: "wv360-history-head cs-section-head",
      headerText: "Your last visited pages (max. 20):",
      historyIds: Array.isArray(navigation.readState().navigationHistory)
        ? navigation.readState().navigationHistory
        : [],
      emptyClassName: "wv360-history-empty cs-empty",
      emptyText: "No visited pages yet.",
      listClassName: "wv360-history-list",
      itemClassName: "wv360-history-item cs-list-btn",
      createButton,
      onOpenArticle(articleId) {
        navigation.openArticleById(articleId);
        closeScreen();
      }
    });
  }

  function getConfigurationPreviewByKey(key) {
    if (!configuration || typeof configuration.readState !== "function") {
      return null;
    }
    const state = configuration.readState();
    const schemes = Array.isArray(state.schemes) ? state.schemes : [];
    return schemes.find((scheme) => scheme && scheme.key === key) || schemes[0] || null;
  }

  function applyPreviewToConfigurationMini(mini, previewScheme) {
    if (!mini || !previewScheme || !previewScheme.preview) {
      return;
    }
    const preview = previewScheme.preview;
    const interactiveText = getReadableTextColor(asPreviewColor(preview.interactive, "#E5F1E8"));
    const accentText = getReadableTextColor(asPreviewColor(preview.accent, "#1E88E5"));
    mini.style.background = asPreviewColor(preview.surface, "#F8FCF8");
    mini.style.color = asPreviewColor(preview.text, "#17301F");
    mini.style.borderColor = asPreviewColor(preview.border, "#B8CABC");

    const title = mini.querySelector(".wv360-config-mini-title");
    if (title) {
      title.textContent = "Theme Illustration: " + previewScheme.label;
    }
    const topButtons = Array.from(mini.querySelectorAll(".wv360-config-mini-btn"));
    topButtons.forEach((button) => {
      button.style.background = asPreviewColor(preview.interactive, "#E5F1E8");
      button.style.color = interactiveText;
      button.style.borderColor = asPreviewColor(preview.border, "#B8CABC");
    });
    Array.from(mini.querySelectorAll(".wv360-config-mini-category")).forEach((category) => {
      category.style.borderColor = asPreviewColor(preview.border, "#B8CABC");
    });
    const navigationLine = mini.querySelector(".wv360-config-mini-line-nav");
    if (navigationLine) {
      navigationLine.style.background = asPreviewColor(preview.interactive, "#E5F1E8");
      navigationLine.style.color = interactiveText;
    }
    const actionsLine = mini.querySelector(".wv360-config-mini-line-actions");
    if (actionsLine) {
      actionsLine.style.background = asPreviewColor(preview.accent, "#1E88E5");
      actionsLine.style.color = accentText;
    }
    const contentLine = mini.querySelector(".wv360-config-mini-line-content");
    if (contentLine) {
      contentLine.style.background = asPreviewColor(preview.layer, "#FFFFFF");
      contentLine.style.color = asPreviewColor(preview.text, "#17301F");
    }
  }

  function refreshConfigurationMiniIfVisible() {
    if (activeScreen !== "configuration") {
      return;
    }
    const mini = screenBody.querySelector(".wv360-config-mini");
    if (!mini) {
      return;
    }
    const previewScheme = getConfigurationPreviewByKey(configPreviewKey);
    applyPreviewToConfigurationMini(mini, previewScheme);
    const state = configuration && typeof configuration.readState === "function" ? configuration.readState() : null;
    const pastelScheme = state && Array.isArray(state.schemes)
      ? state.schemes.find((scheme) => scheme && scheme.key === "pastel-dynamic")
      : null;
    const pastelButton = screenBody.querySelector(".wv360-config-pastel-scheme");
    if (pastelButton && pastelScheme && pastelScheme.preview) {
      const pastelPreview = pastelScheme.preview;
      pastelButton.style.background = asPreviewColor(pastelPreview.interactive, "#E5F1E8");
      pastelButton.style.color = getReadableTextColor(asPreviewColor(pastelPreview.interactive, "#E5F1E8"));
      pastelButton.style.borderColor = asPreviewColor(pastelPreview.border, "#B8CABC");
    }
  }

  function createConfigurationScreenContent() {
    const wrap = document.createElement("div");
    wrap.className = "wv360-fullscreen-panel";

    const previewScheme = getConfigurationPreviewByKey(configPreviewKey);
    const preview = previewScheme && previewScheme.preview ? previewScheme.preview : null;
    const state = configuration && typeof configuration.readState === "function" ? configuration.readState() : null;
    const actionsRow = document.createElement("div");
    actionsRow.className = "wv360-config-actions";
    const mode = configurationPanelMode === "color-schemes" || configurationPanelMode === "screen-resolutions"
      ? configurationPanelMode
      : "overview";

    if (mode === "overview") {
      const colorSchemesButton = createButton("Color Schemes", "wv360-config-toggle cs-action-btn", () => {
        configurationPanelMode = "color-schemes";
        if (configuration && typeof configuration.setColorSchemesVisible === "function") {
          configuration.setColorSchemesVisible(true);
        }
        renderScreen();
      });
      actionsRow.appendChild(colorSchemesButton);

      const screenResolutionsButton = createButton("Screen Resolutions", "wv360-config-toggle cs-action-btn", () => {
        configurationPanelMode = "screen-resolutions";
        if (configuration && typeof configuration.setColorSchemesVisible === "function") {
          configuration.setColorSchemesVisible(false);
        }
        renderScreen();
      });
      actionsRow.appendChild(screenResolutionsButton);
      wrap.appendChild(actionsRow);
      return wrap;
    }

    const backButton = createButton("Back", "wv360-config-toggle cs-action-btn", () => {
      configurationPanelMode = "overview";
      if (configuration && typeof configuration.setColorSchemesVisible === "function") {
        configuration.setColorSchemesVisible(false);
      }
      renderScreen();
    });
    actionsRow.appendChild(backButton);
    wrap.appendChild(actionsRow);

    if (mode === "screen-resolutions") {
      const resolutions = document.createElement("div");
      resolutions.className = "wv360-config-resolution-list";
      [
        "Responsive 360-720-1080+",
        "Static 360",
        "Static 720",
        "Static 1080"
      ].forEach((label) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wv360-config-resolution-btn cs-scheme-btn";
        button.textContent = label;
        button.disabled = true;
        resolutions.appendChild(button);
      });
      wrap.appendChild(resolutions);
      return wrap;
    }

    if (!state || !state.colorSchemesVisible) {
      return wrap;
    }

    if (preview) {
      const mini = document.createElement("div");
      mini.className = "wv360-config-mini cs-preview-card";
      mini.style.maxWidth = "100%";
      mini.innerHTML = [
        '<div class="wv360-config-mini-watermark">Illustration Demo</div>',
        '<div class="wv360-config-mini-top">',
        '  <span class="cs-preview-btn wv360-config-mini-btn">menus / sitemap</span>',
        '  <span class="cs-preview-btn wv360-config-mini-btn">☰</span>',
        "</div>",
        '<div class="wv360-config-mini-title">Theme Illustration: ' + previewScheme.label + "</div>",
        '<div class="wv360-config-mini-categories">',
        '  <div class="wv360-config-mini-category">',
        '    <div class="wv360-config-mini-label">Navigation</div>',
        '    <div class="wv360-config-mini-line wv360-config-mini-line-nav">Tree / menus</div>',
        "  </div>",
        '  <div class="wv360-config-mini-category">',
        '    <div class="wv360-config-mini-label">Actions</div>',
        '    <div class="wv360-config-mini-line wv360-config-mini-line-actions">Buttons / tags</div>',
        "  </div>",
        '  <div class="wv360-config-mini-category">',
        '    <div class="wv360-config-mini-label">Content</div>',
        '    <div class="wv360-config-mini-line wv360-config-mini-line-content">Cards / panels</div>',
        "  </div>",
        "</div>"
      ].join("\n");
      applyPreviewToConfigurationMini(mini, previewScheme);
      wrap.appendChild(mini);
    }

    const controlsWrap = document.createElement("div");
    controlsWrap.className = "wv360-config-controls";
    const schemes = state && Array.isArray(state.schemes) ? state.schemes : [];
    const selectedKey = state && typeof state.selectedSchemeKey === "string" ? state.selectedSchemeKey : "";
    const pastelScheme = schemes.find((scheme) => scheme && scheme.key === "pastel-dynamic") || null;

    const pastelCluster = document.createElement("div");
    pastelCluster.className = "wv360-config-pastel-cluster";
    pastelCluster.appendChild(createConfigurationPastelRow({
      rowClassName: "wv360-config-pastel-row",
      labelClassName: "wv360-config-pastel-label cs-section-head",
      labelText: "Pastel base:",
      initialHex: state && typeof state.pastelBaseColor === "string" ? state.pastelBaseColor : "#B76DC9",
      onChange(nextHex) {
        if (configuration && typeof configuration.setPastelBaseColor === "function") {
          configuration.setPastelBaseColor(nextHex);
        }
      }
    }));

    if (pastelScheme) {
      const pastelPreview = pastelScheme.preview || {};
      const pastelButton = document.createElement("button");
      pastelButton.type = "button";
      pastelButton.className = "wv360-config-scheme-btn wv360-config-pastel-scheme cs-scheme-btn" + (selectedKey === pastelScheme.key ? " active" : "");
      pastelButton.textContent = pastelScheme.label;
      pastelButton.style.background = asPreviewColor(pastelPreview.interactive, "#E5F1E8");
      pastelButton.style.color = getReadableTextColor(asPreviewColor(pastelPreview.interactive, "#E5F1E8"));
      pastelButton.style.borderColor = asPreviewColor(pastelPreview.border, "#B8CABC");
      pastelButton.addEventListener("click", () => {
        configPreviewKey = pastelScheme.key;
        renderScreen();
      });
      pastelCluster.appendChild(pastelButton);
    }
    controlsWrap.appendChild(pastelCluster);

    controlsWrap.appendChild(createConfigurationSchemeList({
      listClassName: "wv360-config-scheme-list",
      buttonClassName: "wv360-config-scheme-btn cs-scheme-btn",
      schemes,
      selectedKey,
      includeScheme(scheme) {
        return Boolean(scheme && scheme.key !== "pastel-dynamic");
      },
      onClick(scheme) {
        if (!scheme) {
          return;
        }
        configPreviewKey = scheme.key;
        renderScreen();
      },
      isEnabled() {
        return true;
      }
    }));
    wrap.appendChild(controlsWrap);

    return wrap;
  }

  function renderScreen() {
    screenBody.innerHTML = "";
    shell.dataset.screen = activeScreen || "none";
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
      return;
    }

    if (activeScreen === "paging") {
      ensurePagingModeSelection();
      screenTitle.textContent = "Paging Mode";
      screenBody.appendChild(createPagingScreenContent());
    }
  }

  function renderAll() {
    renderSideMenus();
    renderScreen();
  }

  function closeScreen() {
    setActiveScreen(null);
    ensureSelectedArticleOrFallback({
      navigation,
      articleMap,
      fallbackArticleId
    });
  }

  const unbindSubscriptions = bindViewportSubscriptions({
    navigation,
    tagPool,
    pagingQueue,
    configuration,
    onNavigation(event) {
      if (event.type !== "open" && event.type !== "back-empty") {
        return;
      }
      renderAll();
      persistSession();
    },
    onTagPool() {
      renderAll();
    },
    onPagingQueue() {
      renderAll();
    },
    onConfiguration(event) {
      if (activeScreen === "configuration") {
        if (event && event.type === "set-pastel-base-color") {
          refreshConfigurationMiniIfVisible();
          return;
        }
        renderScreen();
      }
    }
  });

  host.querySelector('[data-action="open-nav"]').addEventListener("click", () => setNavOpen(!navOpen));
  navPane.addEventListener("click", (event) => {
    if (event.target === navPane) {
      setNavOpen(false);
    }
  });

  homeOpenButton.addEventListener("click", () => {
    setNavOpen(false);
    if (homeArticleId && articleMap.has(homeArticleId)) {
      navigation.openArticleById(homeArticleId);
      return;
    }
    navigation.openHome();
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

  const unbindSidePaneDismiss = bindOutsideDismiss({
    root: host,
    isEnabled() {
      return sidePaneMode !== "closed";
    },
    isInside(_event, path) {
      const clickedInsidePane = Boolean(sidePane && Array.isArray(path) && path.includes(sidePane));
      const clickedToggle = Boolean(sideToggleButton && Array.isArray(path) && path.includes(sideToggleButton));
      return clickedInsidePane || clickedToggle;
    },
    onDismiss() {
      setSidePaneMode("closed");
    }
  });

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
      unbindSubscriptions();
      window.removeEventListener("keydown", onKeyDown);
      unbindSidePaneDismiss();
      host.innerHTML = "";
    }
  };
}
